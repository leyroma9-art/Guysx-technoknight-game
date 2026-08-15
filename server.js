/**
 * Boss Fight Online — static + WebSocket rooms
 */
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 8080;

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});
app.use(express.static(__dirname, { setHeaders: (r) => r.set('Cache-Control', 'no-store') }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map();
const uid = () => Math.random().toString(36).slice(2, 10);

function listOpen() {
  const out = [];
  for (const [code, room] of rooms) {
    if (!room.open || !room.clients.size) continue;
    const host = room.clients.get(room.hostId);
    out.push({
      code,
      count: room.clients.size,
      hostName: host ? host.name : '',
      mode: (room.config && room.config.mode) || 'boss'
    });
  }
  return out;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcast(room, obj, exceptId) {
  const raw = JSON.stringify(obj);
  for (const [id, c] of room.clients) {
    if (exceptId && id === exceptId) continue;
    if (c.ws.readyState === 1) c.ws.send(raw);
  }
}

const RELAY = new Set([
  'state', 'boss', 'chat', 'damage', 'victory',
  'userboss', 'ub_abilities', 'ub_atk', 'ub_state', 'pvp_hit',
  'modcode', 'modshared', 'modsolids', 'modmsg'
]);

wss.on('connection', (ws) => {
  let myId = null;
  let myRoom = null;

  ws.on('message', (buf) => {
    let data;
    try { data = JSON.parse(String(buf)); } catch { return; }
    if (!data || !data.type) return;

    if (data.type === 'list') {
      send(ws, { type: 'rooms', rooms: listOpen() });
      return;
    }

    if (data.type === 'join') {
      const code = String(data.room || '').trim().toUpperCase();
      const name = String(data.name || 'Игрок').slice(0, 16);
      if (!/^[A-Z0-9]{4,8}$/.test(code)) {
        send(ws, { type: 'error', message: 'Код: 4–8 латиница/цифры' });
        return;
      }
      let room = rooms.get(code);
      if (data.create) {
        if (room && room.clients.size) {
          send(ws, { type: 'error', message: 'Комната занята' });
          return;
        }
        room = { hostId: null, open: !!data.open, config: data.config || { mode: 'boss' }, clients: new Map() };
        rooms.set(code, room);
      } else if (!room || !room.clients.size) {
        send(ws, { type: 'error', message: 'Комната не найдена' });
        return;
      }
      myId = uid();
      myRoom = code;
      if (!room.hostId) room.hostId = myId;
      room.clients.set(myId, { ws, name });
      send(ws, { type: 'welcome', room: code, id: myId, host: room.hostId === myId, config: room.config });
      broadcast(room, {
        type: 'players',
        count: room.clients.size,
        players: [...room.clients.entries()].map(([id, c]) => ({ id, name: c.name }))
      });
      return;
    }

    if (!myRoom || !myId) return;
    const room = rooms.get(myRoom);
    if (!room || !RELAY.has(data.type)) return;

    const payload = Object.assign({}, data, { from: myId, id: data.id || myId });
    if (data.type === 'chat') {
      const me = room.clients.get(myId);
      payload.name = (me && me.name) || 'Игрок';
    }
    // state/boss/chat/... to everyone else (sender already predicted locally)
    broadcast(room, payload, myId);
  });

  ws.on('close', () => {
    if (!myRoom || !myId) return;
    const room = rooms.get(myRoom);
    if (!room) return;
    room.clients.delete(myId);
    if (room.hostId === myId) {
      const n = room.clients.keys().next();
      room.hostId = n.done ? null : n.value;
      if (room.hostId) {
        const h = room.clients.get(room.hostId);
        if (h) send(h.ws, { type: 'host' });
      }
    }
    if (!room.clients.size) rooms.delete(myRoom);
    else broadcast(room, {
      type: 'players',
      count: room.clients.size,
      players: [...room.clients.entries()].map(([id, c]) => ({ id, name: c.name }))
    });
  });
});

server.listen(PORT, () => console.log('Boss Fight Online :' + PORT));
