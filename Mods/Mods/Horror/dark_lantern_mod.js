function onStart() {
  game.data.darkMode = 'lantern';
  game.banner('Тьма: фонарь', { color: '#fa6' });
}

function onDraw() {
  if (!player) return;
  const r = 260;
  const vw = (typeof W !== 'undefined' ? W : 900) / (cam.zoom || 1) + 120;
  const vh = (typeof H !== 'undefined' ? H : 1600) / (cam.zoom || 1) + 120;

  ctx.fillStyle = 'rgba(0,0,8,0.45)';
  ctx.fillRect(cam.x - 60, cam.y - 60, vw, vh);

  const pulse = 1 + Math.sin(performance.now() / 400) * 0.04;
  const g = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, r * pulse);
  g.addColorStop(0, 'rgba(255,200,120,0.28)');
  g.addColorStop(0.4, 'rgba(255,160,60,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(player.x, player.y, r * pulse, 0, Math.PI * 2);
  ctx.fill();
}
