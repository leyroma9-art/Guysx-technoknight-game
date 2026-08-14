function onStart() {
  game.data.darkMode = 'horror';
  game.banner('Тьма: хоррор', { color: '#f44' });
}

function onUpdate() {
  if (!player) return;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    e._inLight = d < 200;
  }
}

function onDraw() {
  if (!player) return;
  const vw = (typeof W !== 'undefined' ? W : 900) / (cam.zoom || 1) + 120;
  const vh = (typeof H !== 'undefined' ? H : 1600) / (cam.zoom || 1) + 120;

  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(cam.x - 60, cam.y - 60, vw, vh);

  const g = ctx.createRadialGradient(player.x, player.y, 6, player.x, player.y, 190);
  g.addColorStop(0, 'rgba(255,255,255,0.2)');
  g.addColorStop(0.35, 'rgba(180,180,200,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 190, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e || e._inLight) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.beginPath();
    ctx.arc(e.x, e.y, (e.r || 22) + 10, 0, Math.PI * 2);
    ctx.fill();
  }
}
