function onStart() {
  world = 2500;
  if (mods) mods.mapSize = 2500;
  solids.length = 0;

  const W = 2500, H = 2500;
  const wall = 'rgba(55,48,42,0.95)';
  const stone = 'rgba(70,65,58,0.95)';
  const t = 28;

  game.data.rooms = [
    { id: 'chapel', x: 200, y: 400, w: 900, h: 700, name: 'Часовня' },
    { id: 'inner', x: 420, y: 720, w: 460, h: 220, name: 'Алтарь' },
    { id: 'east', x: 1500, y: 300, w: 700, h: 500, name: 'Восточный зал' },
    { id: 'south', x: 300, y: 1500, w: 600, h: 400, name: 'Кельи' },
    { id: 'cloister', x: 1400, y: 1400, w: 800, h: 600, name: 'Клуатр' },
    { id: 'gate', x: 400, y: 0, w: 328, h: 200, name: 'Ворота' }
  ];

  solids.push({ x: 0, y: 0, w: W, h: t, color: wall });
  solids.push({ x: 0, y: H - t, w: W, h: t, color: wall });
  solids.push({ x: 0, y: 0, w: t, h: 1050, color: wall });
  solids.push({ x: 0, y: 1300, w: t, h: H - 1300, color: wall });
  solids.push({ x: W - t, y: 0, w: t, h: H, color: wall });

  solids.push({ x: 400, y: 0, w: t, h: 180, color: wall });
  solids.push({ x: 700, y: 0, w: t, h: 180, color: wall });
  solids.push({ x: 400, y: 180, w: 328, h: t, color: wall });

  solids.push({ x: 200, y: 400, w: 900, h: t, color: stone });
  solids.push({ x: 200, y: 400, w: t, h: 700, color: stone });
  solids.push({ x: 1100 - t, y: 400, w: t, h: 250, color: stone });
  solids.push({ x: 1100 - t, y: 850, w: t, h: 250, color: stone });
  solids.push({ x: 200, y: 1100 - t, w: 900, h: t, color: stone });

  solids.push({ x: 350, y: 520, w: 22, h: 140, color: wall });
  solids.push({ x: 500, y: 520, w: 22, h: 140, color: wall });
  solids.push({ x: 650, y: 520, w: 22, h: 140, color: wall });
  solids.push({ x: 800, y: 520, w: 22, h: 140, color: wall });
  solids.push({ x: 950, y: 520, w: 22, h: 140, color: wall });

  solids.push({ x: 420, y: 720, w: 460, h: t, color: wall });
  solids.push({ x: 420, y: 720, w: t, h: 220, color: wall });
  solids.push({ x: 880 - t, y: 720, w: t, h: 220, color: wall });
  solids.push({ x: 420, y: 940 - t, w: 180, h: t, color: wall });
  solids.push({ x: 700, y: 940 - t, w: 180, h: t, color: wall });

  solids.push({ x: 1500, y: 300, w: 700, h: t, color: stone });
  solids.push({ x: 1500, y: 300, w: t, h: 500, color: stone });
  solids.push({ x: 2200 - t, y: 300, w: t, h: 500, color: stone });
  solids.push({ x: 1500, y: 800 - t, w: 700, h: t, color: stone });
  solids.push({ x: 1750, y: 450, w: 200, h: 200, color: 'rgba(120,110,90,0.35)', noCollide: true });

  solids.push({ x: 300, y: 1500, w: 600, h: t, color: wall });
  solids.push({ x: 300, y: 1500, w: t, h: 400, color: wall });
  solids.push({ x: 900 - t, y: 1500, w: t, h: 400, color: wall });
  solids.push({ x: 300, y: 1900 - t, w: 600, h: t, color: wall });

  solids.push({ x: 1400, y: 1400, w: 800, h: t, color: stone });
  solids.push({ x: 1400, y: 1400, w: t, h: 600, color: stone });
  solids.push({ x: 2200 - t, y: 1400, w: t, h: 600, color: stone });
  solids.push({ x: 1400, y: 2000 - t, w: 280, h: t, color: stone });
  solids.push({ x: 1920, y: 2000 - t, w: 280, h: t, color: stone });

  for (let i = 0; i < 6; i++) {
    solids.push({ x: 1480 + i * 110, y: 1600, w: 18, h: 120, color: wall });
  }

  player.x = W / 2;
  player.y = H / 2;

  if (typeof invalidateSolidGrid === 'function') invalidateSolidGrid();
  if (game.isHost) game.syncSolids();
  game.banner('Монастырь', { x: player.x, y: player.y - 120, color: '#ddd' });
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function playerRoom() {
  const rooms = game.data.rooms || [];
  for (let i = 0; i < rooms.length; i++) {
    if (pointInRect(player.x, player.y, rooms[i])) return rooms[i];
  }
  return null;
}

function hitSolid(x, y, pad) {
  pad = pad || 0;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!s || s.noCollide || s.sensor || s.ghost) continue;
    if (s.w != null) {
      if (x >= s.x - pad && x <= s.x + s.w + pad && y >= s.y - pad && y <= s.y + s.h + pad) return s;
    } else if (s.r != null) {
      if (Math.hypot(x - s.x, y - s.y) < s.r + pad) return s;
    }
  }
  return null;
}

function blockProjectiles() {
  const lists = [shitBalls, bigShits, cumShots];
  for (let li = 0; li < lists.length; li++) {
    const arr = lists[li];
    if (!arr) continue;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      if (!p) continue;
      if (hitSolid(p.x + (p.vx || 0), p.y + (p.vy || 0), (p.r || 6) * 0.55) || hitSolid(p.x, p.y, (p.r || 6) * 0.45)) {
        if (typeof spawnP === 'function') spawnP(p.x, p.y, '#555', 2);
        arr.splice(i, 1);
      }
    }
  }
  if (bullets) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b && hitSolid(b.x, b.y, (b.r || 4) * 0.6)) {
        if (typeof spawnP === 'function') spawnP(b.x, b.y, '#888', 2);
        bullets.splice(i, 1);
      }
    }
  }
}

function onUpdate() {
  blockProjectiles();
}

function onDraw() {
  const rooms = game.data.rooms || [];
  const pr = playerRoom();
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    if (pr && pr.id === r.id) continue;
    ctx.fillStyle = 'rgba(32,28,24,0.94)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(80,65,50,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.fillStyle = 'rgba(170,150,120,0.28)';
    ctx.font = 'bold 14px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.name || '', r.x + r.w / 2, r.y + r.h / 2);
  }
}
