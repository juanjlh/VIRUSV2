const state = {
  roomId: localStorage.getItem('virus-roomId') || '',
  playerId: localStorage.getItem('virus-playerId') || '',
  current: null,
  polling: null,
  dragIndex: null,
  pendingSpecial: null,
  lastStateJSON: '',
  lastChatJSON: '',
  hasEnteredWaiting: false,
  hasEnteredGame: false
};

/* ── DOM refs ─────────────────────────── */
const mainHeader = document.getElementById('mainHeader');
const lobby = document.getElementById('lobby');
const waitingRoom = document.getElementById('waitingRoom');
const game = document.getElementById('game');
const playerName = document.getElementById('playerName');
const joinName = document.getElementById('joinName');
const roomCode = document.getElementById('roomCode');
const lobbyInfo = document.getElementById('lobbyInfo');
const waitRoomCode = document.getElementById('waitRoomCode');
const playersList = document.getElementById('playersList');
const waitingHint = document.getElementById('waitingHint');
const roomIdText = document.getElementById('roomIdText');
const playerCountText = document.getElementById('playerCountText');
const turnText = document.getElementById('turnText');
const deckText = document.getElementById('deckText');
const discardText = document.getElementById('discardText');
const myHand = document.getElementById('myHand');
const myOrgans = document.getElementById('myOrgans');
const opponentsArea = document.getElementById('opponentsArea');
const logList = document.getElementById('logList');
const meTitle = document.getElementById('meTitle');
const gameInfo = document.getElementById('gameInfo');
const dropSelf = document.getElementById('dropSelf');
const discardZone = document.getElementById('discardZone');
const joinBanner = document.getElementById('joinBanner');
const joinBannerCode = document.getElementById('joinBannerCode');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const muteBtn = document.getElementById('muteBtn');
const discardThreeBtn = document.getElementById('discardThreeBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const leaveWaitingBtn = document.getElementById('leaveWaitingBtn');

const MAX_PLAYERS = 6;

/* ── Audio System ─────────────────────────── */
let bgMusic = null;
let isMuted = false;
let resultSoundPlayed = false;
let currentVolume = 0.17;

function initBgMusic() {
  if (bgMusic) return;
  bgMusic = new Audio('musicadefondo.mp3');
  bgMusic.loop = true;
  bgMusic.volume = currentVolume;
}

function toggleMute() {
  isMuted = !isMuted;
  if (muteBtn) muteBtn.textContent = isMuted ? '🔇' : '🔊';
  if (bgMusic) {
    bgMusic.volume = isMuted ? 0 : currentVolume;
  }
}



function startBgMusic() {
  try {
    initBgMusic();
    if (!isMuted) bgMusic.volume = currentVolume;
    bgMusic.play().catch(() => {});
  } catch (e) { /* ignore audio errors */ }
}

function playResultSound(type) {
  if (resultSoundPlayed || isMuted) return;
  resultSoundPlayed = true;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(ctx.destination);

    if (type === 'win') {
      // Triumphant fanfare - ascending major chord arpeggio
      const winNotes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
      winNotes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.05);
        g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.15 + 0.3);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.15 + 0.8);
        osc.frequency.value = freq;
        osc.connect(g);
        g.connect(masterGain);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.8);
      });
      // Final chord
      [523.25, 659.25, 783.99].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const g = ctx.createGain();
        const t = ctx.currentTime + 1.0;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 0.1);
        g.gain.linearRampToValueAtTime(0, t + 2.0);
        osc.frequency.value = freq;
        osc.connect(g);
        g.connect(masterGain);
        osc.start(t);
        osc.stop(t + 2.0);
      });
    } else {
      // Sad descending tones
      const loseNotes = [392.00, 349.23, 311.13, 293.66, 261.63];
      loseNotes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.35);
        g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.35 + 0.05);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.35 + 0.5);
        osc.frequency.value = freq;
        osc.connect(g);
        g.connect(masterGain);
        osc.start(ctx.currentTime + i * 0.35);
        osc.stop(ctx.currentTime + i * 0.35 + 0.5);
      });
    }
  } catch (e) { /* ignore audio errors */ }
}

if (muteBtn) muteBtn.addEventListener('click', toggleMute);

/* ── Card descriptions ─────────────────────── */
const CARD_DESCRIPTIONS = {
  organ: {
    rojo: 'Órgano rojo (corazón). Colócalo en tu mesa. Necesitas 4 órganos sanos de colores distintos para ganar.',
    azul: 'Órgano azul (cerebro). Colócalo en tu mesa. Solo puedes tener un órgano de cada color.',
    verde: 'Órgano verde (pulmones). Colócalo en tu mesa. Protégelo con medicinas del mismo color.',
    amarillo: 'Órgano amarillo (hueso). Colócalo en tu mesa. Cuidado con los virus amarillos.'
  },
  virus: {
    rojo: 'Virus rojo. Infecta un órgano rojo bajándolo un nivel. Si ya estaba infectado, lo destruye.',
    azul: 'Virus azul. Infecta un órgano azul del rival. No afecta a órganos inmunes.',
    verde: 'Virus verde. Infecta un órgano verde del rival bajándolo un nivel.',
    amarillo: 'Virus amarillo. Infecta un órgano amarillo del rival. Un segundo virus lo destruye.'
  },
  medicine: {
    rojo: 'Medicina roja. Mejora tu órgano rojo: infectado→sano, sano→protegido, protegido→inmune.',
    azul: 'Medicina azul. Mejora tu órgano azul un nivel. Solo sobre tus propios órganos.',
    verde: 'Medicina verde. Sube el estado de tu órgano verde. Dos medicinas = inmune.',
    amarillo: 'Medicina amarilla. Cura o protege tu órgano amarillo subiéndolo un nivel.'
  },
  special: {
    transplant: 'Trasplante. Intercambia uno de tus órganos con uno del rival.',
    parasite: 'Parásito. Roba una carta aleatoria de la mano del rival.',
    mutation: 'Mutación. Cambia el color de uno de tus órganos a otro que no tengas.',
    outbreak: 'Brote. Infecta TODOS los órganos no inmunes de TODOS los jugadores.'
  }
};

function getCardIcon(card) {
  const icons = {
    organ:    { rojo: '🫀', azul: '🧠', verde: '🫁', amarillo: '🦴' },
    virus:    { rojo: '🦠', azul: '🧫', verde: '☣️', amarillo: '⚠️' },
    medicine: { rojo: '💉', azul: '💊', verde: '🩹', amarillo: '🏥' },
    special:  { transplant: '🔄', parasite: '🪱', mutation: '🧬', outbreak: '💥', generic: '✨' }
  };
  if (card.type === 'special') return icons.special[card.effect] || '✨';
  return icons[card.type]?.[card.color] || '🃏';
}

/* ── Helpers ──────────────────────────────── */
function notice(text, isError = false) {
  [lobbyInfo, gameInfo].filter(Boolean).forEach((el) => {
    el.textContent = text;
    el.className = 'notice ' + (isError ? 'error' : 'ok');
    el.classList.remove('hidden');
  });
}

async function request(url, method = 'GET', body) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Error inesperado');
  return data;
}

function saveSession(roomId, playerId) {
  state.roomId = roomId;
  state.playerId = playerId;
  localStorage.setItem('virus-roomId', roomId);
  localStorage.setItem('virus-playerId', playerId);
}

/* ── Copy room code ──────────────────────── */
window.copyRoomCode = function () {
  const code = state.roomId;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    const btns = document.querySelectorAll('.btn-copy .copy-label, .btn-copy-sm');
    btns.forEach((b) => {
      const orig = b.textContent;
      b.textContent = '✓ Copiado';
      setTimeout(() => { b.textContent = orig; }, 1500);
    });
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = code;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
};

/* ── Room actions ────────────────────────── */
async function createRoom() {
  const name = playerName.value.trim() || 'Jugador 1';
  if (state.polling) { clearInterval(state.polling); state.polling = null; }
  const data = await request('/api/create-room', 'POST', { name });
  state.lastStateJSON = '';
  state.lastChatJSON = '';
  state.hasEnteredWaiting = false;
  state.hasEnteredGame = false;
  saveSession(data.roomId, data.playerId);
  notice(`Sala creada: ${data.roomId}`);
  startPolling();
}

async function joinRoom() {
  const name = joinName.value.trim() || 'Jugador';
  const roomId = roomCode.value.trim().toUpperCase();
  if (!roomId) { notice('Introduce el código de sala.', true); return; }
  if (state.polling) { clearInterval(state.polling); state.polling = null; }
  const data = await request('/api/join-room', 'POST', { name, roomId });
  state.lastStateJSON = '';
  state.lastChatJSON = '';
  state.hasEnteredWaiting = false;
  state.hasEnteredGame = false;
  saveSession(data.roomId, data.playerId);
  notice(`Te uniste a la sala ${data.roomId}.`);
  startPolling();
}

function badgeClass(statusText) {
  const map = { 'sano': 'badge-sano', 'protegido': 'badge-protegido', 'inmune': 'badge-inmune', 'infectado': 'badge-infectado' };
  return map[statusText] || 'badge-sano';
}

/* ── Render: organ card ────────────────────── */
function renderOrgan(organ) {
  const icon = getCardIcon({ type: 'organ', color: organ.color });
  return `<div class="card card-3d ${organ.color} card-type-organ" data-color="${organ.color}">
    <div class="card-shine"></div>
    <div class="card-icon-area"><span class="card-icon">${icon}</span></div>
    <p class="card-name">${organ.name}</p>
    <span class="card-badge ${badgeClass(organ.statusText)}">${organ.statusText}</span>
    <button class="btn btn-info btn-sm" onclick="explainCard('organ','${organ.color}')">?</button>
  </div>`;
}

/* ── Render: hand card (draggable) ────────── */
function renderHandCard(card, index, canPlay) {
  const css = card.color || 'special';
  const typeLabel = card.type === 'special' ? card.effect : card.type;
  const icon = getCardIcon(card);
  const descKey = card.type === 'special' ? card.effect : card.color;
  const draggable = canPlay ? 'true' : 'false';
  const trashBtn = canPlay
    ? `<button class="btn-trash" onclick="event.stopPropagation(); doDiscard(${index})" title="Descartar">🗑</button>`
    : '';
  return `<div class="card card-3d ${css} card-type-${card.type}"
    draggable="${draggable}"
    data-index="${index}"
    data-type="${card.type}"
    data-color="${card.color || ''}"
    data-effect="${card.effect || ''}">
    <div class="card-shine"></div>
    ${trashBtn}
    <div class="card-icon-area"><span class="card-icon">${icon}</span></div>
    <p class="card-name">${card.name}</p>
    <p class="card-sub">${typeLabel}${card.color ? ' · ' + card.color : ''}</p>
    <button class="btn btn-info btn-sm" onclick="event.stopPropagation(); explainCard('${card.type}','${descKey}')">?</button>
  </div>`;
}

/* ── Render: rival face-down cards ─────────── */
function renderRivalCards(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<div class="card card-3d card-back"><span class="back-logo">V2</span></div>`;
  }
  return html;
}

/* ── Render: opponents area (dynamic) ──────── */
function renderOpponents(opponents) {
  if (!opponents || opponents.length === 0) {
    opponentsArea.innerHTML = '<p class="muted small" style="text-align:center;padding:12px;">Esperando rivales...</p>';
    return;
  }
  opponentsArea.innerHTML = opponents.map((opp) => `
    <div class="opponent-section">
      <div class="player-plate rival-plate">
        <span class="plate-label">Rival</span>
        <h2 class="plate-name">💀 ${escapeHtml(opp.name)} · 🃏 ${opp.handCount}</h2>
      </div>
      <div class="rival-hand">${renderRivalCards(opp.handCount)}</div>
      <div class="drop-zone drop-zone-opponent" data-player-id="${opp.id}">
        <span class="drop-hint">⬆ Atacar a ${escapeHtml(opp.name)}</span>
        <div class="organs-row">${opp.organs.length
          ? opp.organs.map((o) => renderOrgan(o)).join('')
          : '<p class="muted small">Sin órganos visibles.</p>'}</div>
      </div>
    </div>
  `).join('');
  setupOpponentDropZones();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ── Render state ────────────────────────────── */
function renderState(data) {
  // Skip re-render if nothing changed (prevents flickering)
  const { chat: _chat, ...dataWithoutChat } = data;
  const json = JSON.stringify(dataWithoutChat);
  const chatJson = JSON.stringify(_chat || []);
  const stateChanged = json !== state.lastStateJSON;
  const chatChanged = chatJson !== state.lastChatJSON;
  if (!stateChanged && !chatChanged) return;
  state.lastStateJSON = json;

  // Always update chat if changed
  if (chatChanged) {
    state.lastChatJSON = chatJson;
    renderChat(_chat || []);
  }

  if (!stateChanged) return;

  state.current = data;

  // WAITING STATE (< 2 players)
  if (data.waiting) {
    mainHeader.classList.add('hidden');
    lobby.classList.add('hidden');
    waitingRoom.classList.remove('hidden');
    game.classList.add('hidden');
    document.body.classList.remove('in-game');

    // Only animate on first entrance
    if (!state.hasEnteredWaiting) {
      state.hasEnteredWaiting = true;
    }

    waitRoomCode.textContent = data.roomId;
    playersList.innerHTML = data.players.map((p, i) => `
      <div class="player-chip">
        <span class="chip-number">${i + 1}</span>
        <span class="chip-name">${escapeHtml(p.name)}</span>
        <span class="chip-status">✓ Conectado</span>
      </div>
    `).join('');
    waitingHint.textContent = `Esperando jugadores... (${data.playerCount}/${MAX_PLAYERS})`;
    return;
  }

  // GAME STATE (>= 2 players)
  mainHeader.classList.add('hidden');
  lobby.classList.add('hidden');
  waitingRoom.classList.add('hidden');
  game.classList.remove('hidden');
  document.body.classList.add('in-game');

  // Only animate game entrance once
  if (!state.hasEnteredGame) {
    state.hasEnteredGame = true;
    game.classList.add('game-fresh');
    setTimeout(() => game.classList.remove('game-fresh'), 1500);
    startBgMusic();
  }

  // Reset result sound when no winner (new game started)
  if (!data.winner) resultSoundPlayed = false;

  const myTurn = data.currentTurn === data.me.id && !data.winner;

  roomIdText.textContent = data.roomId;
  playerCountText.textContent = data.playerCount;
  turnText.textContent = data.winner ? 'Partida terminada' : data.currentTurnName;
  deckText.textContent = data.deckCount;
  discardText.textContent = data.discardCount;
  meTitle.textContent = `🧬 ${data.me.name}`;

  // Join banner
  if (data.canJoin) {
    joinBanner.classList.remove('hidden');
    joinBannerCode.textContent = data.roomId;
  } else {
    joinBanner.classList.add('hidden');
  }

  // Opponents (dynamic)
  renderOpponents(data.opponents);

  // My organs
  myOrgans.innerHTML = data.me.organs.length
    ? data.me.organs.map((o) => renderOrgan(o)).join('')
    : '<p class="muted small">Sin órganos en mesa.</p>';

  // My hand
  myHand.innerHTML = data.me.hand.map((c, i) => renderHandCard(c, i, myTurn)).join('');
  setupDrag();

  // Log
  logList.innerHTML = data.log.map((entry) => `<li>${entry}</li>`).join('');

  // Status notice
  const restartBtn = document.getElementById('restartBtn');
  if (data.winner) {
    restartBtn.classList.remove('hidden');
    if (discardThreeBtn) discardThreeBtn.classList.add('hidden');
  } else {
    restartBtn.classList.add('hidden');
    // Show discard-three only on my turn
    if (discardThreeBtn) {
      if (myTurn) discardThreeBtn.classList.remove('hidden');
      else discardThreeBtn.classList.add('hidden');
    }
  }

  if (data.winner === data.me.id) {
    notice('🏆 ¡Has ganado la partida! 🏆');
    playResultSound('win');
  } else if (data.winner) {
    notice('☠️ Un rival ha ganado la partida.', true);
    playResultSound('lose');
  } else if (myTurn) {
    notice('🔴 Es tu turno — arrastra una carta para jugar o descartar.');
  } else {
    notice('⏳ Turno de ' + data.currentTurnName + '. Espera...');
  }
}

/* ═══════════════════════════════════════════
   DRAG & DROP
   ═══════════════════════════════════════════ */
function setupDrag() {
  const cards = myHand.querySelectorAll('.card[draggable="true"]');
  cards.forEach((card) => {
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragend', onDragEnd);
    card.addEventListener('touchstart', onTouchStart, { passive: false });
    card.addEventListener('touchmove', onTouchMove, { passive: false });
    card.addEventListener('touchend', onTouchEnd);
  });
}

let touchClone = null;
let touchCardIndex = null;

function onDragStart(e) {
  const card = e.target.closest('.card');
  const idx = parseInt(card.dataset.index);
  state.dragIndex = idx;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', idx);
  document.body.classList.add('drag-active');
}

function onDragEnd(e) {
  e.target.closest('.card')?.classList.remove('dragging');
  document.body.classList.remove('drag-active');
  clearDropHighlights();
}

function onTouchStart(e) {
  const card = e.target.closest('.card[draggable="true"]');
  if (!card) return;
  e.preventDefault();
  touchCardIndex = parseInt(card.dataset.index);
  card.classList.add('dragging');
  document.body.classList.add('drag-active');
  touchClone = card.cloneNode(true);
  touchClone.classList.add('touch-ghost');
  document.body.appendChild(touchClone);
  const rect = card.getBoundingClientRect();
  touchClone.style.left = rect.left + 'px';
  touchClone.style.top = rect.top + 'px';
}

function onTouchMove(e) {
  if (!touchClone) return;
  e.preventDefault();
  const touch = e.touches[0];
  touchClone.style.left = (touch.clientX - 60) + 'px';
  touchClone.style.top = (touch.clientY - 100) + 'px';
  clearDropHighlights();
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (el) {
    const zone = el.closest('.drop-zone') || el.closest('.discard-zone');
    if (zone) zone.classList.add('drag-over');
  }
}

function onTouchEnd(e) {
  if (touchClone) { touchClone.remove(); touchClone = null; }
  document.body.classList.remove('drag-active');
  clearDropHighlights();
  const card = e.target.closest('.card');
  if (card) card.classList.remove('dragging');
  if (touchCardIndex === null) return;

  const touch = e.changedTouches[0];
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (el) {
    const discard = el.closest('.discard-zone');
    const zone = el.closest('.drop-zone');
    if (discard) {
      doDiscard(touchCardIndex);
    } else if (zone) {
      if (zone.classList.contains('drop-zone-self')) {
        doPlay(touchCardIndex, 'self', null);
      } else if (zone.classList.contains('drop-zone-opponent')) {
        doPlay(touchCardIndex, 'opponent', zone.dataset.playerId);
      }
    }
  }
  touchCardIndex = null;
}

function clearDropHighlights() {
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
}

/* ── Self drop zone (static) ─────────── */
dropSelf.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  dropSelf.classList.add('drag-over');
});
dropSelf.addEventListener('dragleave', () => dropSelf.classList.remove('drag-over'));
dropSelf.addEventListener('drop', (e) => {
  e.preventDefault();
  dropSelf.classList.remove('drag-over');
  document.body.classList.remove('drag-active');
  const idx = parseInt(e.dataTransfer.getData('text/plain'));
  doPlay(idx, 'self', null);
});

/* ── Discard zone (static) ─────────── */
discardZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  discardZone.classList.add('drag-over');
});
discardZone.addEventListener('dragleave', () => discardZone.classList.remove('drag-over'));
discardZone.addEventListener('drop', (e) => {
  e.preventDefault();
  discardZone.classList.remove('drag-over');
  document.body.classList.remove('drag-active');
  const idx = parseInt(e.dataTransfer.getData('text/plain'));
  doDiscard(idx);
});

/* ── Opponent drop zones (dynamic) ────── */
function setupOpponentDropZones() {
  document.querySelectorAll('.drop-zone-opponent').forEach((zone) => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      document.body.classList.remove('drag-active');
      const idx = parseInt(e.dataTransfer.getData('text/plain'));
      const targetPlayerId = zone.dataset.playerId;
      doPlay(idx, 'opponent', targetPlayerId);
    });
  });
}

/* ── Play / Discard ──────────────────────── */
function doPlay(index, targetOwner, targetPlayerId) {
  if (!state.current) return;
  const card = state.current.me.hand[index];
  if (!card) return;

  // Special cards needing extra input
  if (card.type === 'special' && (card.effect === 'transplant' || card.effect === 'mutation')) {
    showSpecialModal(card, index, targetOwner, targetPlayerId);
    return;
  }

  const targetColor = card.color || 'rojo';
  const payload = {
    roomId: state.roomId,
    playerId: state.playerId,
    handIndex: index,
    type: 'play',
    targetOwner,
    targetPlayerId: targetPlayerId || '',
    targetColor,
    newColor: card.color || 'rojo',
    myColor: 'rojo',
    enemyColor: 'rojo'
  };

  request('/api/action', 'POST', payload)
    .then(() => refreshState())
    .catch((err) => notice(err.message, true));
}

window.doDiscard = doDiscard;
function doDiscard(index) {
  const payload = {
    roomId: state.roomId,
    playerId: state.playerId,
    handIndex: index,
    type: 'discard',
    targetOwner: 'self',
    targetPlayerId: '',
    targetColor: 'rojo',
    newColor: 'rojo',
    myColor: 'rojo',
    enemyColor: 'rojo'
  };
  request('/api/action', 'POST', payload)
    .then(() => refreshState())
    .catch((err) => notice(err.message, true));
}

/* ── Special card modal ─────────────────── */
function showSpecialModal(card, index, targetOwner, targetPlayerId) {
  state.pendingSpecial = { card, index, targetOwner, targetPlayerId };
  const title = document.getElementById('specialTitle');
  const body = document.getElementById('specialBody');
  const colors = ['rojo', 'azul', 'verde', 'amarillo'];
  const colorLabels = { rojo: '🔴 Rojo', azul: '🔵 Azul', verde: '🟢 Verde', amarillo: '🟡 Amarillo' };

  if (card.effect === 'transplant') {
    // Also need to choose which opponent if multiple
    const opponents = state.current.opponents || [];
    const oppSelect = opponents.length > 1
      ? `<div class="special-field"><label>Rival:</label><select id="spTargetPlayer">${opponents.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('')}</select></div>`
      : '';
    title.textContent = '🔄 Trasplante — Elige órganos';
    body.innerHTML = `${oppSelect}
      <div class="special-field"><label>Mi órgano:</label><select id="spMyColor">${colors.map(c => `<option value="${c}">${colorLabels[c]}</option>`).join('')}</select></div>
      <div class="special-field"><label>Órgano rival:</label><select id="spEnemyColor">${colors.map(c => `<option value="${c}">${colorLabels[c]}</option>`).join('')}</select></div>`;
  } else if (card.effect === 'mutation') {
    title.textContent = '🧬 Mutación — Elige colores';
    body.innerHTML = `
      <div class="special-field"><label>Órgano a mutar:</label><select id="spTargetColor">${colors.map(c => `<option value="${c}">${colorLabels[c]}</option>`).join('')}</select></div>
      <div class="special-field"><label>Nuevo color:</label><select id="spNewColor">${colors.map(c => `<option value="${c}">${colorLabels[c]}</option>`).join('')}</select></div>`;
  }

  document.getElementById('specialModal').classList.remove('hidden');
}

window.cancelSpecial = function () {
  state.pendingSpecial = null;
  document.getElementById('specialModal').classList.add('hidden');
};

window.confirmSpecial = function () {
  const sp = state.pendingSpecial;
  if (!sp) return;

  // Determine target player ID for transplant
  let tpId = sp.targetPlayerId || '';
  const spTargetPlayer = document.getElementById('spTargetPlayer');
  if (spTargetPlayer) tpId = spTargetPlayer.value;
  if (!tpId && state.current.opponents.length > 0) tpId = state.current.opponents[0].id;

  const payload = {
    roomId: state.roomId,
    playerId: state.playerId,
    handIndex: sp.index,
    type: 'play',
    targetOwner: sp.targetOwner,
    targetPlayerId: tpId,
    targetColor: document.getElementById('spTargetColor')?.value || document.getElementById('spMyColor')?.value || 'rojo',
    newColor: document.getElementById('spNewColor')?.value || 'rojo',
    myColor: document.getElementById('spMyColor')?.value || 'rojo',
    enemyColor: document.getElementById('spEnemyColor')?.value || 'rojo'
  };

  document.getElementById('specialModal').classList.add('hidden');
  state.pendingSpecial = null;

  request('/api/action', 'POST', payload)
    .then(() => refreshState())
    .catch((err) => notice(err.message, true));
};

/* ── Polling ─────────────────────────────── */
async function refreshState() {
  if (!state.roomId || !state.playerId) return;
  try {
    const data = await request(`/api/state?roomId=${encodeURIComponent(state.roomId)}&playerId=${encodeURIComponent(state.playerId)}`);
    renderState(data);
  } catch (error) {
    // Room gone — clear stale session, stop polling, show lobby
    if (state.polling) clearInterval(state.polling);
    state.polling = null;
    state.roomId = '';
    state.playerId = '';
    state.lastStateJSON = '';
    state.lastChatJSON = '';
    localStorage.removeItem('virus-roomId');
    localStorage.removeItem('virus-playerId');
    mainHeader.classList.remove('hidden');
    lobby.classList.remove('hidden');
    waitingRoom.classList.add('hidden');
    game.classList.add('hidden');
    document.body.classList.remove('in-game');
    notice(error.message, true);
  }
}

function startPolling() {
  refreshState();
  if (state.polling) clearInterval(state.polling);
  state.polling = setInterval(refreshState, 1500);
}

/* ── Explain modal ─────────────────────── */
window.explainCard = function (type, key) {
  const desc = CARD_DESCRIPTIONS[type]?.[key] || 'Sin descripción disponible.';
  const icon = getCardIcon({
    type,
    color: type === 'special' ? undefined : key,
    effect: type === 'special' ? key : undefined
  });
  const title = type === 'special'
    ? key.charAt(0).toUpperCase() + key.slice(1)
    : type.charAt(0).toUpperCase() + type.slice(1) + ' ' + key;
  document.getElementById('explainIcon').textContent = icon;
  document.getElementById('explainTitle').textContent = title;
  document.getElementById('explainText').textContent = desc;
  document.getElementById('explainModal').classList.remove('hidden');
};

window.closeExplain = function () {
  document.getElementById('explainModal').classList.add('hidden');
};

/* ── Button listeners ────────────────────── */
document.getElementById('createRoomBtn').addEventListener('click', () => {
  createRoom().catch((err) => notice(err.message, true));
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
  joinRoom().catch((err) => notice(err.message, true));
});
/* ── Chat ──────────────────────────────── */
function renderChat(messages) {
  if (!chatMessages) return;
  chatMessages.innerHTML = messages.map((m) => {
    const isMe = state.current && state.current.me && m.name === state.current.me.name;
    return `<div class="chat-msg ${isMe ? 'chat-msg-me' : 'chat-msg-other'}">
      <span class="chat-author">${escapeHtml(m.name)}</span>
      <span class="chat-text">${escapeHtml(m.text)}</span>
    </div>`;
  }).join('');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChat() {
  if (!chatInput || !state.roomId) return;
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  try {
    await request('/api/chat', 'POST', {
      roomId: state.roomId,
      playerId: state.playerId,
      text
    });
    refreshState();
  } catch (err) {
    notice(err.message, true);
  }
}

if (chatSendBtn) {
  chatSendBtn.addEventListener('click', sendChat);
}
if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
  });
}
document.getElementById('restartBtn').addEventListener('click', async () => {
  try {
    await request('/api/new-game', 'POST', { roomId: state.roomId });
    refreshState();
  } catch (err) {
    notice(err.message, true);
  }
});

/* ── Discard three (lose turn) ─────────── */
async function discardThree() {
  try {
    await request('/api/discard-three', 'POST', {
      roomId: state.roomId,
      playerId: state.playerId
    });
    refreshState();
  } catch (err) {
    notice(err.message, true);
  }
}

if (discardThreeBtn) {
  discardThreeBtn.addEventListener('click', discardThree);
}

/* ── Leave room ────────────────────────── */
async function leaveRoom() {
  try {
    const data = await request('/api/leave-room', 'POST', {
      roomId: state.roomId,
      playerId: state.playerId
    });
    // Clear session & go back to lobby
    if (state.polling) { clearInterval(state.polling); state.polling = null; }
    state.roomId = '';
    state.playerId = '';
    state.lastStateJSON = '';
    state.lastChatJSON = '';
    state.hasEnteredWaiting = false;
    state.hasEnteredGame = false;
    localStorage.removeItem('virus-roomId');
    localStorage.removeItem('virus-playerId');
    mainHeader.classList.remove('hidden');
    lobby.classList.remove('hidden');
    waitingRoom.classList.add('hidden');
    game.classList.add('hidden');
    document.body.classList.remove('in-game');
    notice(data.roomClosed ? 'Sala cerrada (eras el creador).' : 'Has salido de la sala.');
  } catch (err) {
    notice(err.message, true);
  }
}

if (leaveRoomBtn) {
  leaveRoomBtn.addEventListener('click', leaveRoom);
}
if (leaveWaitingBtn) {
  leaveWaitingBtn.addEventListener('click', leaveRoom);
}

/* ── Auto-resume ────────────────────────── */
if (state.roomId && state.playerId) {
  startPolling();
}
