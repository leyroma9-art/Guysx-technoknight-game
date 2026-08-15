/* js/mp/user-boss.js — user-controlled boss mode */

var UB_ABILITIES = [
  { id: 'charge',   name: 'Рывок',           desc: 'Быстрый рывок вперёд' },
  { id: 'teleport', name: 'Телепорт',        desc: 'Телепорт к цели с предупреждением' },
  { id: 'phantom',  name: 'Фантом',          desc: 'Призыв вращающихся фантомов' },
  { id: 'laser',    name: 'Лазер',           desc: 'Луч по направлению взгляда' },
  { id: 'shield',   name: 'Щит',             desc: 'Временная защита от урона' },
  { id: 'spawn',    name: 'Призыв',          desc: 'Призвать технокнайтов' },
  { id: 'slam',     name: 'Удар',            desc: 'Удар по площади вокруг' },
  { id: 'heal',     name: 'Лечение',         desc: 'Восстановить часть ХП' }
];

function startUserBossFlow(){
  if(statusEl){ statusEl.textContent='👑 Выбор юзер-босса…'; statusEl.style.color='#f6f'; }
  // pause combat until pick is done
  window.userBoss = window.userBoss || {};
  window.userBoss.active = true;
  window.userBoss.pickDone = false;
  window.userBoss.abilities = [];
  window.userBoss.cd = {};
  if(net.host){
    setTimeout(function(){
      if(!running || window.mpMode!=='userboss') return;
      var ids = [net.id];
      net.players.forEach(function(_,id){ if(ids.indexOf(id)<0) ids.push(id); });
      var pick = ids[Math.floor(Math.random()*ids.length)];
      var name = pick===net.id
        ? ((document.getElementById('playerNameInput')||{}).value||'Хост').slice(0,16)
        : (((net.players.get(pick)||{}).name)||'Игрок').slice(0,16);
      sendNet({ type:'userboss', bossId: pick, name: name });
      applyUserBossRole(pick, name);
    }, 700);
  }
}

function applyUserBossRole(bossId, name){
  window.userBoss = window.userBoss || {};
  window.userBoss.active = true;
  window.userBoss.bossId = bossId;
  window.userBoss.isMe = (bossId === net.id);
  window.userBoss.name = name || 'Босс';
  window.userBoss.abilities = [];
  window.userBoss.cd = {};
  window.userBoss.pickDone = false;

  // stop combat noise while picking
  try {
    enemies = [];
    phantoms = [];
    lasers = [];
    npcMarkers = [];
  } catch(e){}

  // Create boss entity visible to everyone, but freeze AI until pickDone
  try {
    if(!bossMode) startBoss();
    if(boss){
      boss.userControlled = true;
      boss.lastTeleport = performance.now() + 9e9;
      boss.lastPhantom = performance.now() + 9e9;
      boss.lastNpcSpawn = performance.now() + 9e9;
      boss.hp = boss.maxHp = Math.max(boss.maxHp||630, 800);
      boss.stun = 9999; // freeze until abilities picked
    }
    if(bossHpEl) bossHpEl.style.display = 'block';
  } catch(e){ console.warn('[ub] startBoss', e); }

  if(window.userBoss.isMe){
    // delay one frame so DOM is ready
    setTimeout(function(){ openUserBossPick(); }, 50);
  } else if(statusEl){
    statusEl.textContent = '👑 Босс: ' + window.userBoss.name + ' (выбор способностей…)';
    statusEl.style.color = '#f6f';
  }
}

function openUserBossPick(){
  var scr = document.getElementById('userBossPick');
  var list = document.getElementById('ubPickList');
  if(!scr || !list){
    console.error('[ub] pick UI missing in DOM');
    // fallback: auto-pick first 2 abilities so game is not stuck
    confirmUserBossPickForced(['charge','shield']);
    return;
  }
  try { enemies = []; } catch(e){}
  list.innerHTML = UB_ABILITIES.map(function(a){
    return '<label style="display:flex;gap:10px;align-items:flex-start;background:#1a1a1a;border:1px solid #444;border-radius:12px;padding:10px;cursor:pointer;width:100%;box-sizing:border-box">'
      +'<input type="checkbox" data-ub="'+a.id+'" style="width:18px;height:18px;margin-top:2px;accent-color:#f44;flex-shrink:0">'
      +'<span style="text-align:left"><b style="color:#fff">'+a.name+'</b><br><span style="color:#888;font-size:12px">'+a.desc+'</span></span></label>';
  }).join('');
  list.querySelectorAll('input[data-ub]').forEach(function(cb){
    cb.addEventListener('change', function(){
      var checked = list.querySelectorAll('input[data-ub]:checked');
      if(checked.length > 4){
        cb.checked = false;
        if(statusEl){ statusEl.textContent='Максимум 4 способности'; statusEl.style.color='#f88'; }
      }
    });
  });
  // FORCE visible over canvas (hidden uses display:none !important)
  scr.classList.remove('hidden');
  scr.style.cssText = 'display:flex!important;flex-direction:column;align-items:center;justify-content:flex-start;position:absolute;inset:0;z-index:250;background:rgba(0,0,0,.96);pointer-events:auto;padding:calc(16px + env(safe-area-inset-top)) 12px calc(30px + env(safe-area-inset-bottom));overflow-y:auto;text-align:center';
  if(statusEl){ statusEl.textContent='👑 Выбери способности и нажми ГОТОВ'; statusEl.style.color='#f6f'; }
}

function confirmUserBossPickForced(ids){
  window.userBoss.abilities = (ids||['charge','shield']).slice(0,4);
  window.userBoss.pickDone = true;
  var scr = document.getElementById('userBossPick');
  if(scr){ scr.classList.add('hidden'); scr.style.display='none'; }
  sendNet({
    type: 'ub_abilities',
    bossId: net.id,
    name: ((document.getElementById('playerNameInput')||{}).value||'Босс').slice(0,16),
    abilities: window.userBoss.abilities
  });
  onUserBossAbilitiesReady(net.id, window.userBoss.abilities, window.userBoss.name);
}

function confirmUserBossPick(){
  var chosen = [];
  document.querySelectorAll('#ubPickList input[data-ub]').forEach(function(b){
    if(b.checked) chosen.push(b.getAttribute('data-ub'));
  });
  if(!chosen.length){ alert('Выбери хотя бы 1 способность'); return; }
  if(chosen.length > 4){ alert('Максимум 4'); return; }
  window.userBoss.abilities = chosen.slice();
  window.userBoss.pickDone = true;
  var scr = document.getElementById('userBossPick');
  if(scr){ scr.classList.add('hidden'); scr.style.display = 'none'; }

  sendNet({
    type: 'ub_abilities',
    bossId: net.id,
    name: ((document.getElementById('playerNameInput')||{}).value||'Босс').slice(0,16),
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
  window.userBoss.cd = {};

  try { enemies = []; } catch(e){}
  try {
    if(!bossMode) startBoss();
    if(boss){
      boss.userControlled = true;
      boss.r = 55;
      boss.hp = boss.maxHp = Math.max(boss.maxHp||630, 800);
      boss.stun = 0; // unfreeze
      boss.lastTeleport = performance.now() + 9e9;
      boss.lastPhantom = performance.now() + 9e9;
      boss.lastNpcSpawn = performance.now() + 9e9;
    }
  } catch(e){ console.warn('[ub] ready boss', e); }

  if(window.userBoss.isMe){
    showUserBossBar();
    if(statusEl){ statusEl.textContent='👑 Ты босс! Способности готовы'; statusEl.style.color='#f6f'; }
  } else {
    if(statusEl){
      statusEl.textContent='⚔ Босс '+window.userBoss.name+' · '+(window.userBoss.abilities.join(', ')||'');
      statusEl.style.color='#f6f';
    }
  }
  if(bossHpEl) bossHpEl.style.display='block';
}

function showUserBossBar(){
  var bar = document.getElementById('userBossBar');
  if(!bar) return;
  bar.innerHTML = '';
  bar.style.display = 'flex';
  (window.userBoss.abilities||[]).forEach(function(id){
    var def = UB_ABILITIES.find(function(a){ return a.id===id; });
    if(!def) return;
    var btn = document.createElement('button');
    btn.className = 'ub-abil';
    btn.dataset.ub = id;
    btn.textContent = def.name;
    btn.style.cssText = 'padding:10px 14px;border-radius:12px;border:1px solid #666;background:#2a1a2a;color:#fff;font-weight:700;cursor:pointer;pointer-events:auto';
    btn.onclick = function(e){
      e.preventDefault(); e.stopPropagation();
      useUserBossAbility(id);
    };
    bar.appendChild(btn);
  });
}

function useUserBossAbility(id){
  if(!window.userBoss || !window.userBoss.isMe || !window.userBoss.pickDone) return;
  if(!boss || !bossMode) return;
  var now = performance.now();
  var cd = window.userBoss.cd || (window.userBoss.cd={});
  if(cd[id] && now < cd[id]) return;
  var def = UB_ABILITIES.find(function(a){ return a.id===id; });
  // default CD 4s
  cd[id] = now + 4000;

  if(id==='charge'){
    var ang = Math.atan2(
      (typeof joyVec!=='undefined' && joyVec && (joyVec.x||joyVec.y)) ? joyVec.y : 0,
      (typeof joyVec!=='undefined' && joyVec && (joyVec.x||joyVec.y)) ? joyVec.x : 1
    );
    boss.charging = true;
    boss.chargeTime = 22;
    boss.chargeVx = Math.cos(ang)*14;
    boss.chargeVy = Math.sin(ang)*14;
    if(statusEl){ statusEl.textContent='⚡ РЫВОК!!!'; statusEl.style.color='#ff0'; }
  } else if(id==='teleport'){
    var tx = player ? player.x : boss.x;
    var ty = player ? player.y : boss.y;
    // for user-boss, teleport near current aim / random offset
    var a = Math.random()*Math.PI*2, d = 120+Math.random()*180;
    boss.x = Math.max(boss.r, Math.min(world-boss.r, boss.x + Math.cos(a)*d));
    boss.y = Math.max(boss.r, Math.min(world-boss.r, boss.y + Math.sin(a)*d));
    try { for(var k=0;k<8;k++) spawnP(boss.x, boss.y, '#f6f', 5); } catch(e){}
    if(statusEl){ statusEl.textContent='⚠ ТЕЛЕПОРТ!!!'; statusEl.style.color='#ff0'; }
  } else if(id==='phantom'){
    try {
      if(typeof spawnPhantom==='function') spawnPhantom(boss.x, boss.y);
      else if(typeof phantoms!=='undefined'){
        phantoms.push({x:boss.x,y:boss.y,ang:0,life:180,fromUserBoss:true});
      }
    } catch(e){}
    if(statusEl){ statusEl.textContent='👻 ФАНТОМ!!!'; statusEl.style.color='#f6f'; }
  } else if(id==='laser'){
    try {
      var lx = boss.x, ly = boss.y;
      var lang = Math.atan2((player?player.y:ly)-ly, (player?player.x:lx+1)-lx);
      if(typeof lasers!=='undefined') lasers.push({x:lx,y:ly,ang:lang,life:40,fromUserBoss:true});
    } catch(e){}
    if(statusEl){ statusEl.textContent='🔴 ЛАЗЕР!!!'; statusEl.style.color='#f44'; }
  } else if(id==='shield'){
    boss.shield = 180;
    if(statusEl){ statusEl.textContent='🛡 ЩИТ!!!'; statusEl.style.color='#8cf'; }
  } else if(id==='spawn'){
    try {
      for(var i=0;i<3;i++){
        var ang2 = Math.random()*Math.PI*2, dist=100+Math.random()*80;
        if(typeof npcMarkers!=='undefined'){
          npcMarkers.push({x:boss.x+Math.cos(ang2)*dist, y:boss.y+Math.sin(ang2)*dist, life:40, size:1});
        }
      }
    } catch(e){}
    if(statusEl){ statusEl.textContent='⚠ ПРИЗЫВ!!!'; statusEl.style.color='#f80'; }
  } else if(id==='slam'){
    try {
      shake = Math.max(shake||0, 14);
      for(var j=0;j<12;j++) spawnP(boss.x, boss.y, '#f84', 6);
      // damage nearby hunters via net
      if(typeof sendNet==='function'){
        sendNet({ type:'pvp_hit', target:'all_hunters', dmg:18, from: net.id, kind:'slam' });
      }
    } catch(e){}
    if(statusEl){ statusEl.textContent='💥 УДАР!!!'; statusEl.style.color='#f84'; }
  } else if(id==='heal'){
    boss.hp = Math.min(boss.maxHp, boss.hp + Math.floor(boss.maxHp*0.12));
    if(statusEl){ statusEl.textContent='💚 ЛЕЧЕНИЕ'; statusEl.style.color='#5f5'; }
  }

  // broadcast attack
  try {
    sendNet({
      type: 'ub_atk',
      from: net.id,
      ability: id,
      x: boss.x, y: boss.y,
      hp: boss.hp
    });
  } catch(e){}
}

function applyRemoteUserBossState(data){
  if(!data) return;
  if(!bossMode || !boss){
    try { if(!bossMode) startBoss(); } catch(e){}
  }
  if(!boss) return;
  if(typeof data.x==='number') boss.x = data.x;
  if(typeof data.y==='number') boss.y = data.y;
  if(typeof data.hp==='number') boss.hp = data.hp;
  if(typeof data.maxHp==='number') boss.maxHp = data.maxHp;
  if(typeof data.phase==='number') bossPhase = data.phase;
  if(typeof data.charging==='boolean') boss.charging = data.charging;
  if(Array.isArray(data.abilities) && data.abilities.length) window.userBoss.abilities = data.abilities.slice();
  boss.userControlled = true;
}

function syncUserBossState(){
  if(!net || !net.active || !window.userBoss || !window.userBoss.isMe || !boss) return;
  sendNet({
    type:'ub_state', from: net.id,
    x: boss.x, y: boss.y, hp: boss.hp, maxHp: boss.maxHp,
    phase: bossPhase, charging: !!boss.charging, abilities: window.userBoss.abilities
  });
}

// expose globals
window.UB_ABILITIES = UB_ABILITIES;
window.startUserBossFlow = startUserBossFlow;
window.applyUserBossRole = applyUserBossRole;
window.openUserBossPick = openUserBossPick;
window.confirmUserBossPick = confirmUserBossPick;
window.onUserBossAbilitiesReady = onUserBossAbilitiesReady;
window.showUserBossBar = showUserBossBar;
window.useUserBossAbility = useUserBossAbility;
window.applyRemoteUserBossState = applyRemoteUserBossState;
window.syncUserBossState = syncUserBossState;

function applyRemoteUbAtk(data){
  if(!data) return;
  try {
    if(boss && typeof data.x==='number'){ boss.x = data.x; boss.y = data.y; }
    if(boss && typeof data.hp==='number') boss.hp = data.hp;
    var id = data.ability;
    if(id==='shield' && boss) boss.shield = 120;
    if(id==='phantom'){
      try {
        if(typeof phantoms!=='undefined') phantoms.push({x:boss?boss.x:data.x,y:boss?boss.y:data.y,ang:0,life:120,fromUserBoss:true});
      } catch(e){}
    }
    if(id==='slam'){
      try { shake = Math.max(shake||0, 10); for(var i=0;i<8;i++) spawnP(data.x||0, data.y||0, '#f84', 5); } catch(e){}
    }
    if(statusEl && id){ statusEl.textContent = '👑 '+String(id).toUpperCase(); statusEl.style.color='#f6f'; }
  } catch(e){ console.warn('[ub] remote atk', e); }
}
window.applyRemoteUbAtk = applyRemoteUbAtk;

