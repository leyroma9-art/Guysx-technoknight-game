/* js/mp/net.js — optimized WebSocket + lobby */
var net = window.net;

var _roomListTimer = null;
var _roomListBusy = false;
var _lastListAt = 0;
var _lastStateSent = { x:0, y:0, hp:0, t:0 };

function sendNet(message){
  try {
    if(net && net.socket && net.socket.readyState === WebSocket.OPEN){
      net.socket.send(JSON.stringify(message));
    }
  } catch(e){}
}

function setRoomStatus(text, isErr){
  try {
    var el = document.getElementById('roomStatus');
    if(!el) return;
    el.textContent = text || '';
    el.style.color = isErr ? '#f66' : '';
  } catch(e){}
}

function wsUrl(){
  var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var host = location.host || 'localhost:8080';
  return protocol + '//' + host + '/ws';
}

/* ===== LOBBY LIST ===== */
function renderOpenRooms(rooms){
  var box = document.getElementById('openRoomsList');
  if(!box) return;
  var list = Array.isArray(rooms) ? rooms : [];
  if(!list.length){
    box.innerHTML = '<div class="room-list-empty">Нет открытых комнат</div>';
    return;
  }
  var html = '';
  for(var i=0;i<list.length;i++){
    var r = list[i];
    var code = String(r.code || r.room || '').toUpperCase();
    if(!code) continue;
    var count = r.count != null ? r.count : (r.players != null ? r.players : '?');
    var host = r.hostName || r.host || r.name || '';
    var mode = r.mode || (r.config && r.config.mode) || 'boss';
    var modeTag = mode==='empty' ? '🏠' : (mode==='userboss' ? '👑' : '⚔');
    var meta = modeTag + ' ' + count + ' игр.' + (host ? ' · ' + host : '');
    html += '<div class="room-list-item" data-code="'+code+'"><span class="rc">'+code+'</span><span class="rmeta">'+meta+'</span></div>';
  }
  box.innerHTML = html || '<div class="room-list-empty">Нет открытых комнат</div>';
  var items = box.querySelectorAll('.room-list-item');
  for(var j=0;j<items.length;j++){
    items[j].onclick = function(){
      var code = this.getAttribute('data-code');
      if(!code) return;
      var inp = document.getElementById('roomCodeInput');
      if(inp) inp.value = code;
      connectRoom(code, false);
    };
  }
}

function requestRoomList(){
  var now = Date.now();
  if(_roomListBusy && now - _lastListAt < 1500) return;
  _roomListBusy = true;
  _lastListAt = now;
  try {
    // Prefer active game socket
    if(net.socket && net.socket.readyState === WebSocket.OPEN){
      sendNet({type:'list'});
      _roomListBusy = false;
      return;
    }
    // Short-lived list socket
    var s = new WebSocket(wsUrl());
    var done = false;
    var finish = function(){
      if(done) return;
      done = true;
      _roomListBusy = false;
      try { s.close(); } catch(e){}
    };
    s.onopen = function(){ try { s.send(JSON.stringify({type:'list'})); } catch(e){ finish(); } };
    s.onmessage = function(ev){
      var data;
      try { data = JSON.parse(ev.data); } catch(e){ return; }
      if(data.type === 'rooms' || data.type === 'list'){
        renderOpenRooms(data.rooms || data.list || []);
        finish();
      }
    };
    s.onerror = function(){
      var box = document.getElementById('openRoomsList');
      if(box && !box.querySelector('.room-list-item')){
        box.innerHTML = '<div class="room-list-empty">Сервер недоступен</div>';
      }
      finish();
    };
    s.onclose = function(){ finish(); };
    setTimeout(finish, 4000);
  } catch(e){
    _roomListBusy = false;
  }
}

function fetchOpenRooms(force){
  if(force) _lastListAt = 0;
  requestRoomList();
}

function startRoomListPoll(){
  stopRoomListPoll();
  requestRoomList();
  _roomListTimer = setInterval(function(){
    // only poll while lobby is visible
    var rs = document.getElementById('roomScreen');
    if(!rs || rs.classList.contains('hidden')) return;
    if(net.active) return;
    requestRoomList();
  }, 5000);
}

function stopRoomListPoll(){
  if(_roomListTimer){ clearInterval(_roomListTimer); _roomListTimer = null; }
}

/* ===== LEAVE / CONFIG ===== */
function leaveMultiplayer(){
  try { if(net && net.socket) net.socket.close(); } catch(e){}
  try {
    if(net && net.savedMods){
      mods = net.savedMods;
      bossMods = net.savedBossMods;
      if(typeof compileUserMod === 'function') compileUserMod();
    }
  } catch(e){}
  try {
    if(net){
      net.socket = null;
      net.active = false;
      net.room = '';
      net.id = '';
      net.host = false;
      if(net.players && net.players.clear) net.players.clear();
      net.config = null;
      net.savedMods = null;
      net.savedBossMods = null;
      net.lastSend = 0;
    }
  } catch(e){}
  _lastStateSent = { x:0, y:0, hp:0, t:0 };
  try { if(typeof roomHudEl!=='undefined' && roomHudEl) roomHudEl.textContent = ''; } catch(e){}
  try {
    hideMpExtras();
    window.mpMode = 'boss';
    window.userBoss = { active:false, bossId:null, isMe:false, abilities:[], cd:{}, pickDone:false, name:'' };
  } catch(e){}
}

function roomConfig(){
  var syncCode = !document.getElementById('roomSyncCode') || document.getElementById('roomSyncCode').checked;
  var modeEl = document.querySelector('input[name="roomMode"]:checked');
  var mode = (modeEl && modeEl.value) || 'boss';
  var v1 = null, v2 = null;
  try {
    if(document.getElementById('roomMods1') && document.getElementById('roomMods1').checked){
      v1 = {
        playerSpeed:mods.playerSpeed, playerSize:mods.playerSize, mapSize:mods.mapSize,
        weaponAmmo:mods.weaponAmmo, weaponFireRate:mods.weaponFireRate, weaponBullets:mods.weaponBullets,
        weaponSpread:mods.weaponSpread, giveWeaponOnStart:mods.giveWeaponOnStart, playerDash:mods.playerDash,
        npcCount:mods.npcCount, npcHp:mods.npcHp, npcName:mods.npcName, npcIsBoss:mods.npcIsBoss,
        weaponChance:mods.weaponChance, deathTexts:mods.deathTexts,
        customCode: syncCode ? (mods.customCode || '') : undefined
      };
    }
  } catch(e){}
  try {
    if(document.getElementById('roomMods2') && document.getElementById('roomMods2').checked){
      v2 = {
        bossHp:bossMods.bossHp, projMult:bossMods.projMult, attackInterval:bossMods.attackInterval,
        atkWeights:bossMods.atkWeights, shieldChance:bossMods.shieldChance,
        shieldDuration:bossMods.shieldDuration, shieldCooldown:bossMods.shieldCooldown,
        bossCount:1, skipToBoss:bossMods.skipToBoss, skipCutscene:bossMods.skipCutscene,
        phase1:bossMods.phase1, phase2:bossMods.phase2, phase3:bossMods.phase3, phase4:bossMods.phase4,
        phase2Hp:bossMods.phase2Hp, phase3Hp:bossMods.phase3Hp, phase4Hp:bossMods.phase4Hp,
        phantomSpin:bossMods.phantomSpin
      };
    }
  } catch(e){}
  return {
    mode: mode,
    open: !!(document.getElementById('roomOpen') && document.getElementById('roomOpen').checked),
    v1: v1,
    v2: v2,
    infiniteAmmo: !!(document.getElementById('roomInfiniteAmmo') && document.getElementById('roomInfiniteAmmo').checked),
    giants: !!(document.getElementById('roomGiants') && document.getElementById('roomGiants').checked)
  };
}

/* ===== DELTA STATE SEND (cheaper bandwidth) ===== */
function sendPlayerState(force){
  if(!net || !net.active || !player) return;
  var now = Date.now();
  if(!force && now - net.lastSend < 50) return;
  var x = player.x|0, y = player.y|0, hp = player.hp|0;
  var moved = Math.abs(x - _lastStateSent.x) > 2 || Math.abs(y - _lastStateSent.y) > 2;
  var hpChanged = hp !== _lastStateSent.hp;
  if(!force && !moved && !hpChanged && now - _lastStateSent.t < 400) return;
  net.lastSend = now;
  _lastStateSent = { x:x, y:y, hp:hp, t:now };
  var name = '';
  try { name = (document.getElementById('playerNameInput')?.value || 'Игрок').slice(0,16); } catch(e){ name = 'Игрок'; }
  sendNet({ type:'state', x:player.x, y:player.y, hp:player.hp, alive:player.hp>0, name:name });
  if(net.host && boss && !(window.userBoss && window.userBoss.active)){
    sendNet({ type:'boss', x:boss.x, y:boss.y, hp:boss.hp, maxHp:boss.maxHp, phase:bossPhase });
  }
  if(window.userBoss && window.userBoss.isMe && window.userBoss.pickDone && typeof syncUserBossState === 'function'){
    try { syncUserBossState(); } catch(e){}
  }
}

/* ===== CONNECT ===== */
function connectRoom(rawCode, create){
  var code = String(rawCode || '').trim().toUpperCase();
  var nameEl = document.getElementById('playerNameInput');
  var name = ((nameEl && nameEl.value.trim()) || 'Игрок').slice(0,16);
  if(!/^[A-Z0-9]{4,8}$/.test(code)){
    setRoomStatus('Код: 4–8 латинских букв или цифр', true);
    return;
  }
  leaveMultiplayer();
  try { localStorage.setItem('tk_playerName', name); } catch(e){}
  try {
    var codeInp = document.getElementById('roomCodeInput');
    if(codeInp) codeInp.value = code;
  } catch(e){}

  var socket = net.socket = new WebSocket(wsUrl());
  setRoomStatus('Подключение…');

  socket.onopen = function(){
    stopRoomListPoll();
    var cfg = create ? roomConfig() : undefined;
    sendNet({
      type:'join', room:code, name:name, create:!!create,
      open: cfg ? !!cfg.open : false,
      config: cfg
    });
  };

  socket.onerror = function(){
    setRoomStatus('Нет связи с сервером', true);
  };

  socket.onclose = function(){
    if(net.socket !== socket) return;
    if(net.active){
      setRoomStatus('Соединение потеряно', true);
      try { if(roomHudEl) roomHudEl.textContent = '⚠ Нет связи'; } catch(e){}
    }
    net.active = false;
  };

  socket.onmessage = function(event){
    var data;
    try { data = JSON.parse(event.data); } catch(e){ return; }
    handleNetMessage(data, socket);
  };
}

function handleNetMessage(data, socket){
  if(!data || !data.type) return;

  if(data.type === 'error'){
    setRoomStatus(data.message || 'Ошибка', true);
    try { socket.close(); } catch(e){}
    return;
  }

  if(data.type === 'rooms' || data.type === 'list'){
    renderOpenRooms(data.rooms || data.list || []);
    return;
  }

  if(data.type === 'welcome'){
    onWelcome(data);
    return;
  }

  if(data.type === 'players' || data.type === 'roster'){
    try {
      if(data.players && net.players){
        net.players.clear();
        (data.players || []).forEach(function(p){
          if(p && p.id) net.players.set(p.id, p);
        });
      }
      if(typeof roomHudEl !== 'undefined' && roomHudEl){
        var n = net.players ? net.players.size : (data.count || 1);
        roomHudEl.textContent = '🌐 ' + net.room + ' · игроков: ' + n;
      }
    } catch(e){}
    return;
  }

  if(data.type === 'state'){
    if(data.id && data.id !== net.id && net.players){
      net.players.set(data.id, {
        id: data.id,
        x: data.x, y: data.y, hp: data.hp,
        alive: data.alive !== false,
        name: data.name || 'Игрок',
        seen: Date.now()
      });
    }
    return;
  }

  if(data.type === 'chat'){
    var who = data.from || data.id;
    if(who !== net.id){
      try { appendChat(data.name||'?', data.text||'', false); } catch(e){}
    }
    return;
  }

  if(data.type === 'userboss'){
    try { applyUserBossRole(data.bossId, data.name); } catch(e){}
    return;
  }

  if(data.type === 'ub_abilities'){
    try { onUserBossAbilitiesReady(data.bossId, data.abilities||[], data.name); } catch(e){}
    return;
  }

  if(data.type === 'ub_atk'){
    if(data.from !== net.id){
      if(typeof applyRemoteUbAtk === 'function') applyRemoteUbAtk(data);
      else {
        try {
          if(statusEl && data.ability){ statusEl.textContent = '👑 '+String(data.ability).toUpperCase(); statusEl.style.color='#f6f'; }
          if(boss && typeof data.x==='number'){ boss.x = data.x; boss.y = data.y; }
          if(boss && typeof data.hp==='number') boss.hp = data.hp;
        } catch(e){}
      }
    }
    return;
  }

  if(data.type === 'ub_state'){
    if(data.from !== net.id && window.userBoss && window.userBoss.active){
      try {
        if(!bossMode) startBoss();
        if(boss){
          boss.x = data.x; boss.y = data.y;
          boss.userControlled = true;
          if(typeof data.hp==='number') boss.hp = data.hp;
          if(typeof data.maxHp==='number') boss.maxHp = data.maxHp;
          if(typeof data.phase==='number') bossPhase = data.phase;
          if(data.abilities && data.abilities.length){
            window.userBoss.abilities = data.abilities.slice();
            window.userBoss.pickDone = true;
          }
          if(data.charging) boss.charging = true;
          if(bossHpEl) bossHpEl.style.display='block';
        }
      } catch(e){}
    }
    return;
  }

  if(data.type === 'damage' && boss && boss.hp > 0){
    boss.hp = Math.max(0, boss.hp - Math.max(0, Math.min(50, Number(data.amount) || 0)));
    if(boss.hp <= 0) try { winBoss(); } catch(e){}
    return;
  }

  if(data.type === 'boss' && boss){
    var fromOther = data.from && data.from !== net.id;
    var classicGuest = !net.host && !fromOther;
    if(fromOther || classicGuest || (window.userBoss && window.userBoss.active && !window.userBoss.isMe)){
      ['x','y','hp','maxHp'].forEach(function(key){
        if(Number.isFinite(data[key])) boss[key] = data[key];
      });
      if([1,2,3,4].indexOf(data.phase) >= 0) bossPhase = data.phase;
    }
    return;
  }

  if(data.type === 'host'){ net.host = true; return; }
  if(data.type === 'victory' && running){ try { winBoss(); } catch(e){} return; }

  // mod relay
  if(data.type === 'modcode' && typeof data.code === 'string'){
    try {
      mods.customCode = data.code;
      if(typeof compileUserMod === 'function') compileUserMod();
    } catch(e){}
    return;
  }
  if(data.type === 'modshared' && data.shared && typeof game !== 'undefined'){
    try { if(game.shared) Object.assign(game.shared, data.shared); } catch(e){}
    return;
  }
  if(data.type === 'modsolids' && Array.isArray(data.solids)){
    try { if(typeof modSolids !== 'undefined') modSolids = data.solids; } catch(e){}
    return;
  }
  if(data.type === 'modmsg' && data.payload){
    try { if(typeof runUserHook === 'function') runUserHook('onNetMsg', data.payload); } catch(e){}
    return;
  }
  if(data.type === 'pvp_hit'){
    try {
      if(data.target === net.id && typeof applyHunterDamage === 'function'){
        applyHunterDamage(data.amount || 10, data.reason || 'Урон от босса');
      }
    } catch(e){}
    return;
  }
}

function onWelcome(data){
  net.active = true;
  net.room = data.room;
  net.id = data.id;
  net.host = !!data.host;
  net.config = data.config || {};
  window.mpMode = (net.config && net.config.mode) || 'boss';

  try {
    net.savedMods = Object.assign({}, mods, { customCode: mods.customCode });
    net.savedBossMods = Object.assign({}, bossMods, { atkWeights: (bossMods.atkWeights||[]).slice() });
  } catch(e){}

  try {
    if(net.config.v1){
      Object.assign(mods, net.config.v1);
      if(typeof net.config.v1.customCode === 'string'){
        mods.customCode = net.config.v1.customCode;
        if(mods.customCode){
          mods.customCodeFileName = 'host-mod.js';
          mods.customMods = [{ name: 'host-mod.js', code: mods.customCode }];
        }
      }
    }
    if(net.config.v2) Object.assign(bossMods, net.config.v2);
    if(net.config.giants) mods.playerSize = 30;
    if(net.config.infiniteAmmo) mods.weaponAmmo = 9999;
  } catch(e){}

  try { if(typeof compileUserMod === 'function') compileUserMod(); } catch(e){}

  try {
    var rs = document.getElementById('roomScreen');
    if(rs) rs.classList.add('hidden');
    stopRoomListPoll();
  } catch(e){}

  setRoomStatus('Комната ' + data.room + ' · вход…');

  try { startGame(); } catch(e){
    console.error('[net] startGame', e);
    setRoomStatus('Ошибка старта: ' + (e && e.message ? e.message : e), true);
  }

  try {
    var cx = (typeof world==='number' && world>0) ? world/2 : 1600;
    if(typeof ensurePlayer === 'function') ensurePlayer(cx, cx);
    if(typeof running !== 'undefined') running = true;
    if(typeof t0 !== 'undefined' && !t0) t0 = performance.now();
    var ui = document.getElementById('ui'); if(ui) ui.classList.remove('hidden');
    if(typeof statusEl !== 'undefined' && statusEl){
      statusEl.textContent = 'БЕГИ!!!'; statusEl.style.color = '#5af';
    }
    if(typeof showControls === 'function') showControls();
  } catch(e){}

  setTimeout(function(){
    try {
      if(typeof running !== 'undefined' && running){
        beginMultiplayerMode(window.mpMode || (net.config && net.config.mode) || 'boss');
      }
    } catch(e){ console.error('[net] beginMode', e); }
    try {
      if(typeof roomHudEl !== 'undefined' && roomHudEl){
        roomHudEl.textContent = '🌐 ' + net.room + (net.host ? ' · хост' : '');
      }
    } catch(e){}
  }, 100);
}

/* expose */
window.sendNet = sendNet;
window.sendPlayerState = sendPlayerState;
window.leaveMultiplayer = leaveMultiplayer;
window.connectRoom = connectRoom;
window.roomConfig = roomConfig;
window.renderOpenRooms = renderOpenRooms;
window.fetchOpenRooms = fetchOpenRooms;
window.startRoomListPoll = startRoomListPoll;
window.stopRoomListPoll = stopRoomListPoll;
window.setRoomStatus = setRoomStatus;
