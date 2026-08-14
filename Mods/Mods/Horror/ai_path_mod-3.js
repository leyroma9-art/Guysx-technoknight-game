function onStart() {
  game.data.nav = null;
  game.data.aiTick = 0;
  game.data.horror = {
    alert: 0,
    maxAlert: 100,
    chaseUntil: 0,
    lastNoise: null,
    musicOn: false,
    prevDash: 0,
    prevX: player ? player.x : 0,
    prevY: player ? player.y : 0,
    hideTime: 0
  };
  initHorrorAudio();
  game.banner('AI: Horror NavMesh', { color: '#f66' });
}

function initHorrorAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const h = game.data.horror;
    if (h.ac) return;
    h.ac = new AC();
    h.master = h.ac.createGain();
    h.master.gain.value = 0.22;
    h.master.connect(h.ac.destination);

    h.drone = h.ac.createOscillator();
    h.drone.type = 'sine';
    h.drone.frequency.value = 55;
    h.droneGain = h.ac.createGain();
    h.droneGain.gain.value = 0;
    h.drone.connect(h.droneGain);
    h.droneGain.connect(h.master);
    h.drone.start();

    h.drone2 = h.ac.createOscillator();
    h.drone2.type = 'triangle';
    h.drone2.frequency.value = 82.5;
    h.drone2Gain = h.ac.createGain();
    h.drone2Gain.gain.value = 0;
    h.drone2.connect(h.drone2Gain);
    h.drone2Gain.connect(h.master);
    h.drone2.start();

    h.pulse = h.ac.createOscillator();
    h.pulse.type = 'sawtooth';
    h.pulse.frequency.value = 40;
    h.pulseGain = h.ac.createGain();
    h.pulseGain.gain.value = 0;
    h.pulseFilter = h.ac.createBiquadFilter();
    h.pulseFilter.type = 'lowpass';
    h.pulseFilter.frequency.value = 120;
    h.pulse.connect(h.pulseFilter);
    h.pulseFilter.connect(h.pulseGain);
    h.pulseGain.connect(h.master);
    h.pulse.start();

    h.musicOn = true;
  } catch (e) {}
}

function resumeAudio() {
  const h = game.data.horror;
  if (h && h.ac && h.ac.state === 'suspended') h.ac.resume();
}

function playNoise(type) {
  const h = game.data.horror;
  if (!h || !h.ac) return;
  resumeAudio();
  const t = h.ac.currentTime;
  const o = h.ac.createOscillator();
  const g = h.ac.createGain();
  const f = h.ac.createBiquadFilter();
  f.type = 'bandpass';
  if (type === 'dash') {
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    f.frequency.value = 400;
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  } else if (type === 'bump') {
    o.type = 'square';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    f.frequency.value = 200;
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  } else {
    o.type = 'triangle';
    o.frequency.value = 120;
    f.frequency.value = 300;
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  }
  o.connect(f);
  f.connect(g);
  g.connect(h.master);
  o.start(t);
  o.stop(t + 0.3);
}

function updateHorrorMusic(alert, chasing) {
  const h = game.data.horror;
  if (!h || !h.ac || !h.musicOn) return;
  resumeAudio();
  const n = alert / h.maxAlert;
  const t = h.ac.currentTime;
  const droneVol = 0.02 + n * 0.1 + (chasing ? 0.06 : 0);
  const pulseVol = chasing ? 0.04 + n * 0.06 : n * 0.02;
  h.droneGain.gain.linearRampToValueAtTime(droneVol, t + 0.15);
  h.drone2Gain.gain.linearRampToValueAtTime(droneVol * 0.6, t + 0.15);
  h.pulseGain.gain.linearRampToValueAtTime(pulseVol, t + 0.1);
  h.drone.frequency.linearRampToValueAtTime(50 + n * 30, t + 0.2);
  h.drone2.frequency.linearRampToValueAtTime(75 + n * 40, t + 0.2);
  h.pulse.frequency.linearRampToValueAtTime(36 + n * 20 + (chasing ? 12 : 0), t + 0.15);
}

function solidHit(x, y, pad) {
  pad = pad || 0;
  const list = solids;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s || s.noCollide || s.sensor || s.ghost) continue;
    if (s.w != null) {
      if (x >= s.x - pad && x <= s.x + s.w + pad && y >= s.y - pad && y <= s.y + s.h + pad) return true;
    } else if (s.r != null) {
      if ((x - s.x) * (x - s.x) + (y - s.y) * (y - s.y) < (s.r + pad) * (s.r + pad)) return true;
    }
  }
  return false;
}

function buildNavMesh() {
  const CELL = 64;
  const pad = 24;
  const cols = Math.ceil(world / CELL);
  const rows = Math.ceil(world / CELL);
  const walk = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) {
    const cy = gy * CELL + CELL * 0.5;
    for (let gx = 0; gx < cols; gx++) {
      const cx = gx * CELL + CELL * 0.5;
      walk[gy * cols + gx] = solidHit(cx, cy, pad) ? 0 : 1;
    }
  }
  game.data.nav = {
    CELL, cols, rows, walk, ver: solids.length,
    gScore: new Float32Array(cols * rows),
    fScore: new Float32Array(cols * rows),
    came: new Int32Array(cols * rows),
    closed: new Uint8Array(cols * rows),
    open: new Int32Array(cols * rows),
    openN: 0
  };
}

function ensureNav() {
  if (!game.data.nav || game.data.nav.ver !== solids.length) buildNavMesh();
  return game.data.nav;
}

function nearestWalk(gx, gy, nav) {
  const cols = nav.cols, rows = nav.rows, walk = nav.walk;
  if (gx < 0) gx = 0; if (gy < 0) gy = 0;
  if (gx >= cols) gx = cols - 1; if (gy >= rows) gy = rows - 1;
  if (walk[gy * cols + gx]) return gx | (gy << 16);
  for (let r = 1; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx !== r && dx !== -r && dy !== r && dy !== -r) continue;
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (walk[ny * cols + nx]) return nx | (ny << 16);
      }
    }
  }
  return gx | (gy << 16);
}

function heapPush(nav, idx) {
  let i = nav.openN++;
  nav.open[i] = idx;
  const f = nav.fScore;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (f[nav.open[p]] <= f[nav.open[i]]) break;
    const t = nav.open[p]; nav.open[p] = nav.open[i]; nav.open[i] = t;
    i = p;
  }
}

function heapPop(nav) {
  const open = nav.open;
  const f = nav.fScore;
  const out = open[0];
  const last = open[--nav.openN];
  if (!nav.openN) return out;
  open[0] = last;
  let i = 0;
  for (;;) {
    let l = i * 2 + 1, r = l + 1, s = i;
    if (l < nav.openN && f[open[l]] < f[open[s]]) s = l;
    if (r < nav.openN && f[open[r]] < f[open[s]]) s = r;
    if (s === i) break;
    const t = open[s]; open[s] = open[i]; open[i] = t;
    i = s;
  }
  return out;
}

function astar(sx, sy, gx, gy, nav) {
  const cols = nav.cols, rows = nav.rows, walk = nav.walk;
  const gScore = nav.gScore, fScore = nav.fScore, came = nav.came, closed = nav.closed;
  gScore.fill(1e15);
  fScore.fill(1e15);
  came.fill(-1);
  closed.fill(0);
  nav.openN = 0;

  const sPack = nearestWalk(sx, sy, nav);
  const gPack = nearestWalk(gx, gy, nav);
  const sIdx = (sPack & 65535) + ((sPack >>> 16) * cols);
  const gIdx = (gPack & 65535) + ((gPack >>> 16) * cols);

  gScore[sIdx] = 0;
  fScore[sIdx] = Math.abs((gPack & 65535) - (sPack & 65535)) + Math.abs((gPack >>> 16) - (sPack >>> 16));
  heapPush(nav, sIdx);

  const DX = [1, -1, 0, 0, 1, 1, -1, -1];
  const DY = [0, 0, 1, -1, 1, -1, 1, -1];
  const COST = [1, 1, 1, 1, 1.42, 1.42, 1.42, 1.42];
  let guard = 0;

  while (nav.openN > 0 && guard++ < 2500) {
    const cur = heapPop(nav);
    if (cur === gIdx) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    for (let n = 0; n < 8; n++) {
      const nx = cx + DX[n], ny = cy + DY[n];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (!walk[ni] || closed[ni]) continue;
      if (n >= 4) {
        if (!walk[cy * cols + nx] || !walk[ny * cols + cx]) continue;
      }
      const tent = gScore[cur] + COST[n];
      if (tent >= gScore[ni]) continue;
      came[ni] = cur;
      gScore[ni] = tent;
      fScore[ni] = tent + Math.abs((gPack & 65535) - nx) + Math.abs((gPack >>> 16) - ny);
      heapPush(nav, ni);
    }
  }

  if (came[gIdx] < 0 && sIdx !== gIdx) return null;
  const CELL = nav.CELL;
  const path = [];
  let cur = gIdx, hops = 0;
  while (cur >= 0 && hops++ < 400) {
    path.push({
      x: (cur % cols) * CELL + CELL * 0.5,
      y: ((cur / cols) | 0) * CELL + CELL * 0.5
    });
    if (cur === sIdx) break;
    cur = came[cur];
  }
  path.reverse();
  if (path.length > 2) {
    const out = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      for (; j > i + 1; j--) {
        const a = path[i], b = path[j];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(2, (dist / 32) | 0);
        let ok = true;
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          if (solidHit(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 16)) { ok = false; break; }
        }
        if (ok) break;
      }
      out.push(path[j]);
      i = j;
    }
    return out;
  }
  return path;
}

function getPath(ent, tx, ty) {
  const nav = ensureNav();
  const now = performance.now();
  if (ent._path && ent._pathT && now - ent._pathT < 700) {
    if (ent._pathGoal && Math.hypot(ent._pathGoal.x - tx, ent._pathGoal.y - ty) < 100) return ent._path;
  }
  const CELL = nav.CELL;
  const path = astar(
    (ent.x / CELL) | 0, (ent.y / CELL) | 0,
    (tx / CELL) | 0, (ty / CELL) | 0,
    nav
  );
  ent._path = path;
  ent._pathGoal = { x: tx, y: ty };
  ent._pathT = now;
  ent._pathI = 0;
  return path;
}

function followPath(ent, speed) {
  const path = ent._path;
  if (!path || !path.length) {
    const dx = player.x - ent.x, dy = player.y - ent.y;
    const d = Math.hypot(dx, dy) || 1;
    ent.x += (dx / d) * speed * 0.35;
    ent.y += (dy / d) * speed * 0.35;
    if (typeof resolveEntitySolids === 'function') resolveEntitySolids(ent);
    return;
  }
  if (ent._pathI == null) ent._pathI = 0;
  while (ent._pathI < path.length - 1 && Math.hypot(path[ent._pathI].x - ent.x, path[ent._pathI].y - ent.y) < 30) {
    ent._pathI++;
  }
  const wp = path[Math.min(ent._pathI, path.length - 1)];
  const dx = wp.x - ent.x, dy = wp.y - ent.y;
  const d = Math.hypot(dx, dy) || 1;
  ent.x += (dx / d) * speed;
  ent.y += (dy / d) * speed;
  if (typeof resolveEntitySolids === 'function') resolveEntitySolids(ent);
}

function hearFalloff(dist, maxRange) {
  if (dist >= maxRange) return 0;
  const t = 1 - dist / maxRange;
  return t * t;
}

function raiseAlert(amount, x, y, reason) {
  const h = game.data.horror;
  h.lastNoise = { x: x, y: y, t: performance.now(), reason: reason, power: amount };

  const ranges = { dash: 900, bump: 650, run: 420, walk: 220 };
  const maxRange = ranges[reason] || 500;

  let bestHear = 0;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e) continue;
    const dist = Math.hypot(e.x - x, e.y - y);
    const fall = hearFalloff(dist, maxRange);
    if (fall <= 0) continue;
    const heard = amount * fall;
    e._hear = (e._hear || 0) + heard;
    if (e._hear > 100) e._hear = 100;
    bestHear = Math.max(bestHear, fall);
    if (heard >= 12) {
      e._investigate = { x: x, y: y };
      e._path = null;
    }
    if (e._hear >= 28 || heard >= 22) {
      e._alerted = true;
      e._chaseUntil = performance.now() + 4000 + e._hear * 35;
      e._path = null;
    }
  }

  if (boss) {
    const dist = Math.hypot(boss.x - x, boss.y - y);
    const fall = hearFalloff(dist, maxRange * 1.15);
    if (fall > 0) {
      const heard = amount * fall;
      boss._hear = Math.min(100, (boss._hear || 0) + heard);
      bestHear = Math.max(bestHear, fall);
      if (heard >= 10) {
        boss._investigate = { x: x, y: y };
        boss._path = null;
      }
      if (boss._hear >= 25 || heard >= 20) {
        boss._alerted = true;
        boss._chaseUntil = performance.now() + 5000 + boss._hear * 40;
        boss._path = null;
      }
    }
  }

  h.alert = Math.min(h.maxAlert, h.alert + amount * Math.max(0.15, bestHear));
  if (h.alert >= 35 || bestHear > 0.45 && amount >= 25) {
    h.chaseUntil = Math.max(h.chaseUntil, performance.now() + 5000 + h.alert * 35);
  }
}

function decayHearing() {
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e) continue;
    if (e._hear > 0) e._hear = Math.max(0, e._hear - 0.18);
    if (e._chaseUntil && performance.now() > e._chaseUntil) {
      e._alerted = false;
      e._chaseUntil = 0;
    }
  }
  if (boss) {
    if (boss._hear > 0) boss._hear = Math.max(0, boss._hear - 0.15);
    if (boss._chaseUntil && performance.now() > boss._chaseUntil) {
      boss._alerted = false;
      boss._chaseUntil = 0;
    }
  }
}

function listenPlayer() {
  const h = game.data.horror;
  if (!player) return;
  decayHearing();

  const dx = player.x - h.prevX;
  const dy = player.y - h.prevY;
  const moved = Math.hypot(dx, dy);
  h.prevX = player.x;
  h.prevY = player.y;

  if (player.dashCd && player.dashCd > (h.prevDash || 0) + 5) {
    playNoise('dash');
    raiseAlert(40, player.x, player.y, 'dash');
  }
  h.prevDash = player.dashCd || 0;

  if (moved > 2.5 && solidHit(player.x + dx * 2, player.y + dy * 2, player.r + 2)) {
    if (!h._bumpCd || performance.now() - h._bumpCd > 350) {
      h._bumpCd = performance.now();
      playNoise('bump');
      raiseAlert(28, player.x, player.y, 'bump');
    }
  }

  if (moved > 4.5) {
    raiseAlert(0.15, player.x, player.y, 'run');
  } else if (moved > 1.2) {
    raiseAlert(0.04, player.x, player.y, 'walk');
  } else {
    h.alert = Math.max(0, h.alert - 0.12);
  }
}

function isHidden() {
  if (!player) return false;
  const rooms = game.data.rooms;
  if (!rooms) return false;
  let inRoom = null;
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    if (player.x >= r.x && player.x <= r.x + r.w && player.y >= r.y && player.y <= r.y + r.h) {
      inRoom = r;
      break;
    }
  }
  if (!inRoom) return false;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e) continue;
    const same =
      e.x >= inRoom.x && e.x <= inRoom.x + inRoom.w &&
      e.y >= inRoom.y && e.y <= inRoom.y + inRoom.h;
    if (same) return false;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < 160) return false;
  }
  return true;
}

function chaseSpeed(ent, dist, base) {
  if (dist > 450) return base * 2.35;
  if (dist > 280) return base * 1.75;
  if (dist > 150) return base * 1.25;
  return base * 0.92;
}

function onUpdate() {
  if (!player) return;
  const h = game.data.horror;
  if (!h) return;

  listenPlayer();

  const now = performance.now();
  const chasing = now < h.chaseUntil;
  if (chasing && isHidden()) {
    h.hideTime = (h.hideTime || 0) + 16;
    if (h.hideTime > 2200) {
      h.chaseUntil = now;
      h.alert = Math.max(0, h.alert - 25);
      h.hideTime = 0;
      for (let i = 0; i < enemies.length; i++) {
        if (enemies[i]) enemies[i]._alerted = false;
      }
    }
  } else {
    h.hideTime = 0;
  }

  updateHorrorMusic(h.alert, chasing);

  if (!solids || !solids.length) return;
  const tick = (game.data.aiTick = (game.data.aiTick || 0) + 1);

  const list = [];
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e || e.stun > 0) continue;
    e._aiDist = (e.x - player.x) * (e.x - player.x) + (e.y - player.y) * (e.y - player.y);
    list.push(e);
  }
  list.sort((a, b) => a._aiDist - b._aiDist);

  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const dist = Math.sqrt(e._aiDist);
    const base = e.sp || e.base || 2.5;
    let tx = player.x, ty = player.y;
    let spd = base * 0.55;

    const npcChase = e._alerted || (e._chaseUntil && performance.now() < e._chaseUntil);
    if (chasing || npcChase || h.alert > 50) {
      if (h.lastNoise && dist > 200 && Math.random() < 0.02) {
        tx = h.lastNoise.x;
        ty = h.lastNoise.y;
      }
      spd = chaseSpeed(e, dist, base);
      if (npcChase || chasing) e._alerted = true;
    } else if (e._investigate) {
      tx = e._investigate.x;
      ty = e._investigate.y;
      spd = base * 0.85;
      if (Math.hypot(e.x - tx, e.y - ty) < 40) e._investigate = null;
    } else {
      spd = base * 0.4;
      if (tick % 90 === i % 90) {
        tx = e.x + (Math.random() - 0.5) * 220;
        ty = e.y + (Math.random() - 0.5) * 220;
      } else if (e._pathGoal) {
        tx = e._pathGoal.x;
        ty = e._pathGoal.y;
      }
    }

    if (i < 5 && (tick + i) % 3 === 0) getPath(e, tx, ty);
    else if (!e._path) getPath(e, tx, ty);
    followPath(e, spd);
  }

  if (boss && !(boss.stun > 0) && !boss.charging) {
    const dist = Math.hypot(boss.x - player.x, boss.y - player.y);
    let spd = 1.4;
    let tx = player.x, ty = player.y;
    if (chasing || h.alert > 40) {
      spd = chaseSpeed(boss, dist, 1.8 + (bossPhase || 1) * 0.25);
    } else {
      spd = 1.1;
    }
    if (tick % 4 === 0) getPath(boss, tx, ty);
    followPath(boss, spd);
  }
}

function onDraw() {
  const h = game.data.horror;
  if (!h || !player) return;

  const n = h.alert / h.maxAlert;
  const chasing = performance.now() < h.chaseUntil;

  if (n > 0.05 || chasing) {
    ctx.save();
    ctx.fillStyle = chasing
      ? 'rgba(120,0,0,' + (0.06 + n * 0.1) + ')'
      : 'rgba(40,0,20,' + (n * 0.08) + ')';
    const vw = (typeof W !== 'undefined' ? W : 900) / (cam.zoom || 1) + 80;
    const vh = (typeof H !== 'undefined' ? H : 1600) / (cam.zoom || 1) + 80;
    ctx.fillRect(cam.x - 40, cam.y - 40, vw, vh);
    ctx.restore();
  }

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e) continue;
    if (e._alerted || (e._chaseUntil && performance.now() < e._chaseUntil)) {
      ctx.strokeStyle = 'rgba(255,60,40,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, (e.r || 24) + 10 + Math.sin(performance.now() / 120) * 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e._hear > 8) {
      ctx.strokeStyle = 'rgba(255,180,60,' + Math.min(0.4, e._hear / 100) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, (e.r || 24) + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (h.lastNoise && performance.now() - h.lastNoise.t < 900) {
    const a = 1 - (performance.now() - h.lastNoise.t) / 900;
    ctx.strokeStyle = 'rgba(255,200,80,' + (a * 0.5) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(h.lastNoise.x, h.lastNoise.y, 20 + (1 - a) * 60, 0, Math.PI * 2);
    ctx.stroke();
  }
}
