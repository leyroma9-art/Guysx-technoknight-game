function onStart() {
  game.data.darkMode = 'night';
  game.banner('Тьма: ночь', { color: '#8af' });
}

function onDraw() {
  if (!player) return;
  const vw = (typeof W !== 'undefined' ? W : 900) / (cam.zoom || 1) + 120;
  const vh = (typeof H !== 'undefined' ? H : 1600) / (cam.zoom || 1) + 120;

  ctx.fillStyle = 'rgba(8,12,28,0.35)';
  ctx.fillRect(cam.x - 60, cam.y - 60, vw, vh);

  const g = ctx.createRadialGradient(player.x, player.y, 20, player.x, player.y, 320);
  g.addColorStop(0, 'rgba(120,160,255,0.06)');
  g.addColorStop(1, 'rgba(0,0,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 320, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,220,0.04)';
  for (let i = 0; i < 12; i++) {
    const a = performance.now() / 8000 + i * 0.7;
    const x = player.x + Math.cos(a) * (400 + i * 40);
    const y = player.y + Math.sin(a * 1.3) * (300 + i * 30);
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
