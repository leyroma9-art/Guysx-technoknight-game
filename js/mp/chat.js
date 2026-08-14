/* js/mp/chat.js */
function applyChatLayout(){
  const box = document.getElementById('mpChat');
  const log = document.getElementById('mpChatLog');
  if(!box || !log) return;
  const s = window.chatSettings;
  box.style.width = (s.w||280)+'px';
  log.style.height = (s.h||140)+'px';
  log.style.fontSize = (s.font||13)+'px';
  box.style.left = box.style.right = box.style.top = box.style.bottom = 'auto';
  const m='calc(12px + env(safe-area-inset-bottom))', m2='calc(12px + env(safe-area-inset-top))';
  const ml='calc(12px + env(safe-area-inset-left))', mr='calc(12px + env(safe-area-inset-right))';
  if(s.pos==='br'){ box.style.right=mr; box.style.bottom=m; }
  else if(s.pos==='tl'){ box.style.left=ml; box.style.top=m2; }
  else if(s.pos==='tr'){ box.style.right=mr; box.style.top=m2; }
  else { box.style.left=ml; box.style.bottom=m; }
  box.style.display = (s.show===false) ? 'none' : 'flex';
}
function showChat(on){
  const box = document.getElementById('mpChat');
  if(!box) return;
  if(on && window.chatSettings.show!==false) box.style.display='flex';
  else if(!on) box.style.display='none';
  applyChatLayout();
}
function appendChat(name, text, self){
  const log = document.getElementById('mpChatLog');
  if(!log){ console.warn('no mpChatLog'); return; }
  log.style.minHeight = '40px';
  const row = document.createElement('div');
  row.style.marginBottom='4px'; row.style.wordBreak='break-word'; row.style.fontSize=(window.chatSettings.font||13)+'px';
  row.innerHTML = '<b style="color:'+(self?'#8f8':'#f8a')+'">'+(name||'?').replace(/[<>&]/g,'')+':</b> <span style="color:#eee">'+String(text||'').replace(/[<>&]/g,'')+'</span>';
  log.appendChild(row); log.scrollTop = log.scrollHeight;
}
function sendChat(){
  const inp = document.getElementById('mpChatInput');
  if(!inp) return;
  const text = inp.value.trim(); if(!text) return;
  inp.value='';
  const name = (document.getElementById('playerNameInput')?.value||'Игрок').slice(0,16);
  appendChat(name, text, true);
  try { sendNet({ type:'chat', name, text, from: net.id }); } catch(e){ console.warn(e); }
  // keep chat visible
  showChat(true);
  applyChatLayout();
}

