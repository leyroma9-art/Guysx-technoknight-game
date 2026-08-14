function onStart() {
  game.data.darkMode = 'pulse';
  game.data.pulseT = 0;
  game.banner('Тьма: пульс', { color: '#f8f' });
}

function onUpdate(dt) {
  game.data.pulseT = (game.data.pulseT || 0) + (dt || 0.016);
}

function onDraw() {
  if (!player) return;
  const t = game.data.pulseT || 0;
  const beat = Math.pow(Math.max(0, Math.sin(t * 3.2)), 8);
  const r = 140 + beat * 180;
  const dark = 0.5 - beat * 0.28;

  const vw = (typeof W !== 'undefined' ? W : 900) / (cam.zoom || 1) + 120;
  const vh = (typeof H !== 'undefined' ? H : 1600) / (cam.zoom || 1) + 120;

  ctx.fillStyle = 'rgba(10,0,15,' + dark + ')';
  ctx.fillRect(cam.x - 60, cam.y - 60, vw, vh);

  const g = ctx.createRadialGradient(player.x, player.y, 8, player.x, player.y, r);
  g.addColorStop(0, 'rgba(255,100,180,' + (0.2 + beat * 0.15) + ')');
  g.addColorStop(0.5, 'rgba(120,40,100,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.fill();
}
