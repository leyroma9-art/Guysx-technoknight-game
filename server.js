/**
 * ТехноКнайт — сервер статики + WebSocket комнат
 * Совместим с клиентом: join → welcome, list → rooms, relay state/damage/boss/...
 */
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.static(path.join(__dirname)));

// code -> { clients: Map(id, {ws, name}), config, open, hostId }
const rooms = new Map();

function send(ws, obj) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(obj)); } catch (_) {}
  }
}

function broadcast(room, obj, exceptId) {
  if (!room) return;
  for (const [id, c] of room.clients) {
    if (exceptId && id === exceptId) continue;
    send(c.ws, obj);
  }
}

function roomCount(room) {
  return room ? room.clients.size : 0;
}

function publicRoomsList() {
  const list = [];
  for (const [code, r] of rooms) {
    if (!r.open) continue;
    if (r.clients.size === 0) continue;
    const host = r.clients.get(r.hostId);
    list.push({
      code,
      room: code,
      count: r.clients.size,
      players: r.clients.size,
      hostName: host ? host.name : '',
      host: host ? host.name : ''
    });
  }
  return list;
}

function destroyRoomIfEmpty(code) {
  const r = rooms.get(code);
  if (r && r.clients.size === 0) rooms.delete(code);
}

wss.on('connection', (ws) => {
  let roomCode = null;
  let playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    // ----- список открытых комнат -----
    if (msg.type === 'list') {
      send(ws, { type: 'rooms', rooms: publicRoomsList() });
      send(ws, { type: 'list', rooms: publicRoomsList() });
      return;
    }

    // ----- вход / создание комнаты -----
    if (msg.type === 'join') {
      const code = String(msg.room || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{4,8}$/.test(code)) {
        send(ws, { type: 'error', message: 'Код: 4–8 латинских букв или цифр' });
        return;
      }

      const name = String(msg.name || 'Игрок').slice(0, 16);
      const wantCreate = !!msg.create;
      let room = rooms.get(code);

      if (!room) {
        // создаём комнату
        room = {
          clients: new Map(),
          config: msg.config || {},
          open: !!(msg.open || (msg.config && msg.config.open)),
          hostId: null
        };
        rooms.set(code, room);
      } else if (wantCreate && room.clients.size > 0) {
        // комната уже занята — всё равно заходим как гость
      }

      // если при создании передали config — обновляем
      if (wantCreate && msg.config) {
        room.config = msg.config;
        room.open = !!(msg.open || msg.config.open);
      }

      playerId = Math.random().toString(36).slice(2, 10);
      roomCode = code;
      room.clients.set(playerId, { ws, name });

      if (!room.hostId || !room.clients.has(room.hostId)) {
        room.hostId = playerId;
      }

      const isHost = room.hostId === playerId;

      send(ws, {
        type: 'welcome',
        room: code,
        id: playerId,
        host: isHost,
        config: room.config || {}
      });

      broadcast(room, { type: 'room', count: roomCount(room) });
      return;
    }

    // без комнаты дальше не обрабатываем
    if (!roomCode || !playerId) return;
    const room = rooms.get(roomCode);
    if (!room || !room.clients.has(playerId)) return;

    // ----- исходящие от клиента — ретрансляция -----
    // Всё, что клиенты шлют друг другу (чат, юзер-босс, стейт…)
    const relayTypes = new Set([
      'state', 'damage', 'boss', 'victory',
      'modcode', 'modmsg', 'modshared', 'modsolids',
      'chat', 'userboss', 'ub_abilities', 'ub_atk', 'ub_state'
    ]);

    if (relayTypes.has(msg.type)) {
      const out = { ...msg, id: playerId };
      // from всегда = кто реально отправил (для chat/ub_*)
      if (!out.from) out.from = playerId;
      // host может пушить мод-код всем
      if (msg.type === 'modcode' && room.hostId !== playerId) return;
      broadcast(room, out, playerId);
      return;
    }
  });

  ws.on('close', () => {
    if (!roomCode || !playerId) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    room.clients.delete(playerId);
    broadcast(room, { type: 'left', id: playerId });
    broadcast(room, { type: 'room', count: roomCount(room) });

    // если хост вышел — передать хоста другому
    if (room.hostId === playerId) {
      const next = room.clients.keys().next().value;
      room.hostId = next || null;
      if (next) {
        const c = room.clients.get(next);
        if (c) send(c.ws, { type: 'host' });
      }
    }

    destroyRoomIfEmpty(roomCode);
    roomCode = null;
    playerId = null;
  });

  ws.on('error', () => {});
});

// чистка пустых комнат раз в минуту
setInterval(() => {
  for (const [code, r] of rooms) {
    if (r.clients.size === 0) rooms.delete(code);
  }
}, 60000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log('ТехноКнайт MP: http://localhost:' + PORT);
  console.log('WebSocket: ws://localhost:' + PORT + '/ws');
});
