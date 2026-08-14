/* js/mp/user-boss.js */
function startUserBossFlow(){
  if(statusEl){ statusEl.textContent='👑 Выбор юзер-босса…'; statusEl.style.color='#f6f'; }
  if(net.host){
    setTimeout(function(){
      if(!running || window.mpMode!=='userboss') return;
      const ids = [net.id];
      net.players.forEach(function(_,id){ ids.push(id); });
      const pick = ids[Math.floor(Math.random()*ids.length)];
      const name = pick===net.id
        ? (document.getElementById('playerNameInput')?.value||'Хост')
        : ((net.players.get(pick)||{}).name || 'Игрок');
      // full sync package
      sendNet({ type:'userboss', bossId: pick, name: name });
      applyUserBossRole(pick, name);
    }, 900);
  }
}

function applyUserBossRole(bossId, name){
  window.userBoss.active = true;
  window.userBoss.bossId = bossId;
  window.userBoss.isMe = (bossId === net.id);
  window.userBoss.name = name || 'Босс';
  window.userBoss.abilities = [];
  window.userBoss.cd = {};
  window.userBoss.pickDone = false;
  // Сразу создаём босса у ВСЕХ — чтобы моделька была видна
  try {
    if(!bossMode) startBoss();
    if(boss){
      boss.userControlled = true;
      boss.lastTeleport = performance.now() + 9e9;
      boss.lastPhantom = performance.now() + 9e9;
      boss.lastNpcSpawn = performance.now() + 9e9;
      boss.hp = boss.maxHp = Math.max(boss.maxHp||630, 800);
    }
    if(bossHpEl) bossHpEl.style.display = 'block';
  } catch(e){}
  if(window.userBoss.isMe) openUserBossPick();
  else if(statusEl){
    statusEl.textContent = '👑 Босс: ' + window.userBoss.name + ' (выбор способностей…)';
    statusEl.style.color = '#f6f';
  }
}

function openUserBossPick(){
  const scr = document.getElementById('userBossPick');
  const list = document.getElementById('ubPickList');
  if(!scr||!list) return;
  // clear enemies while picking
  enemies = [];
  list.innerHTML = UB_ABILITIES.map(function(a){
    return '<label style="display:flex;gap:10px;align-items:flex-start;background:#1a1a1a;border:1px solid #444;border-radius:12px;padding:10px;cursor:pointer">'
      +'<input type="checkbox" data-ub="'+a.id+'" style="width:18px;height:18px;margin-top:2px;accent-color:#f44">'
      +'<span><b style="color:#fff">'+a.name+'</b><br><span style="color:#888;font-size:12px">'+a.desc+'</span></span></label>';
  }).join('');
  list.querySelectorAll('input[data-ub]').forEach(function(cb){
    cb.addEventListener('change', function(){
      const checked = list.querySelectorAll('input[data-ub]:checked');
      if(checked.length > 4){
        cb.checked = false;
        if(statusEl){ statusEl.textContent='Максимум 4 способности'; statusEl.style.color='#f88'; }
      }
    });
  });
  scr.classList.remove('hidden');
}

function confirmUserBossPick(){
  const chosen = [];
  document.querySelectorAll('#ubPickList input[data-ub]').forEach(function(b){
    if(b.checked) chosen.push(b.getAttribute('data-ub'));
  });
  if(!chosen.length){ alert('Выбери хотя бы 1 способность'); return; }
  if(chosen.length > 4){ alert('Максимум 4'); return; }
  window.userBoss.abilities = chosen.slice();
  window.userBoss.pickDone = true;
  document.getElementById('userBossPick')?.classList.add('hidden');

  // SYNC abilities to entire room BEFORE fight starts
  sendNet({
    type: 'ub_abilities',
    bossId: net.id,
    name: (document.getElementById('playerNameInput')?.value||'Босс').slice(0,16),
    abilities: chosen
  });
  onUserBossAbilitiesReady(net.id, chosen, window.userBoss.name);
}

function onUserBossAbilitiesReady(bossId, abilities, name){
  window.userBoss.active = true;
  window.userBoss.bossId = bossId;
  window.userBoss.isMe = (bossId === net.id);
  window.userBoss.abilities = (abilities||[]).slice();
  window.userBoss.pickDone = true;
  window.userBoss.name = name || window.userBoss.name || 'Босс';

  enemies = [];
  if(!bossMode) startBoss();
  if(boss){
    boss.userControlled = true;
    boss.r = 55;
    boss.hp = boss.maxHp = Math.max(boss.maxHp||630, 800);
    boss.lastTeleport = performance.now() + 999999;
    boss.lastPhantom = performance.now() + 999999;
    boss.lastNpcSpawn = performance.now() + 999999;
  }
  // stop pure AI spam for user boss: mark phase
  if(window.userBoss.isMe){
    showUserBossBar();
    if(statusEl){ statusEl.textContent='👑 Ты босс! Способности синхронизированы'; statusEl.style.color='#f6f'; }
  } else {
    if(statusEl){
      statusEl.textContent='⚔ Босс '+window.userBoss.name+' · '+window.userBoss.abilities.join(', ');
      statusEl.style.color='#f6f';
    }
  }
  if(bossHpEl) bossHpEl.style.display='block';
}

function showUserBossBar(){
  const bar = document.getElementById('userBossBar');
  if(!bar) return;
  bar.innerHTML = '';
  bar.style.display = 'flex';
  window.userBoss.abilities.forEach(function(id){
    const def = UB_ABILITIES.find(function(a){ return a.id===id; });
    const btn = document.createElement('button');
    btn.className = 'ub-atk';
    btn.setAttribute('data-atk', id);
    btn.textContent = def ? def.name : id;
    btn.style.cssText = 'padding:10px 12px;border-radius:12px;border:1px solid #f6a;background:rgba(80,20,60,.85);color:#fff;font-size:12px;font-weight:700;cursor:pointer';
    btn.onclick = function(){ fireUserBossAtk(id); };
    bar.appendChild(btn);
  });
}

function aimAngleFromBoss(){
  if(!boss) return 0;
  let ang = Math.atan2(mouse.y - boss.y, mouse.x - boss.x);
  try {
    if(typeof joyVec!=='undefined' && joyVec && (Math.abs(joyVec.x)>0.2||Math.abs(joyVec.y)>0.2))
      ang = Math.atan2(joyVec.y, joyVec.x);
  } catch(e){}
  return ang;
}

function fireUserBossAtk(id){
  if(!window.userBoss.isMe || !boss || !bossMode) return;
  const def = UB_ABILITIES.find(function(a){ return a.id===id; });
  const now = performance.now();
  if((window.userBoss.cd[id]||0) > now) return;
  window.userBoss.cd[id] = now + ((def && def.cd) || 1500);
  const ang = aimAngleFromBoss();
  const payload = {
    type: 'ub_atk',
    from: net.id,
    atk: id,
    ang: ang,
    x: boss.x,
    y: boss.y,
    t: now
  };
  // local predict
  doUserBossAtk(payload);
  // sync to others
  sendNet(payload);
  // update bar cooldown visual
  const btn = document.querySelector('#userBossBar [data-atk="'+id+'"]');
  if(btn){
    btn.style.opacity = '0.45';
    setTimeout(function(){ btn.style.opacity='1'; }, (def&&def.cd)||1500);
  }
}

function doUserBossAtk(p){
  if(!p || !boss) return;
  // ignore duplicate from self if already predicted — still ok to run once from network for others
  const id = p.atk, ang = p.ang, x = p.x, y = p.y;
  // snap boss pos from authority if remote
  if(!window.userBoss.isMe && typeof x==='number'){ boss.x = x; boss.y = y; }
  if(id==='fan'){
    for(let i=-2;i<=2;i++){
      const a = ang + i*0.18;
      shitBalls.push({x:x,y:y,vx:Math.cos(a)*7,vy:Math.sin(a)*7,r:10,life:120,fromUserBoss:true});
    }
  } else if(id==='ring'){
    for(let i=0;i<12;i++){
      const a=(i/12)*Math.PI*2;
      shitBalls.push({x:x,y:y,vx:Math.cos(a)*5.5,vy:Math.sin(a)*5.5,r:9,life:100,fromUserBoss:true});
    }
  } else if(id==='spiral'){
    for(let i=0;i<10;i++){
      const a = ang + i*0.45;
      shitBalls.push({x:x,y:y,vx:Math.cos(a)*(4+i*0.25),vy:Math.sin(a)*(4+i*0.25),r:8,life:110,fromUserBoss:true});
    }
  } else if(id==='laser'){
    lasers.push({x:x,y:y,ang:ang,life:50,warning:false,width:14,fromUserBoss:true});
  } else if(id==='charge'){
    boss.charging=true; boss.chargeTime=28;
    boss.chargeVx=Math.cos(ang)*11; boss.chargeVy=Math.sin(ang)*11;
  } else if(id==='summon'){
    const ex=x+Math.cos(ang)*90, ey=y+Math.sin(ang)*90;
    const mark=function(e){ if(e){ e.fromUserBoss=true; e.fromBoss=true; } return e; };
    if(typeof makeEnemy==='function'){
      try { const e=makeEnemy(ex,ey); if(e){ e.hp=Math.min(e.hp||100,80); mark(e); enemies.push(e);} } catch(err){
        enemies.push(mark({x:ex,y:ey,r:22,hp:80,maxHp:80,sp:2.5,base:2.2,size:1}));
      }
    } else enemies.push(mark({x:ex,y:ey,r:22,hp:80,maxHp:80,sp:2.5,base:2.2,size:1}));
  } else if(id==='tarantula'){
    tarantulas.push({x:x+Math.cos(ang)*40,y:y+Math.sin(ang)*40,r:16,life:400,fromUserBoss:true});
  } else if(id==='phantom'){
    if(typeof spawnBossPhantom==='function'){
      spawnBossPhantom({forceSpin:true});
      if(phantoms.length) phantoms[phantoms.length-1].fromUserBoss = true;
    }
  }
  shake = Math.max(shake, 8);
}

// user-boss sends own boss transform so everyone sees movement

/** Все клиенты: применить пакет босса (позиция + модель + роль) */
function applyRemoteUserBossState(data){
  if(!data || data.id === net.id) return;
  const bossId = data.bossId || data.id;
  window.userBoss.active = true;
  window.userBoss.bossId = bossId;
  window.userBoss.isMe = false;
  window.userBoss.pickDone = true;
  if(data.name) window.userBoss.name = data.name;
  if(Array.isArray(data.abilities) && data.abilities.length) window.userBoss.abilities = data.abilities.slice();
  if(!bossMode || !boss){
    try { startBoss(); } catch(e){}
  }
  if(!boss) return;
  boss.userControlled = true;
  // AI off
  boss.lastTeleport = performance.now() + 9e9;
  boss.lastPhantom = performance.now() + 9e9;
  boss.lastNpcSpawn = performance.now() + 9e9;
  if(Number.isFinite(data.x)) { boss.x = data.x; boss._tx = data.x; }
  if(Number.isFinite(data.y)) { boss.y = data.y; boss._ty = data.y; }
  if(Number.isFinite(data.bossHp)) boss.hp = data.bossHp;
  else if(Number.isFinite(data.hp) && data.hp > 100) boss.hp = data.hp;
  if(Number.isFinite(data.bossMaxHp)) boss.maxHp = data.bossMaxHp;
  else if(Number.isFinite(data.maxHp)) boss.maxHp = data.maxHp;
  if(Number.isFinite(data.phase)) bossPhase = data.phase;
  boss.charging = !!data.charging;
  if(bossHpEl) bossHpEl.style.display = 'block';
  enemies = []; // no classic NPC agro on boss map for spectators of user-boss
}

function syncUserBossState(){
  if(!net.active || !window.userBoss.isMe || !boss || !bossMode) return;
  const name = (document.getElementById('playerNameInput')?.value || window.userBoss.name || 'Босс').slice(0,16);
  // Главный канал — state (сервер ВСЕГДА ретранслирует)
  sendNet({
    type: 'state',
    x: boss.x,
    y: boss.y,
    hp: 100,
    bossHp: boss.hp,
    bossMaxHp: boss.maxHp,
    maxHp: boss.maxHp,
    alive: true,
    isBoss: true,
    bossId: net.id,
    name: name,
    abilities: window.userBoss.abilities || [],
    phase: bossPhase,
    charging: !!boss.charging
  });
  // дубли на случай старых клиентов
  sendNet({
    type:'ub_state', from: net.id,
    x: boss.x, y: boss.y, hp: boss.hp, maxHp: boss.maxHp,
    phase: bossPhase, charging: !!boss.charging, abilities: window.userBoss.abilities
  });
  sendNet({ type:'boss', from:net.id, x:boss.x, y:boss.y, hp:boss.hp, maxHp:boss.maxHp, phase:bossPhase });
}


