const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const rooms = new Map();

const COLORS = ['rojo', 'azul', 'verde', 'amarillo'];
const MAX_PLAYERS = 6;

function randomId(size = 6) {
  return Math.random().toString(36).slice(2, 2 + size).toUpperCase();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function makeDeck() {
  const deck = [];

  COLORS.forEach((color) => {
    for (let i = 0; i < 4; i += 1) deck.push({ type: 'organ', color, name: `Órgano ${color}` });
    for (let i = 0; i < 3; i += 1) deck.push({ type: 'virus', color, name: `Virus ${color}` });
    for (let i = 0; i < 3; i += 1) deck.push({ type: 'medicine', color, name: `Medicina ${color}` });
  });

  deck.push({ type: 'special', effect: 'transplant', name: 'Trasplante' });
  deck.push({ type: 'special', effect: 'transplant', name: 'Trasplante' });
  deck.push({ type: 'special', effect: 'parasite', name: 'Parásito' });
  deck.push({ type: 'special', effect: 'parasite', name: 'Parásito' });
  deck.push({ type: 'special', effect: 'mutation', name: 'Mutación' });
  deck.push({ type: 'special', effect: 'mutation', name: 'Mutación' });
  deck.push({ type: 'special', effect: 'outbreak', name: 'Brote' });
  deck.push({ type: 'special', effect: 'outbreak', name: 'Brote' });

  return shuffle(deck);
}

function drawToThree(player, deck, discard) {
  while (player.hand.length < 3 && deck.length > 0) {
    player.hand.push(deck.pop());
  }

  if (deck.length === 0 && discard.length > 0) {
    const recycled = discard.splice(0, discard.length);
    shuffle(recycled);
    while (recycled.length) deck.push(recycled.pop());
    while (player.hand.length < 3 && deck.length > 0) {
      player.hand.push(deck.pop());
    }
  }
}

function createPlayer(name, id) {
  return {
    id,
    name,
    hand: [],
    organs: [],
    hp: 30,
    eliminated: false
  };
}

function advanceTurn(room) {
  const total = room.players.length;
  let next = (room.turnIndex + 1) % total;
  let steps = 0;
  while (room.players[next].eliminated && steps < total) {
    next = (next + 1) % total;
    steps += 1;
  }
  room.turnIndex = next;
}

function organStatusName(level) {
  if (level <= -1) return 'infectado';
  if (level === 0) return 'sano';
  if (level === 1) return 'protegido';
  return 'inmune';
}

function addLog(room, text) {
  room.log.unshift(text);
  room.log = room.log.slice(0, 12);
}

function activePlayer(room) {
  return room.players[room.turnIndex];
}

function countHealthyDifferentOrgans(player) {
  const validColors = new Set();
  player.organs.forEach((organ) => {
    if (organ.level >= 0) validColors.add(organ.color);
  });
  return validColors.size;
}

function checkWinner(room) {
  const alive = room.players.filter((p) => !p.eliminated);
  if (alive.length === 1) {
    room.winner = alive[0].id;
    addLog(room, `💀 ${alive[0].name} es el único sobreviviente y gana la partida.`);
    return;
  }
  const winner = alive.find((player) => countHealthyDifferentOrgans(player) >= 4);
  if (winner) {
    room.winner = winner.id;
    addLog(room, `🏆 ${winner.name} ha completado 4 órganos sanos y gana la partida.`);
  }
}

function damagePlayer(owner, room) {
  owner.hp -= 5;
  if (owner.hp <= 0) {
    owner.hp = 0;
    owner.eliminated = true;
    addLog(room, `💀 ${owner.name} ha perdido toda la salud y queda eliminado.`);
  }
}

function startRoom(room) {
  room.deck = makeDeck();
  room.discard = [];
  room.turnIndex = 0;
  room.winner = null;
  room.log = ['Partida iniciada.'];
  room.players.forEach((player) => {
    player.hand = [];
    player.organs = [];
    player.hp = 30;
    player.eliminated = false;
    drawToThree(player, room.deck, room.discard);
  });
}

function getRoomState(room, playerId) {
  const me = room.players.find((p) => p.id === playerId);
  if (!me) return null;

  return {
    roomId: room.id,
    creatorId: room.players[0]?.id || '',
    canJoin: !room.locked && room.players.length < MAX_PLAYERS,
    playerCount: room.players.length,
    me: {
      id: me.id,
      name: me.name,
      hand: me.hand,
      organs: me.organs.map((o) => ({ ...o, statusText: organStatusName(o.level) })),
      hp: me.hp,
      eliminated: me.eliminated
    },
    opponents: room.players
      .filter((p) => p.id !== playerId)
      .map((p) => ({
        id: p.id,
        name: p.name,
        handCount: p.hand.length,
        organs: p.organs.map((o) => ({ ...o, statusText: organStatusName(o.level) })),
        hp: p.hp,
        eliminated: p.eliminated
      })),
    currentTurn: activePlayer(room).id,
    currentTurnName: activePlayer(room).name,
    winner: room.winner,
    deckCount: room.deck.length,
    discardCount: room.discard.length,
    log: room.log,
    chat: room.chat || []
  };
}

function playOrgan(player, card, room) {
  const alreadyHasColor = player.organs.some((organ) => organ.color === card.color);
  if (alreadyHasColor) {
    return { ok: false, message: 'Ya tienes un órgano de ese color.' };
  }

  player.organs.push({ color: card.color, level: 0, name: card.name });
  addLog(room, `${player.name} baja un órgano ${card.color}.`);
  return { ok: true };
}

function playMedicine(player, opponent, card, room, targetOwner, targetColor) {
  const owner = targetOwner === 'opponent' ? opponent : player;
  if (!owner) return { ok: false, message: 'No hay objetivo válido.' };

  const organ = owner.organs.find((item) => item.color === targetColor);
  if (!organ) return { ok: false, message: 'No existe ese órgano.' };
  if (organ.color !== card.color) return { ok: false, message: 'La medicina debe coincidir con el color.' };
  if (owner.id !== player.id) return { ok: false, message: 'La medicina solo puede usarse sobre tus órganos.' };
  if (organ.level >= 2) return { ok: false, message: 'Ese órgano ya es inmune.' };

  organ.level += 1;
  addLog(room, `${player.name} mejora un órgano ${card.color} a estado ${organStatusName(organ.level)}.`);
  return { ok: true };
}

function playVirus(player, opponent, card, room, targetOwner, targetColor) {
  const owner = targetOwner === 'self' ? player : opponent;
  if (!owner) return { ok: false, message: 'No hay objetivo válido.' };

  const organ = owner.organs.find((item) => item.color === targetColor);
  if (!organ) return { ok: false, message: 'No existe ese órgano.' };
  if (organ.color !== card.color) return { ok: false, message: 'El virus debe coincidir con el color.' };
  if (organ.level >= 2) return { ok: false, message: 'Ese órgano es inmune.' };

  organ.level -= 1;

  if (organ.level <= -2) {
    owner.organs = owner.organs.filter((item) => item !== organ);
    room.discard.push({ type: 'organ', color: organ.color, name: organ.name });
    addLog(room, `${player.name} destruye el órgano ${card.color} de ${owner.name}.`);
    damagePlayer(owner, room);
  } else {
    addLog(room, `${player.name} infecta el órgano ${card.color} de ${owner.name}.`);
  }

  return { ok: true };
}

function playSpecial(player, opponent, card, room, payload) {
  if (card.effect === 'parasite') {
    if (!opponent || opponent.hand.length === 0) {
      return { ok: false, message: 'Tu rival no tiene cartas para robar.' };
    }
    const stolen = opponent.hand.splice(Math.floor(Math.random() * opponent.hand.length), 1)[0];
    player.hand.push(stolen);
    addLog(room, `${player.name} usa Parásito y roba una carta de ${opponent.name}.`);
    return { ok: true };
  }

  if (card.effect === 'mutation') {
    const organ = player.organs.find((item) => item.color === payload.targetColor);
    if (!organ) return { ok: false, message: 'Elige un órgano propio para mutar.' };
    const newColor = payload.newColor;
    if (!COLORS.includes(newColor)) return { ok: false, message: 'Color nuevo inválido.' };
    if (player.organs.some((item) => item !== organ && item.color === newColor)) {
      return { ok: false, message: 'Ya tienes un órgano de ese color.' };
    }
    organ.color = newColor;
    organ.name = `Órgano ${newColor}`;
    addLog(room, `${player.name} muta un órgano al color ${newColor}.`);
    return { ok: true };
  }

  if (card.effect === 'transplant') {
    const myOrgan = player.organs.find((item) => item.color === payload.myColor);
    const enemyOrgan = opponent && opponent.organs.find((item) => item.color === payload.enemyColor);
    if (!myOrgan || !enemyOrgan) return { ok: false, message: 'Debes elegir un órgano propio y uno rival.' };
    if (player.organs.some((item) => item !== myOrgan && item.color === enemyOrgan.color)) {
      return { ok: false, message: 'El intercambio dejaría colores repetidos.' };
    }
    if (opponent.organs.some((item) => item !== enemyOrgan && item.color === myOrgan.color)) {
      return { ok: false, message: 'El intercambio dejaría colores repetidos.' };
    }
    const myIndex = player.organs.indexOf(myOrgan);
    const enemyIndex = opponent.organs.indexOf(enemyOrgan);
    player.organs[myIndex] = enemyOrgan;
    opponent.organs[enemyIndex] = myOrgan;
    addLog(room, `${player.name} usa Trasplante e intercambia órganos con ${opponent.name}.`);
    return { ok: true };
  }

  if (card.effect === 'outbreak') {
    room.players.forEach((owner) => {
      owner.organs.slice().forEach((organ) => {
        if (organ.level < 2) {
          organ.level -= 1;
          if (organ.level <= -2) {
            owner.organs = owner.organs.filter((item) => item !== organ);
            room.discard.push({ type: 'organ', color: organ.color, name: organ.name });
            damagePlayer(owner, room);
          }
        }
      });
    });
    addLog(room, `${player.name} provoca un Brote global.`);
    return { ok: true };
  }

  return { ok: false, message: 'Carta especial no soportada.' };
}

function performAction(room, playerId, payload) {
  if (room.winner) return { ok: false, message: 'La partida ya terminó.' };
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, message: 'Jugador inválido.' };
  if (activePlayer(room).id !== playerId) return { ok: false, message: 'No es tu turno.' };

  // Find targeted opponent
  let opponent;
  if (payload.targetPlayerId) {
    opponent = room.players.find((p) => p.id === payload.targetPlayerId);
  } else {
    opponent = room.players.find((p) => p.id !== playerId);
  }

  if (payload.type === 'discard') {
    const card = player.hand.splice(payload.handIndex, 1)[0];
    if (!card) return { ok: false, message: 'Carta inválida.' };
    room.discard.push(card);
    addLog(room, `${player.name} descarta ${card.name}.`);
    if (!room.locked) {
      room.locked = true;
      addLog(room, '\uD83D\uDD12 Partida bloqueada — no se admiten más jugadores.');
    }
    drawToThree(player, room.deck, room.discard);
    advanceTurn(room);
    return { ok: true };
  }

  if (payload.type !== 'play') {
    return { ok: false, message: 'Acción no reconocida.' };
  }

  const card = player.hand[payload.handIndex];
  if (!card) return { ok: false, message: 'Carta inválida.' };

  let result = { ok: false, message: 'No se pudo jugar la carta.' };

  if (card.type === 'organ') {
    result = playOrgan(player, card, room);
  } else if (card.type === 'medicine') {
    result = playMedicine(player, opponent, card, room, payload.targetOwner, payload.targetColor);
  } else if (card.type === 'virus') {
    result = playVirus(player, opponent, card, room, payload.targetOwner, payload.targetColor);
  } else if (card.type === 'special') {
    result = playSpecial(player, opponent, card, room, payload);
  }

  if (!result.ok) return result;

  if (!room.locked) {
    room.locked = true;
    addLog(room, '\uD83D\uDD12 Partida bloqueada — no se admiten más jugadores.');
  }

  player.hand.splice(payload.handIndex, 1);
  if (card.type !== 'organ') {
    room.discard.push(card);
  }
  checkWinner(room);
  if (!room.winner) {
    drawToThree(player, room.deck, room.discard);
    advanceTurn(room);
  }

  return { ok: true };
}

function sendJson(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Body demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No encontrado');
      return;
    }

    const ext = path.extname(filePath);
    const contentTypeMap = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    res.writeHead(200, { 'Content-Type': contentTypeMap[ext] || 'text/plain; charset=utf-8' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/create-room') {
    try {
      const body = await parseBody(req);
      const roomId = randomId(5);
      const playerId = randomId(8);
      const room = {
        id: roomId,
        players: [createPlayer(body.name || 'Jugador 1', playerId)],
        deck: [],
        discard: [],
        turnIndex: 0,
        winner: null,
        locked: false,
        log: ['Sala creada. Esperando jugadores.'],
        chat: []
      };
      rooms.set(roomId, room);
      return sendJson(res, 200, { roomId, playerId });
    } catch (error) {
      return sendJson(res, 400, { error: 'No se pudo crear la sala.' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/join-room') {
    try {
      const body = await parseBody(req);
      const room = rooms.get((body.roomId || '').toUpperCase());
      if (!room) return sendJson(res, 404, { error: 'La sala no existe.' });
      if (room.locked) return sendJson(res, 400, { error: 'La partida ya comenzó, no se admiten más jugadores.' });
      if (room.players.length >= MAX_PLAYERS) return sendJson(res, 400, { error: 'La sala está llena (máx. ' + MAX_PLAYERS + ').' });

      const playerId = randomId(8);
      const name = body.name || `Jugador ${room.players.length + 1}`;
      const newPlayer = createPlayer(name, playerId);
      room.players.push(newPlayer);
      addLog(room, `${name} se une a la sala.`);

      if (room.players.length === 2) {
        startRoom(room);
      } else if (room.players.length > 2) {
        drawToThree(newPlayer, room.deck, room.discard);
      }

      return sendJson(res, 200, { roomId: room.id, playerId });
    } catch (error) {
      return sendJson(res, 400, { error: 'No se pudo unir a la sala.' });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const roomId = (url.searchParams.get('roomId') || '').toUpperCase();
    const playerId = url.searchParams.get('playerId') || '';
    const room = rooms.get(roomId);
    if (!room) return sendJson(res, 404, { error: 'Sala no encontrada.' });
    if (room.players.length < 2) {
      return sendJson(res, 200, {
        waiting: true,
        roomId,
        playerCount: room.players.length,
        players: room.players.map((p) => ({ name: p.name, id: p.id })),
        creatorId: room.players[0]?.id || '',
        log: room.log,
        chat: room.chat || []
      });
    }
    const state = getRoomState(room, playerId);
    if (!state) return sendJson(res, 403, { error: 'Jugador no autorizado.' });
    return sendJson(res, 200, state);
  }

  if (req.method === 'POST' && url.pathname === '/api/action') {
    try {
      const body = await parseBody(req);
      const room = rooms.get((body.roomId || '').toUpperCase());
      if (!room) return sendJson(res, 404, { error: 'Sala no encontrada.' });
      const result = performAction(room, body.playerId, body);
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 400, { error: 'No se pudo ejecutar la acción.' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    try {
      const body = await parseBody(req);
      const room = rooms.get((body.roomId || '').toUpperCase());
      if (!room) return sendJson(res, 404, { error: 'Sala no encontrada.' });
      const player = room.players.find((p) => p.id === body.playerId);
      if (!player) return sendJson(res, 403, { error: 'No autorizado.' });
      const text = (body.text || '').slice(0, 200).trim();
      if (!text) return sendJson(res, 400, { error: 'Mensaje vacío.' });
      if (!room.chat) room.chat = [];
      room.chat.push({ name: player.name, text, ts: Date.now() });
      if (room.chat.length > 50) room.chat = room.chat.slice(-50);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 400, { error: 'Error al enviar mensaje.' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    try {
      const body = await parseBody(req);
      const room = rooms.get((body.roomId || '').toUpperCase());
      if (!room) return sendJson(res, 404, { error: 'Sala no encontrada.' });
      const player = room.players.find((p) => p.id === body.playerId);
      if (!player) return sendJson(res, 403, { error: 'No autorizado.' });
      const text = (body.text || '').slice(0, 200).trim();
      if (!text) return sendJson(res, 400, { error: 'Mensaje vacío.' });
      if (!room.chat) room.chat = [];
      room.chat.push({ name: player.name, text, ts: Date.now() });
      if (room.chat.length > 50) room.chat = room.chat.slice(-50);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 400, { error: 'Error al enviar mensaje.' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/discard-three') {
    try {
      const body = await parseBody(req);
      const room = rooms.get((body.roomId || '').toUpperCase());
      if (!room) return sendJson(res, 404, { error: 'Sala no encontrada.' });
      if (room.winner) return sendJson(res, 400, { error: 'La partida ya terminó.' });
      const player = room.players.find((p) => p.id === body.playerId);
      if (!player) return sendJson(res, 403, { error: 'Jugador no autorizado.' });
      if (activePlayer(room).id !== player.id) return sendJson(res, 400, { error: 'No es tu turno.' });
      if (player.hand.length === 0) return sendJson(res, 400, { error: 'No tienes cartas para descartar.' });

      // Discard all hand cards
      while (player.hand.length > 0) {
        room.discard.push(player.hand.pop());
      }

      if (!room.locked) {
        room.locked = true;
        addLog(room, '\uD83D\uDD12 Partida bloqueada — no se admiten más jugadores.');
      }

      // Draw 3 new cards
      drawToThree(player, room.deck, room.discard);

      addLog(room, `${player.name} descarta toda su mano y roba 3 nuevas (pierde turno).`);

      // Lose turn — advance to next player (skip eliminated)
      advanceTurn(room);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 400, { error: 'No se pudo descartar.' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/leave-room') {
    try {
      const body = await parseBody(req);
      const roomId = (body.roomId || '').toUpperCase();
      const room = rooms.get(roomId);
      if (!room) return sendJson(res, 404, { error: 'Sala no encontrada.' });
      const playerIndex = room.players.findIndex((p) => p.id === body.playerId);
      if (playerIndex === -1) return sendJson(res, 403, { error: 'Jugador no encontrado.' });

      const isCreator = playerIndex === 0;
      const playerName = room.players[playerIndex].name;

      if (isCreator) {
        // Creator leaves → delete the room entirely
        rooms.delete(roomId);
        return sendJson(res, 200, { ok: true, roomClosed: true });
      }

      // Non-creator leaves
      // Return cards to discard
      const leaving = room.players[playerIndex];
      leaving.hand.forEach((c) => room.discard.push(c));
      leaving.organs.forEach((o) => room.discard.push({ type: 'organ', color: o.color, name: o.name }));

      room.players.splice(playerIndex, 1);
      addLog(room, `${playerName} abandonó la sala.`);

      // Fix turn index if needed
      if (room.players.length > 0) {
        if (room.turnIndex >= room.players.length) {
          room.turnIndex = 0;
        }
      }

      // If only 1 player left with game started, they win
      if (room.players.length === 1 && room.locked) {
        room.winner = room.players[0].id;
        addLog(room, `${room.players[0].name} gana por abandono de rivales.`);
      }

      return sendJson(res, 200, { ok: true, roomClosed: false });
    } catch (error) {
      return sendJson(res, 400, { error: 'No se pudo salir de la sala.' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/new-game') {
    try {
      const body = await parseBody(req);
      const room = rooms.get((body.roomId || '').toUpperCase());
      if (!room) return sendJson(res, 404, { error: 'Sala no encontrada.' });
      if (room.players.length < 2) return sendJson(res, 400, { error: 'Aún falta un jugador.' });
      startRoom(room);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 400, { error: 'No se pudo reiniciar la partida.' });
    }
  }

  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acceso denegado');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Virus 2 simple disponible en http://localhost:${PORT}`);
});
