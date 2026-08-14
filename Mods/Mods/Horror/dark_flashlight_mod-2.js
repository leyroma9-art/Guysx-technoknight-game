function onStart() {
  game.data.flash = {
    ang: 0,
    flicker: 1,
    lx: player ? player.x : 0,
    ly: player ? player.y : 0
  };
  game.banner('Тьма: фонарик', { color: '#fd8' });
}

function onUpdate() {
  if (!player) return;
  const f = game.data.flash || (game.data.flash = { ang: 0, flicker: 1, lx: player.x, ly: player.y });

  const dx = player.x - f.lx;
  const dy = player.y - f.ly;
  f.lx = player.x;
  f.ly = player.y;

  if (dx * dx + dy * dy > 0.4) {
    const want = Math.atan2(dy, dx);
    let d = want - f.ang;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    f.ang += d * 0.28;
  }

  let near = false;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e) continue;
    const ex = e.x - player.x, ey = e.y - player.y;
    if (ex * ex + ey * ey < 280 * 280) { near = true; break; }
  }
  if (!near && boss) {
    const bx = boss.x - player.x, by = boss.y - player.y;
    if (bx * bx + by * by < 320 * 320) near = true;
  }

  if (near) {
    const t = performance.now();
    f.flicker = 0.5 + Math.random() * 0.5 + Math.sin(t / 35) * 0.15 + Math.sin(t / 11) * 0.1;
    if (f.flicker < 0.18) f.flicker = 0.15;
    if (f.flicker > 1) f.flicker = 1;
  } else {
    f.flicker += (1 - f.flicker) * 0.14;
  }
}

function onDraw() {
  if (!player) return;
  const f = game.data.flash || { ang: 0, flicker: 1 };
  const ang = f.ang;
  const flick = f.flicker;
  const reach = 380 * (0.85 + flick * 0.15);
  const half = 0.68;
  const vw = (typeof W !== 'undefined' ? W : 900) / (cam.zoom || 1) + 120;
  const vh = (typeof H !== 'undefined' ? H : 1600) / (cam.zoom || 1) + 120;

  ctx.fillStyle = 'rgba(0,0,0,' + (0.26 + (1 - flick) * 0.2) + ')';
  ctx.fillRect(cam.x - 60, cam.y - 60, vw, vh);

  const alpha = 0.1 + flick * 0.16;
  const g = ctx.createRadialGradient(player.x, player.y, 8, player.x, player.y, reach);
  g.addColorStop(0, 'rgba(255,230,170,' + (alpha + 0.08) + ')');
  g.addColorStop(0.5, 'rgba(255,210,140,' + (alpha * 0.5) + ')');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.arc(player.x, player.y, reach, ang - half, ang + half);
  ctx.closePath();
  ctx.fill();

  const g2 = ctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, 80);
  g2.addColorStop(0, 'rgba(255,240,200,' + (0.12 * flick) + ')');
  g2.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 80, 0, Math.PI * 2);
  ctx.fill();
}
