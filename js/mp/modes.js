/* js/mp/modes.js — multiplayer mode entry (empty / boss / userboss) */

function snapCamToPlayer(){
  try {
    if(!player || typeof cam==='undefined') return;
    var zoom = (cam.zoom || 1);
    var vw = ((typeof W==='number' && W) ? W : (innerWidth||800)) / zoom;
    var vh = ((typeof H==='number' && H) ? H : (innerHeight||600)) / zoom;
    cam.x = player.x - vw/2;
    cam.y = player.y - vh/2;
  } catch(e){}
}

function isLocalHunter(){
  if(window.userBoss && window.userBoss.active && window.userBoss.isMe) return false;
  return true;
}

function isLocalUserBoss(){
  return !!(window.userBoss && window.userBoss.active && window.userBoss.isMe);
}

function applyHunterDamage(amount, reason){
  if(typeof player==='undefined' || !player || !isLocalHunter()) return false;
  if(window.mpMode === 'empty') return false;
  player.hp -= amount;
  if(player.hp <= 0){ die(reason || 'Босс тебя добил'); return true; }
  return false;
}

/** Shared reset used by all MP modes — same spirit as empty room */
function resetMpWorld(){
  try {
    enemies = [];
    shitBalls = []; bigShits = []; puddles = [];
    tarantulas = []; cumShots = []; lasers = [];
    phantoms = []; npcMarkers = [];
    if(typeof window.extraBosses!=='undefined') window.extraBosses = [];
  } catch(e){}
  try {
    var cx = (typeof world==='number' && world>0) ? world/2 : 1600;
    if(typeof ensurePlayer === 'function') ensurePlayer(cx, cx);
    if(player){
      player.hp = 100;
      player.x = cx; player.y = cx;
      if(player.ammo == null || player.ammo < 0) player.ammo = 0;
    }
  } catch(e){}
  snapCamToPlayer();
}

function beginMultiplayerMode(mode){
  window.mpMode = mode || 'boss';
  window.userBoss = { active:false, bossId:null, isMe:false, abilities:[], cd:{}, pickDone:false, name:'' };
  hideMpExtras();
  resetMpWorld();

  if(window.mpMode === 'empty'){
    startEmptyRoom();
  } else if(window.mpMode === 'userboss'){
    startUserBossFlow();
  } else {
    // classic boss — same entry as empty then start boss
    try {
      if(typeof statusEl!=='undefined' && statusEl){
        statusEl.textContent = 'БЕГИ!!!'; statusEl.style.color = '#5af';
      }
      if(typeof running!=='undefined' && running){
        startBoss();
      }
    } catch(e){ console.error('startBoss', e); }
  }
  snapCamToPlayer();
  // one more snap after a tick (startBoss may move things)
  setTimeout(snapCamToPlayer, 50);
  setTimeout(snapCamToPlayer, 200);
}

function hideMpExtras(){
  ['mpMenuBtn','mpChat','userBossBar'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.style.display = 'none';
  });
  try {
    document.getElementById('mpPauseMenu') && document.getElementById('mpPauseMenu').classList.add('hidden');
    document.getElementById('mpChatSettings') && document.getElementById('mpChatSettings').classList.add('hidden');
    var ub = document.getElementById('userBossPick');
    if(ub){ ub.classList.add('hidden'); ub.style.display = 'none'; }
  } catch(e){}
}

function startEmptyRoom(){
  bossMode = false; boss = null;
  resetMpWorld();
  if(player){ player.hp = 100; player.ammo = Math.max(player.ammo||0, 30); }
  if(typeof statusEl!=='undefined' && statusEl){
    statusEl.textContent = '🏠 Пустая комната · моды + чат'; statusEl.style.color = '#8cf';
  }
  if(typeof bossHpEl!=='undefined' && bossHpEl) bossHpEl.style.display = 'none';
  if(typeof ammoEl!=='undefined' && ammoEl) ammoEl.textContent = '';
  var btn = document.getElementById('mpMenuBtn');
  if(btn) btn.style.display = 'flex';
  try { applyChatLayout(); showChat(true); } catch(e){}
  try { time = 0; } catch(e){}
  try { appendChat('Система', 'Пустая комната. Моды активны. Чат внизу.', false); } catch(e){}
  try {
    if(typeof compileUserMod === 'function') compileUserMod();
    if(typeof runUserHook === 'function') runUserHook('onStart');
  } catch(e){ console.warn('empty mods', e); }
  snapCamToPlayer();
}

// expose
window.snapCamToPlayer = snapCamToPlayer;
window.isLocalHunter = isLocalHunter;
window.isLocalUserBoss = isLocalUserBoss;
window.applyHunterDamage = applyHunterDamage;
window.beginMultiplayerMode = beginMultiplayerMode;
window.hideMpExtras = hideMpExtras;
window.startEmptyRoom = startEmptyRoom;
window.resetMpWorld = resetMpWorld;
