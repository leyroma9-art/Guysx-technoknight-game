/* js/mp/state.js — shared multiplayer state */
window.net = {
  socket: null, active: false, room: '', id: '', host: false,
  players: new Map(), lastSend: 0, config: null,
  savedMods: null, savedBossMods: null
};
window.mpMode = 'boss';
window.userBoss = {
  active: false, bossId: null, isMe: false,
  abilities: [], cd: {}, pickDone: false, name: ''
};
window.chatSettings = (function(){
  try { return JSON.parse(localStorage.getItem('tk_chat')||'null'); } catch(e){ return null; }
})() || { pos:'bl', w:280, h:140, font:13, show:true };
