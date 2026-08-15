/* js/mp/net.js — WebSocket room connect / leave / message relay */
var net = window.net;

function sendNet(message){
  if(net.socket?.readyState === WebSocket.OPEN) net.socket.send(JSON.stringify(message));
}

let roomListSocket = null;
let roomListTimer = null;
let roomListBusy = false;

function renderOpenRooms(rooms){
  const box = document.getElementById('openRoomsList');
  if(!box) return;
  const list = Array.isArray(rooms) ? rooms : [];
  if(!list.length){
    box.innerHTML = '<div class="room-list-empty">Нет открытых комнат</div>';
    return;
  }
  box.innerHTML = list.map(r => {
    const code = String(r.code || r.room || '').toUpperCase();
    const count = r.count != null ? r.count : (r.players != null ? r.players : '?');
    const host = r.hostName || r.host || r.name || '';
    const mode = r.mode || (r.config && r.config.mode) || '';
    const modeTag = mode==='empty'?'🏠':(mode==='userboss'?'👑':'⚔');
    const meta = modeTag+' '+(host ? (count + ' игр. · ' + host) : (count + ' игр.'));
    return '<div class="room-list-item" data-code="'+code+'"><span class="rc">'+code+'</span><span class="rmeta">'+meta+'</span></div>';
  }).join('');
  box.querySelectorAll('.room-list-item').forEach(el => {
    el.onclick = () => {
      const code = el.getAttribute('data-code');
      if(!code) return;
      document.getElementById('roomCodeInput').value = code;
      connectRoom(code, false);
    };
  });
}

function fetchOpenRooms(force){
  if(roomListBusy && !force) return;
  roomListBusy = true;
  try {
    if(roomListSocket && roomListSocket.readyState === WebSocket.OPEN){
      roomListSocket.send(JSON.stringify({type:'list'}));
      roomListBusy = false;
      return;
    }
    if(roomListSocket){ try{ roomListSocket.close(); }catch(e){} roomListSocket = null; }
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = location.host || 'localhost:8080';
    const s = roomListSocket = new WebSocket(protocol + '//' + host + '/ws');
    s.onopen = () => { try{ s.send(JSON.stringify({type:'list'})); }catch(e){} };
    s.onmessage = (ev) => {
      let data; try{ data = JSON.parse(ev.data); }catch{ return; }
      if(data.type === 'rooms' || data.type === 'list'){
        renderOpenRooms(data.rooms || data.list || []);
      }
    };
    s.onerror = () => {
      const box = document.getElementById('openRoomsList');
      if(box && !box.querySelector('.room-list-item')){
        box.innerHTML = '<div class="room-list-empty">Сервер недоступен</div>';
      }
    };
    s.onclose = () => { if(roomListSocket === s) roomListSocket = null; };
  } catch(e){
    const box = document.getElementById('openRoomsList');
    if(box) box.innerHTML = '<div class="room-list-empty">Ошибка списка</div>';
  }
  roomListBusy = false;
}

function startRoomListPoll(){
  stopRoomListPoll();
  fetchOpenRooms(true);
  roomListTimer = setInterval(() => fetchOpenRooms(false), 4000);
}

function stopRoomListPoll(){
  if(roomListTimer){ clearInterval(roomListTimer); roomListTimer = null; }
  if(roomListSocket){ try{ roomListSocket.close(); }catch(e){} roomListSocket = null; }
}

function leaveMultiplayer(){
  try { if(net && net.socket) net.socket.close(); } catch(e){}
  try {
    if(net && net.savedMods){
      mods = net.savedMods; bossMods = net.savedBossMods;
      if(typeof compileUserMod === 'function') compileUserMod();
    }
  } catch(e){}
  try {
    if(net){
      net.socket = null; net.active = false; net.room = ''; net.id = ''; net.host = false;
      if(net.players && net.players.clear) net.players.clear();
      net.config = null; net.savedMods = null; net.savedBossMods = null;
    }
  } catch(e){}
  try { if(typeof roomHudEl!=='undefined' && roomHudEl) roomHudEl.textContent = ''; } catch(e){}
  try { hideMpExtras(); window.mpMode='boss'; window.userBoss={active:false,bossId:null,isMe:false,abilities:[],cd:{},pickDone:false,name:''}; } catch(e){}
}

function roomConfig(){
  const syncCode = !document.getElementById('roomSyncCode') || document.getElementById('roomSyncCode').checked;
  const modeEl = document.querySelector('input[name="roomMode"]:checked');
  const mode = (modeEl && modeEl.value) || 'boss';
  return {
    mode: mode,
    open: !!(document.getElementById('roomOpen') && document.getElementById('roomOpen').checked),
    v1: document.getElementById('roomMods1').checked ? {
      playerSpeed:mods.playerSpeed, playerSize:mods.playerSize, mapSize:mods.mapSize,
      weaponAmmo:mods.weaponAmmo, weaponFireRate:mods.weaponFireRate, weaponBullets:mods.weaponBullets,
      weaponSpread:mods.weaponSpread, giveWeaponOnStart:mods.giveWeaponOnStart, playerDash:mods.playerDash,
      npcCount:mods.npcCount, npcHp:mods.npcHp, npcName:mods.npcName, npcIsBoss:mods.npcIsBoss,
      weaponChance:mods.weaponChance, deathTexts:mods.deathTexts,
      // full custom JS so everyone in room runs the same mod content
      customCode: syncCode ? (mods.customCode || '') : undefined
    } : null,
    v2: document.getElementById('roomMods2').checked ? {
      bossHp:bossMods.bossHp, projMult:bossMods.projMult, attackInterval:bossMods.attackInterval,
      atkWeights:bossMods.atkWeights, shieldChance:bossMods.shieldChance,
      shieldDuration:bossMods.shieldDuration, shieldCooldown:bossMods.shieldCooldown,
      bossCount:bossMods.bossCount, skipToBoss:bossMods.skipToBoss, skipCutscene:bossMods.skipCutscene,
      phase1:bossMods.phase1, phase2:bossMods.phase2, phase3:bossMods.phase3, phase4:bossMods.phase4,
      phase2Hp:bossMods.phase2Hp, phase3Hp:bossMods.phase3Hp, phase4Hp:bossMods.phase4Hp,
      phantomSpin:bossMods.phantomSpin, phase4Rate:bossMods.phase4Rate
    } : null,
    infiniteAmmo:document.getElementById('roomInfiniteAmmo').checked,
    giants:document.getElementById('roomGiants').checked,
    syncCode: syncCode
  };
}


// ===== MULTIPLAYER MODES + BOSS ABILITY SYNC =====

function connectRoom(rawCode, create){
  const code = String(rawCode || '').trim().toUpperCase();
  const name = (document.getElementById('playerNameInput').value.trim() || 'Игрок').slice(0,16);
  const status = document.getElementById('roomStatus');
  if(!/^[A-Z0-9]{4,8}$/.test(code)){ status.textContent = 'Код: 4–8 латинских букв или цифр'; return; }
  leaveMultiplayer();
  localStorage.setItem('tk_playerName', name);
  document.getElementById('roomCodeInput').value = code;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = location.host || 'localhost:8080';
  const socket = net.socket = new WebSocket(`${protocol}//${host}/ws`);
  status.textContent = 'Подключение…';
  socket.onopen = () => {
    stopRoomListPoll();
    const cfg = create ? roomConfig() : undefined;
    sendNet({type:'join', room:code, name, create, open: cfg ? !!cfg.open : false, config: cfg});
  };
  socket.onerror = () => status.textContent = 'Нет связи. Запусти игру через npm start.';
  socket.onclose = () => {
    if(net.socket !== socket) return;
    if(net.active){ status.textContent = 'Соединение потеряно'; roomHudEl.textContent = '⚠ Нет связи'; }
    net.active = false;
  };
  socket.onmessage = event => {
    let data; try{ data = JSON.parse(event.data); }catch{ return; }
    if(data.type === 'error'){ status.textContent = data.message; socket.close(); return; }
    if(data.type === 'welcome'){
      net.active = true; net.room = data.room; net.id = data.id; net.host = data.host;
      net.config = data.config || {};
      // mode ДО startGame, иначе skipNpc/HUD не видят userboss/empty
      window.mpMode = (net.config && net.config.mode) || 'boss';
      try {
        net.savedMods = {...mods, customCode: mods.customCode};
        net.savedBossMods = {...bossMods, atkWeights:[...(bossMods.atkWeights||[])]};
      } catch(e){ console.warn('[net] save mods', e); }
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
      } catch(e){ console.warn('[net] apply config', e); }
      try { compileUserMod(); } catch(e){ console.error('[net] mod compile', e); }
      // сразу прячем меню комнаты — даже если startGame упадёт
      try {
        var rs = document.getElementById('roomScreen');
        if(rs) rs.classList.add('hidden');
        stopRoomListPoll();
      } catch(e){}
      status.textContent = 'Комната '+data.room+': вход…' + (mods && mods.customCode ? ' · мод-код' : '');
      try {
        startGame();
      } catch(e){
        console.error('[net] startGame', e);
        status.textContent = 'Ошибка старта: ' + (e && e.message ? e.message : e);
      }
      // на всякий случай: игрок + UI, если startGame частично упал
      try {
        if(typeof ensurePlayer === 'function') ensurePlayer(
          (typeof world==='number' ? world/2 : 1600),
          (typeof world==='number' ? world/2 : 1600)
        );
        if(typeof running !== 'undefined') running = true;
        if(typeof t0 !== 'undefined' && !t0) t0 = performance.now();
        var ui = document.getElementById('ui'); if(ui) ui.classList.remove('hidden');
        var rs = document.getElementById('roomScreen'); if(rs) rs.classList.add('hidden');
        if(typeof statusEl !== 'undefined' && statusEl && (!statusEl.textContent || statusEl.textContent.indexOf('Нажми')>=0)){
          statusEl.textContent = 'БЕГИ!!!'; statusEl.style.color = '#5af';
        }
        if(typeof showControls === 'function') showControls();
      } catch(e){ console.warn('[net] force ready', e); }
      setTimeout(function(){
        try {
          if(typeof running !== 'undefined' && running){
            beginMultiplayerMode(window.mpMode || (net.config && net.config.mode) || 'boss');
          }
        } catch(e){
          console.error('[net] beginMode', e);
          if(status) status.textContent = 'Ошибка режима: ' + (e && e.message ? e.message : e);
        }
      }, 150);
    } else if(data.type === 'modcode'){
      // live code push — у всех в комнате, даже без файлов
      if(typeof data.code === 'string'){
        mods.customCode = data.code;
        mods.customCodeFileName = 'host-mod.js';
        mods.customMods = data.code.trim() ? [{ name: 'host-mod.js', code: data.code }] : [];
        try { localStorage.setItem('tk_mods', JSON.stringify(mods)); } catch(e){}
        try { compileUserMod(); runUserHook('onStart'); } catch(e){ console.error(e); }
        if(statusEl){ statusEl.textContent = '📜 Мод-код от хоста загружен'; statusEl.style.color = '#8f8'; }
        try { updateModCodeFileInfo(); } catch(e){}
      }
    } else if(data.type === 'modmsg'){
      // custom messages from game.broadcast
      try {
        if(userMod && userMod._gameApi && typeof userMod._gameApi._recvNet === 'function'){
          userMod._gameApi._recvNet(data.payload, data.from);
        }
        runUserHook('onNet', data.payload, data.from);
      } catch(e){ console.error('[net] modmsg', e); }
    } else if(data.type === 'modshared'){
      if(userMod && userMod._gameApi){
        const sh = userMod._gameApi.shared;
        if(sh && data.shared && typeof data.shared === 'object'){
          Object.assign(sh, data.shared);
        }
      }
    } else if(data.type === 'modsolids'){
      if(Array.isArray(data.solids)){
        modSolids.length = 0;
        for(const s of data.solids) modSolids.push(s);
        invalidateSolidGrid();
      }
    } else if(data.type === 'state' && data.id !== net.id){
      const teammate = net.players.get(data.id);
      if(teammate) Object.assign(teammate, data, {tx:data.x,ty:data.y,seen:performance.now()});
      else net.players.set(data.id, {...data,tx:data.x,ty:data.y,seen:performance.now()});
      // ЕДИНЫЙ СИНК ЮЗЕР-БОССА через state (видят все)
      if(data.isBoss){
        try { applyRemoteUserBossState(data); } catch(e){ console.warn(e); }
      }
    } else if(data.type === 'left') net.players.delete(data.id);
    else if(data.type === 'room') roomHudEl.textContent = `🌐 ${net.room} · игроков: ${data.count}`;
    else if(data.type === 'chat'){
      const who = data.from || data.id;
      if(who !== net.id) appendChat(data.name||'?', data.text||'', false);
    } else if(data.type === 'userboss'){
      applyUserBossRole(data.bossId, data.name);
    } else if(data.type === 'ub_abilities'){
      // authoritative ability list for the room boss
      onUserBossAbilitiesReady(data.bossId, data.abilities||[], data.name);
    } else if(data.type === 'ub_atk'){
      // remote ability VFX/effect (local already predicted)
      if(data.from !== net.id && typeof applyRemoteUbAtk === 'function') applyRemoteUbAtk(data);
      else if(data.from !== net.id){
        try {
          if(statusEl && data.ability){ statusEl.textContent = '👑 '+String(data.ability).toUpperCase(); statusEl.style.color='#f6f'; }
          if(boss && typeof data.x==='number'){ boss.x = data.x; boss.y = data.y; }
          if(boss && typeof data.hp==='number') boss.hp = data.hp;
        } catch(e){}
      }
    } else if(data.type === 'ub_state'){
      if(data.from !== net.id && window.userBoss && window.userBoss.active){
        if(!bossMode){ try{ startBoss(); }catch(e){} }
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
          if(data.charging){ boss.charging = true; }
          if(bossHpEl) bossHpEl.style.display='block';
        }
      }
    } else if(data.type === 'damage' && boss?.hp > 0){
      boss.hp = Math.max(0, boss.hp - Math.max(0, Math.min(50, Number(data.amount) || 0)));
      if(boss.hp <= 0) winBoss();
    } else if(data.type === 'boss' && boss){
      // принимаем позицию босса от юзер-босса (даже если мы host)
      const fromOther = data.from && data.from !== net.id;
      const classicGuest = !net.host && !fromOther;
      if(fromOther || classicGuest || (window.userBoss && window.userBoss.active && !window.userBoss.isMe)){
        for(const key of ['x','y','hp','maxHp']) if(Number.isFinite(data[key])) boss[key] = data[key];
        if([1,2,3,4].includes(data.phase)) bossPhase = data.phase;
      }
    } else if(data.type === 'host') net.host = true;
    else if(data.type === 'victory' && running) winBoss();
  };
}

