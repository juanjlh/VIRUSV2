# 🦠 Virus 2 · Online Multiplayer

Juego de cartas multijugador online inspirado en Virus 2, jugable desde el navegador. Hasta 6 jugadores por sala con sistema de salas, chat en tiempo real, drag & drop, y efectos 3D.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green) ![Jugadores](https://img.shields.io/badge/Jugadores-2%20a%206-blue) ![Licencia](https://img.shields.io/badge/Licencia-MIT-yellow)

## 🎮 Características

- **Multijugador online** — Hasta 6 jugadores por sala con código de invitación
- **Drag & Drop** — Arrastra cartas para jugar, atacar o descartar (mouse y táctil)
- **Chat en tiempo real** — Comunicación entre jugadores durante la partida
- **Efectos 3D** — Fondo Three.js con virus, ADN y partículas
- **Audio ambiental** — Música generada con Web Audio API + sonidos de victoria/derrota
- **Responsive** — Funciona en escritorio y móvil
- **Sin dependencias externas** — Solo Node.js vanilla, sin frameworks

## 📋 Reglas

- **Objetivo:** Reunir 4 órganos sanos de colores distintos
- **Turno:** Juega 1 carta o descártala. Robas hasta tener 3
- **Órganos:** Coloca en tu mesa (1 por color)
- **Medicina:** Cura tus órganos: infectado → sano → protegido → inmune
- **Virus:** Infecta órganos rivales del mismo color. 2 virus = destruye
- **Cartas especiales:**
  - 🔄 **Trasplante** — Intercambia un órgano tuyo con uno rival
  - 🪱 **Parásito** — Roba una carta aleatoria del rival
  - 🧬 **Mutación** — Cambia el color de un órgano tuyo
  - 💥 **Brote** — Infecta todos los órganos no inmunes
- **Cambiar mano:** Descarta toda tu mano y roba 3 nuevas (pierdes turno)

## 🚀 Instalación local

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/virusv2.git
cd virusv2

# Iniciar el servidor (no necesita npm install)
npm start
```

Abre el navegador en **http://localhost:3000**

## 📁 Estructura del proyecto

```
├── server.js          # Servidor HTTP + lógica del juego (Node.js vanilla)
├── package.json       # Configuración del proyecto
├── public/
│   ├── index.html     # Interfaz del juego (lobby, sala de espera, partida)
│   ├── app.js         # Lógica del cliente (renderizado, drag&drop, audio, chat)
│   ├── style.css      # Estilos (layout 3 columnas, cartas 3D, responsive)
│   └── cards/
│       └── manifest.json
└── README.md
```

## 🔌 API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/create-room` | Crear nueva sala |
| POST | `/api/join-room` | Unirse a una sala |
| GET | `/api/state` | Obtener estado de la partida |
| POST | `/api/action` | Jugar o descartar una carta |
| POST | `/api/discard-three` | Descartar mano y robar 3 (pierde turno) |
| POST | `/api/chat` | Enviar mensaje al chat |
| POST | `/api/leave-room` | Salir de la sala |
| POST | `/api/new-game` | Reiniciar partida |

## ☁️ Despliegue gratuito

### Opción 1: Render (Recomendada ⭐)

1. Sube tu código a un repositorio en **GitHub**
2. Ve a [render.com](https://render.com) y crea una cuenta gratis
3. Click en **New → Web Service**
4. Conecta tu repositorio de GitHub
5. Configura:
   - **Build Command:** _(dejar vacío)_
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
6. Click **Deploy**

> Render ofrece 750 horas/mes gratis. El servidor se duerme tras 15 min de inactividad pero se reactiva automáticamente.

### Opción 2: Railway

1. Ve a [railway.app](https://railway.app)
2. Conecta tu GitHub y selecciona el repositorio
3. Railway detecta automáticamente que es Node.js
4. Se despliega automáticamente

> 500 horas/mes y 1 GB RAM en el plan gratuito.

### Opción 3: Glitch

1. Ve a [glitch.com](https://glitch.com)
2. Click en **New Project → Import from GitHub**
3. Pega la URL de tu repositorio
4. Se despliega automáticamente con URL pública

> Ideal para prototipos. Se duerme tras 5 min pero se reactiva al visitar.

### Variable de entorno (opcional)

En cualquier plataforma puedes configurar el puerto:

```
PORT=3000
```

El servidor usa `process.env.PORT || 3000` por defecto.

## 🛠️ Tecnologías

- **Backend:** Node.js (HTTP nativo, sin Express)
- **Frontend:** HTML5, CSS3, JavaScript vanilla
- **3D:** Three.js r0.160.0 (CDN)
- **Audio:** Web Audio API (osciladores + ruido filtrado)
- **Tiempo real:** Polling cada 1.5s

## 📝 Licencia

MIT — Uso libre para proyectos personales y educativos.
