// ════════════════════════════════════════
//  آمرني — app.js  v4
//  + Language switch (AR/EN)
//  + User memory across sessions
// ════════════════════════════════════════

const STATE = {
  messages:      [],
  imageBase64:   null,
  imageMime:     null,
  imageName:     null,
  isLoading:     false,
  currentChatId: null,
  user:          null,
};

const SETTINGS = {
  dark:      false,
  accent:    { color: '#4f46e5', color2: '#4338ca', light: 'rgba(79,70,229,.12)' },
  
  length:    'medium',
  lang:      'ar',
  saveChats: true,
};

// UI strings for AR/EN
const UI = {
  ar: {
    newChat:      'محادثة جديدة',
    suggestions:  'اقتراحات',
    history:      'المحادثات السابقة',
    noHistory:    'لا توجد محادثات سابقة',
    guest:        'زائر',
    guestStatus:  'تصفح كزائر',
    placeholder:  'اكتب رسالتك...',
    hint:         'آمرني قد يُخطئ أحياناً — يُرجى التحقق من المعلومات المهمة',
    settings:     'الإعدادات',
    account:      'الحساب',
    appearance:   'المظهر',
    darkMode:     'الوضع الداكن',
    accentColor:  'لون التمييز',
    responseStyle:'أسلوب الردود',
    styleLabel:   'اللغة والأسلوب',
    lengthLabel:  'طول الرد',
    chats:        'المحادثات',
    autoSave:     'حفظ المحادثات تلقائياً',
    deleteAll:    'حذف جميع المحادثات',
    about:        'عن التطبيق',
    version:      'الإصدار 4.0 · مدعوم بـ Llama 3.3',
    login:        'تسجيل الدخول',
    logout:       'تسجيل الخروج',
    memory:       'الذاكرة',
    memoryLabel:  'معلومات تريدني أتذكرها',
    memoryPlaceholder: 'مثال: أنا مهندس برمجيات، أفضّل الشرح بأمثلة عملية...',
    memoryHint:   'هذه المعلومات تُرسل في كل محادثة لأفهمك أفضل',
    welcomeTitle: 'كيف يمكنني مساعدتك؟',
    welcomeSub:   'اسألني عن أي شيء — أكتب، أحلل، أترجم، أبرمج، وأنشئ ملفات',
    language:     'لغة الواجهة',
    shortLabel:   'مختصر',
    mediumLabel:  'متوازن',
    longLabel:    'مفصّل',
    formalLabel:  'فصحى رسمية',
    saudiLabel:   'سعودي عامي',
    casualLabel:  'عربي بسيط',
    copy:         'نسخ',
    copied:       '✓ تم',
    download:     '⬇️ تحميل',
    deleteChat:   'حذف',
    confirmDelete:'تأكيد حذف جميع المحادثات؟',
    confirmLogout:'تأكيد تسجيل الخروج؟',
  },
  en: {
    newChat:      'New Chat',
    suggestions:  'Suggestions',
    history:      'Recent Chats',
    noHistory:    'No chats yet',
    guest:        'Guest',
    guestStatus:  'Browsing as guest',
    placeholder:  'Message Amerni...',
    hint:         'Amerni can make mistakes — verify important information',
    settings:     'Settings',
    account:      'Account',
    appearance:   'Appearance',
    darkMode:     'Dark Mode',
    accentColor:  'Accent Color',
    responseStyle:'Response Style',
    styleLabel:   'Style',
    lengthLabel:  'Response Length',
    chats:        'Chats',
    autoSave:     'Auto-save Chats',
    deleteAll:    'Delete All Chats',
    about:        'About',
    version:      'Version 4.0 · Powered by Llama 3.3',
    login:        'Sign In',
    logout:       'Sign Out',
    memory:       'Memory',
    memoryLabel:  'Information you want me to remember',
    memoryPlaceholder: 'Example: I\'m a software engineer, I prefer practical examples...',
    memoryHint:   'This info is sent with every chat so I understand you better',
    welcomeTitle: 'How can I help you?',
    welcomeSub:   'Ask me anything — write, analyze, translate, code, and create files',
    language:     'Interface Language',
    shortLabel:   'Short',
    mediumLabel:  'Balanced',
    longLabel:    'Detailed',
    formalLabel:  'Formal',
    saudiLabel:   'Saudi Dialect',
    casualLabel:  'Casual',
    copy:         'Copy',
    copied:       '✓ Done',
    download:     '⬇️ Download',
    deleteChat:   'Delete',
    confirmDelete:'Delete all chats?',
    confirmLogout:'Sign out?',
  }
};

function t(key) { return UI[SETTINGS.lang]?.[key] || UI.ar[key] || key; }

// ══════════════════════════════════════
//  تهيئة
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // ربط زر الزائر
  setTimeout(() => {
    const gb = document.getElementById('guest-btn');
    if (gb) gb.onclick = function(e) { e.preventDefault(); loginAsGuest(); };
  }, 200);
  loadSettings();
  checkAuth();
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
  }
});

// ══════════════════════════════════════
//  تسجيل الدخول
// ══════════════════════════════════════
function checkAuth() {
  const saved = localStorage.getItem('amerni_user');
  if (saved) { STATE.user = JSON.parse(saved); enterApp(); }
}

function handleGoogleLogin(response) {
  try {
    const base64 = response.credential.split('.')[1];
    const pad = base64.length % 4 === 0 ? base64 : base64 + '==='.slice(0, 4 - base64.length % 4);
    const payload = JSON.parse(atob(pad.replace(/-/g, '+').replace(/_/g, '/')));
    STATE.user = { name: payload.name || 'Google User', email: payload.email || '', photo: payload.picture || null, type: 'google' };
    localStorage.setItem('amerni_user', JSON.stringify(STATE.user));
    enterApp();
  } catch (err) { alert('Login error: ' + err.message); }
}

function loginAsGuest() {
  const guestName = SETTINGS.lang === 'en' ? 'Guest' : 'زائر';
  STATE.user = { name: guestName, email: '', photo: null, type: 'guest' };
  enterApp();
}

function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  applyLang();
  updateUserUI();
  loadHistory();
  document.getElementById('user-input').focus();
}

function updateUserUI() {
  if (!STATE.user) return;
  const name = STATE.user.name;
  const initial = name.charAt(0).toUpperCase();
  const photo = STATE.user.photo;

  document.getElementById('user-name').textContent   = name;
  document.getElementById('user-status').textContent = STATE.user.type === 'google' ? STATE.user.email : t('guestStatus');

  ['user-avatar', 'acc-avatar'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = photo
      ? `<img src="${photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`
      : initial;
  });

  document.getElementById('acc-name').textContent  = name;
  document.getElementById('acc-email').textContent = STATE.user.email || (t('guestStatus'));
  const btn = document.getElementById('acc-btn');
  btn.textContent = STATE.user.type === 'guest' ? t('login') : t('logout');
  if (STATE.user.type !== 'guest') btn.classList.add('logout');
  else btn.classList.remove('logout');
}

function toggleLogin() {
  if (STATE.user?.type === 'google') {
    if (confirm(t('confirmLogout'))) {
      localStorage.removeItem('amerni_user');
      STATE.user = null;
      closeSettings();
      document.getElementById('app').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
    }
  } else {
    closeSettings();
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }
}

// ══════════════════════════════════════
//  إرسال رسالة
// ══════════════════════════════════════
async function sendMessage() {
  if (STATE.isLoading) return;
  const input   = document.getElementById('user-input');
  const content = input.value.trim();
  if (!content && !STATE.imageBase64) return;

  document.getElementById('welcome').style.display = 'none';

  const userMsg = { role: 'user', content: content || (SETTINGS.lang === 'en' ? 'Analyze this image' : 'حلل هذه الصورة') };
  STATE.messages.push(userMsg);
  appendUserMsg(content, STATE.imageBase64);

  input.value = '';
  autoResize(input);
  removeImage();

  const typingId = showTyping();
  STATE.isLoading = true;
  document.getElementById('send-btn').disabled = true;

  try {
    const memory = localStorage.getItem('amerni_memory') || '';

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: STATE.messages,
        length:   SETTINGS.length,
        lang:     SETTINGS.lang,
        userName: STATE.user?.name || t('guest'),
        memory,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Connection error');

    removeTyping(typingId);
    const aiMsg = { role: 'assistant', content: data.reply };
    STATE.messages.push(aiMsg);
    await appendAIMsgTyping(data.reply);

    if (data.fileData) appendFileCard(data.fileData);
    saveChat(content);

  } catch (err) {
    removeTyping(typingId);
    appendAIMsg(`⚠️ ${err.message}`);
  }

  STATE.isLoading = false;
  document.getElementById('send-btn').disabled = false;
  input.focus();
}

// ══════════════════════════════════════
//  عرض الرسائل
// ══════════════════════════════════════
function appendUserMsg(text, img64) {
  const c = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg user';
  const initial = STATE.user?.name?.charAt(0)?.toUpperCase() || 'U';
  const photo   = STATE.user?.photo;
  d.innerHTML = `
    <div class="msg-av user-av">${photo ? `<img src="${photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>` : initial}</div>
    <div class="msg-content">
      ${img64 ? `<img src="data:image/jpeg;base64,${img64}" class="msg-image" alt="image"/>` : ''}
      ${text ? `<div class="msg-bubble">${esc(text)}</div>` : ''}
    </div>`;
  c.appendChild(d); scrollDown();
}

function appendAIMsg(text) {
  const c = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg ai';
  const html = typeof marked !== 'undefined' ? marked.parse(text) : esc(text).replace(/\n/g,'<br/>');
  d.innerHTML = `
    <div class="msg-av ai-av">A</div>
    <div class="msg-content">
      <div class="msg-bubble">${html}</div>
      <div class="msg-actions">
        <button class="action-btn" onclick="copyMsg(this)">${t('copy')}</button>
      </div>
    </div>`;
  c.appendChild(d);
  d.querySelectorAll('pre code').forEach(el => addCopyCodeBtn(el.parentElement));
  scrollDown(); return d;
}

async function appendAIMsgTyping(text) {
  const c = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg ai';
  d.innerHTML = `
    <div class="msg-av ai-av">A</div>
    <div class="msg-content">
      <div class="msg-bubble typing-text"></div>
      <div class="msg-actions" style="display:none">
        <button class="action-btn" onclick="copyMsg(this)">${t('copy')}</button>
      </div>
    </div>`;
  c.appendChild(d); scrollDown();

  const bubble  = d.querySelector('.msg-bubble');
  const actions = d.querySelector('.msg-actions');
  const html = typeof marked !== 'undefined' ? marked.parse(text) : esc(text).replace(/\n/g,'<br/>');

  bubble.style.opacity = '0';
  bubble.innerHTML = html;
  bubble.style.transition = 'opacity 0.25s ease';
  await new Promise(r => setTimeout(r, 30));
  bubble.style.opacity = '1';
  actions.style.display = '';

  d.querySelectorAll('pre code').forEach(el => addCopyCodeBtn(el.parentElement));
  scrollDown(); return d;
}

function addCopyCodeBtn(preEl) {
  if (preEl.querySelector('.copy-code-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'copy-code-btn';
  btn.textContent = t('copy');
  btn.onclick = () => {
    navigator.clipboard.writeText(preEl.querySelector('code')?.textContent || '').then(() => {
      btn.textContent = t('copied');
      setTimeout(() => btn.textContent = t('copy'), 2000);
    });
  };
  preEl.style.position = 'relative';
  preEl.appendChild(btn);
}

function copyMsg(btn) {
  const text = btn.closest('.msg-content').querySelector('.msg-bubble').innerText;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = t('copied');
    setTimeout(() => btn.textContent = t('copy'), 2000);
  });
}

function appendFileCard(fileData) {
  const c = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg ai';
  const ext = fileData.name.split('.').pop().toLowerCase();
  const icons = { txt:'📄', md:'📝', html:'🌐', json:'🔧', csv:'📊', js:'💻', py:'🐍' };
  d.innerHTML = `
    <div class="msg-av ai-av">A</div>
    <div class="msg-content">
      <div class="file-card">
        <div class="file-card-icon">${icons[ext]||'📄'}</div>
        <div class="file-card-info">
          <div class="file-card-name">${esc(fileData.name)}</div>
          <div class="file-card-size">${fileData.content.length} chars</div>
        </div>
        <button class="file-card-btn" onclick="downloadFile('${esc(fileData.name)}','${btoa(unescape(encodeURIComponent(fileData.content)))}')">${t('download')}</button>
      </div>
    </div>`;
  c.appendChild(d); scrollDown();
}

function downloadFile(name, b64) {
  try {
    const content = decodeURIComponent(escape(atob(b64)));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    a.download = name; a.click();
  } catch { alert('Download failed'); }
}

let typingCount = 0;
function showTyping() {
  const id = `tp-${++typingCount}`;
  const c  = document.getElementById('messages');
  const d  = document.createElement('div');
  d.className = 'msg ai'; d.id = id;
  d.innerHTML = `<div class="msg-av ai-av">A</div><div class="msg-content"><div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div></div>`;
  c.appendChild(d); scrollDown(); return id;
}
function removeTyping(id) { document.getElementById(id)?.remove(); }

// ══════════════════════════════════════
//  صورة
// ══════════════════════════════════════
function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('Max 10MB'); return; }
  STATE.imageMime = file.type;
  STATE.imageName = file.name;
  const r = new FileReader();
  r.onload = ev => {
    STATE.imageBase64 = ev.target.result.split(',')[1];
    document.getElementById('img-thumb').src = ev.target.result;
    document.getElementById('img-name').textContent = file.name;
    document.getElementById('img-bar').style.display = 'flex';
    document.getElementById('user-input').focus();
  };
  r.readAsDataURL(file);
  e.target.value = '';
}

function removeImage() {
  STATE.imageBase64 = STATE.imageMime = STATE.imageName = null;
  document.getElementById('img-bar').style.display = 'none';
  document.getElementById('img-thumb').src = '';
}

// ══════════════════════════════════════
//  اقتراحات
// ══════════════════════════════════════
function quickSend(text) {
  document.getElementById('welcome').style.display = 'none';
  document.getElementById('user-input').value = text;
  autoResize(document.getElementById('user-input'));
  sendMessage();
  if (window.innerWidth <= 640) closeSidebar();
}

// ══════════════════════════════════════
//  محادثة جديدة
// ══════════════════════════════════════
function newChat() {
  STATE.messages = []; STATE.currentChatId = null;
  removeImage();
  document.getElementById('messages').innerHTML = '';
  document.getElementById('welcome').style.display = 'flex';
  document.getElementById('user-input').value = '';
  document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
  if (window.innerWidth <= 640) closeSidebar();
  document.getElementById('user-input').focus();
}

// ══════════════════════════════════════
//  المحادثات المحفوظة
// ══════════════════════════════════════
function getChats() {
  try { return JSON.parse(localStorage.getItem('amerni_chats') || '[]'); } catch { return []; }
}

function saveChat(firstMsg) {
  if (!SETTINGS.saveChats || !STATE.messages.length) return;
  if (!STATE.currentChatId) STATE.currentChatId = Date.now();
  const chats = getChats();
  const title = firstMsg?.slice(0, 38) || (t('newChat'));
  const existing = chats.findIndex(c => c.id === STATE.currentChatId);
  const chat = { id: STATE.currentChatId, title, messages: STATE.messages, date: new Date().toLocaleDateString() };
  if (existing >= 0) chats[existing] = chat; else chats.unshift(chat);
  localStorage.setItem('amerni_chats', JSON.stringify(chats.slice(0, 30)));
  loadHistory();
}

function loadHistory() {
  const chats = getChats();
  const el    = document.getElementById('history-list');
  if (!chats.length) { el.innerHTML = `<div class="history-empty">${t('noHistory')}</div>`; return; }
  el.innerHTML = chats.map(c =>
    `<div class="history-item-wrap">
      <button class="history-item ${c.id === STATE.currentChatId ? 'active' : ''}" onclick="openChat(${c.id})">💬 ${esc(c.title)}</button>
      <button class="history-del" onclick="deleteChat(${c.id},event)">✕</button>
    </div>`
  ).join('');
}

function openChat(id) {
  const chat = getChats().find(c => c.id === id);
  if (!chat) return;
  STATE.messages = [...chat.messages]; STATE.currentChatId = id;
  document.getElementById('welcome').style.display  = 'none';
  document.getElementById('messages').innerHTML     = '';
  chat.messages.forEach(m => {
    if (m.role === 'user')      appendUserMsg(m.content, null);
    else if (m.role === 'assistant') appendAIMsg(m.content);
  });
  loadHistory();
  if (window.innerWidth <= 640) closeSidebar();
}

function deleteChat(id, e) {
  e.stopPropagation();
  const chats = getChats().filter(c => c.id !== id);
  localStorage.setItem('amerni_chats', JSON.stringify(chats));
  if (STATE.currentChatId === id) newChat();
  loadHistory();
}

function clearAllChats() {
  if (!confirm(t('confirmDelete'))) return;
  localStorage.removeItem('amerni_chats');
  newChat(); loadHistory(); closeSettings();
}

// ══════════════════════════════════════
//  الإعدادات
// ══════════════════════════════════════
function openSettings()  { document.getElementById('settings-overlay').style.display = 'flex'; loadMemoryInput(); }
function closeSettings() { document.getElementById('settings-overlay').style.display = 'none'; }
function closeSettingsOutside(e) { if (e.target === document.getElementById('settings-overlay')) closeSettings(); }

function loadMemoryInput() {
  const mem = document.getElementById('memory-input');
  if (mem) mem.value = localStorage.getItem('amerni_memory') || '';
}

function saveMemory() {
  const mem = document.getElementById('memory-input');
  if (mem) localStorage.setItem('amerni_memory', mem.value.trim());
}

function toggleTheme() {
  SETTINGS.dark = document.getElementById('dark-toggle').checked;
  document.documentElement.setAttribute('data-theme', SETTINGS.dark ? 'dark' : '');
  saveSetting('dark', SETTINGS.dark);
}

function setAccent(btn, color, color2, light) {
  document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  SETTINGS.accent = { color, color2, light };
  document.documentElement.style.setProperty('--acc',       color);
  document.documentElement.style.setProperty('--acc2',      color2);
  document.documentElement.style.setProperty('--acc-light', light);
  document.documentElement.style.setProperty('--acc-glow',  light);
  saveSetting('accent', SETTINGS.accent);
}

function saveStyle() {
  SETTINGS.style  = document.getElementById('style-select').value;
  SETTINGS.length = document.getElementById('length-select').value;
  saveSetting('style',  SETTINGS.style);
  saveSetting('length', SETTINGS.length);
}

function setLang(lang) {
  SETTINGS.lang = lang;
  saveSetting('lang', lang);
  document.getElementById('app').dir = lang === 'en' ? 'ltr' : 'rtl';
  document.getElementById('app').lang = lang;
  applyLang();
  closeSettings();
}

function applyLang() {
  const isEn = SETTINGS.lang === 'en';
  document.getElementById('app').dir  = isEn ? 'ltr' : 'rtl';
  document.getElementById('app').lang = SETTINGS.lang;

  // Update dynamic text
  const ui = {
    'new-chat-btn-text':  t('newChat'),
    'placeholder-text':   null,
    'hint-text':          t('hint'),
    'welcome-title':      t('welcomeTitle'),
    'welcome-sub':        t('welcomeSub'),
  };

  const inp = document.getElementById('user-input');
  if (inp) inp.placeholder = t('placeholder');

  const hint = document.getElementById('input-hint');
  if (hint) hint.textContent = t('hint');

  const wt = document.getElementById('welcome-title');
  if (wt) wt.textContent = t('welcomeTitle');

  const ws = document.getElementById('welcome-sub');
  if (ws) ws.textContent = t('welcomeSub');

  // Update style options
  const ss = document.getElementById('style-select');
  if (ss) {
    ss.innerHTML = isEn
      ? `<option value="formal" ${SETTINGS.style==='formal'?'selected':''}>Formal</option>
         <option value="casual" ${SETTINGS.style==='casual'?'selected':''}>Casual</option>`
      : `<option value="formal" ${SETTINGS.style==='formal'?'selected':''}>فصحى رسمية</option>
         <option value="saudi"  ${SETTINGS.style==='saudi' ?'selected':''}>سعودي عامي</option>
         <option value="casual" ${SETTINGS.style==='casual'?'selected':''}>عربي بسيط</option>`;
  }

  const ls = document.getElementById('length-select');
  if (ls) {
    ls.innerHTML = isEn
      ? `<option value="short"  ${SETTINGS.length==='short' ?'selected':''}>Short</option>
         <option value="medium" ${SETTINGS.length==='medium'?'selected':''}>Balanced</option>
         <option value="long"   ${SETTINGS.length==='long'  ?'selected':''}>Detailed</option>`
      : `<option value="short"  ${SETTINGS.length==='short' ?'selected':''}>مختصر</option>
         <option value="medium" ${SETTINGS.length==='medium'?'selected':''}>متوازن</option>
         <option value="long"   ${SETTINGS.length==='long'  ?'selected':''}>مفصّل</option>`;
  }

  loadHistory();
}

function saveSetting(key, val) {
  const s = JSON.parse(localStorage.getItem('amerni_settings') || '{}');
  s[key] = val; localStorage.setItem('amerni_settings', JSON.stringify(s));
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('amerni_settings') || '{}');
  if (saved.dark      !== undefined) SETTINGS.dark      = saved.dark;
  if (saved.accent)                  SETTINGS.accent     = saved.accent;
  if (saved.style)                   SETTINGS.style      = saved.style;
  if (saved.length)                  SETTINGS.length     = saved.length;
  if (saved.lang)                    SETTINGS.lang       = saved.lang;
  if (saved.saveChats !== undefined) SETTINGS.saveChats  = saved.saveChats;

  if (SETTINGS.dark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    const dt = document.getElementById('dark-toggle');
    if (dt) dt.checked = true;
  }
  if (SETTINGS.accent?.color) {
    document.documentElement.style.setProperty('--acc',       SETTINGS.accent.color);
    document.documentElement.style.setProperty('--acc2',      SETTINGS.accent.color2);
    document.documentElement.style.setProperty('--acc-light', SETTINGS.accent.light || 'rgba(79,70,229,.12)');
    document.documentElement.style.setProperty('--acc-glow',  SETTINGS.accent.light || 'rgba(79,70,229,.12)');
  }

  const ss  = document.getElementById('style-select');
  const ls  = document.getElementById('length-select');
  const st  = document.getElementById('save-toggle');
  if (ss) ss.value = SETTINGS.style;
  if (ls) ls.value = SETTINGS.length;
  if (st) st.checked = SETTINGS.saveChats;
}

// ══════════════════════════════════════
//  Sidebar
// ══════════════════════════════════════
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('hidden'); }
function closeSidebar()  { document.getElementById('sidebar').classList.add('hidden'); }

// ══════════════════════════════════════
//  مساعدات
// ══════════════════════════════════════
function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; }
function scrollDown() { const w = document.getElementById('messages-wrap'); setTimeout(() => w.scrollTo({ top: w.scrollHeight, behavior: 'smooth' }), 50); }
function esc(t) { return (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Apple Sign In
function loginWithApple() {
  // Apple Sign In requires Apple Developer account + registered domain
  // For now show informational message
  alert('تسجيل الدخول بـ Apple يتطلب ربط نطاق مخصص (Custom Domain) في Apple Developer Console.\n\nيمكنك استخدام Google أو المتابعة كزائر في الوقت الحالي.');
}

document.addEventListener('AppleIDSignInOnSuccess', (e) => {
  const d = e.detail;
  STATE.user = {
    name: d.user ? `${d.user.name?.firstName||''} ${d.user.name?.lastName||''}`.trim() || 'Apple User' : 'Apple User',
    email: d.user?.email || '',
    photo: null,
    type: 'apple'
  };
  localStorage.setItem('amerni_user', JSON.stringify(STATE.user));
  enterApp();
});
