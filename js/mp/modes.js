/* js/mp/modes.js */
function isLocalUserBoss(){
  return !!(window.userBoss && window.userBoss.active && window.userBoss.isMe && typeof bossMode!=='undefined' && bossMode);
}
function isLocalHunter(){
  if(isLocalUserBoss()) return false;
  if(window.userBoss && window.userBoss.active && window.userBoss.bossId && window.userBoss.bossId === (window.net&&window.net.id)) return false;
  return true;
}
function applyHunterDamage(amount, reason){
  if(typeof player==='undefined' || !player || !isLocalHunter()) return false;
  if(window.mpMode === 'empty') return false;
  player.hp -= amount;
  if(player.hp <= 0){ die(reason || 'Босс тебя добил'); return true; }
  return false;
}
function beginMultiplayerMode(mode){
  window.mpMode = mode || 'boss';
  window.userBoss = { active:false, bossId:null, isMe:false, abilities:[], cd:{}, pickDone:false, name:'' };
  hideMpExtras();
  if(window.mpMode === 'empty'){
    startEmptyRoom();
  } else if(window.mpMode === 'userboss'){
    if(typeof enemies!=='undefined') enemies = [];
    startUserBossFlow();
  } else if(typeof running!=='undefined' && running && typeof bossMode!=='undefined' && !bossMode){
    startBoss();
  }
}
function hideMpExtras(){
  ['mpMenuBtn','mpChat','userBossBar'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.style.display = 'none';
  });
  document.getElementById('mpPauseMenu') && document.getElementById('mpPauseMenu').classList.add('hidden');
  document.getElementById('mpChatSettings') && document.getElementById('mpChatSettings').classList.add('hidden');
  document.getElementById('userBossPick') && document.getElementById('userBossPick').classList.add('hidden');
}
function startEmptyRoom(){
  bossMode = false; boss = null;
  enemies = []; shitBalls = []; bigShits = []; puddles = []; tarantulas = [];
  cumShots = []; lasers = []; phantoms = []; npcMarkers = [];
  if(player){ player.hp = 100; player.ammo = Math.max(player.ammo||0, 30); }
  if(typeof statusEl!=='undefined' && statusEl){ statusEl.textContent = '🏠 Пустая комната · моды + чат'; statusEl.style.color = '#8cf'; }
  if(typeof bossHpEl!=='undefined' && bossHpEl) bossHpEl.style.display = 'none';
  if(typeof ammoEl!=='undefined' && ammoEl) ammoEl.textContent = '';
  var btn = document.getElementById('mpMenuBtn');
  if(btn) btn.style.display = 'flex';
  applyChatLayout();
  showChat(true);
  try { time = 0; } catch(e){}
  try { appendChat('Система', 'Пустая комната. Моды активны. Чат внизу.', false); } catch(e){}
  try {
    if(typeof compileUserMod === 'function') compileUserMod();
    if(typeof runUserHook === 'function') runUserHook('onStart');
  } catch(e){ console.warn('empty mods', e); }
}
