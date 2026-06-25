// ════════════════════════════════════════
//  آمرني v8 — app.js
//  Complete rewrite: clean, consistent, fully working
// ════════════════════════════════════════

// ── State ────────────────────────────────
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
  lang:      'ar',
  style:     'formal',
  length:    'medium',
  saveChats: true,
};

// ── i18n strings ─────────────────────────
const UI = {
  ar: {
    newChat:        'محادثة جديدة',
    historyLabel:   'المحادثات السابقة',
    noHistory:      'لا توجد محادثات سابقة',
    guest:          'زائر',
    guestStatus:    'تصفح كزائر',
    placeholder:    'اكتب رسالتك...',
    disclaimer:     'آمرني قد يُخطئ أحياناً — يُرجى التحقق من المعلومات المهمة',
    settings:       'الإعدادات',
    lbl_account:    'الحساب',
    lbl_lang:       'لغة الواجهة',
    lbl_appearance: 'المظهر',
    darkMode:       'الوضع الداكن',
    lbl_responses:  'الردود',
    lbl_style:      'أسلوب الرد',
    lbl_length:     'طول الرد',
    lbl_memory:     'الذاكرة',
    memoryDesc:     'معلومات تريدني أتذكرها في كل محادثة',
    memoryHint:     'تُضاف هذه المعلومات في كل محادثة لأفهمك أفضل',
    memoryPlaceholder: 'مثال: أنا مطور برمجيات، أفضّل الشرح بأمثلة عملية...',
    saveMemory:     'حفظ',
    lbl_chats:      'المحادثات',
    autosave:       'حفظ تلقائي',
    deleteAll:      '🗑 حذف جميع المحادثات',
    lbl_about:      'عن التطبيق',
    aboutVer:       'الإصدار 8.0 · PDF · Word · Excel · PPT',
    login:          'تسجيل الدخول',
    logout:         'تسجيل الخروج',
    welcomeTitle:   'كيف يمكنني مساعدتك؟',
    welcomeSub:     'اسألني عن أي شيء — أكتب، أحلل، أترجم، أبرمج، وأنشئ ملفات',
    copy:           'نسخ',
    copied:         '✓ تم',
    download:       '⬇ تحميل',
    confirmDelete:  'تأكيد حذف جميع المحادثات؟',
    confirmLogout:  'تأكيد تسجيل الخروج؟',
    generating:     (type) => `جارٍ إنشاء ملف ${type}...`,
    genReady:       (type) => `ملف ${type} جاهز ✅`,
    genFailed:      'فشل إنشاء الملف',
    analyzeImage:   'حلل هذه الصورة',
    styleOpts:      [['formal','فصحى رسمية'],['saudi','سعودي عامي'],['casual','عربي بسيط']],
    lengthOpts:     [['short','مختصر'],['medium','متوازن'],['long','مفصّل']],
  },
  en: {
    newChat:        'New Chat',
    historyLabel:   'Recent Chats',
    noHistory:      'No chats yet',
    guest:          'Guest',
    guestStatus:    'Browsing as guest',
    placeholder:    'Message Amerni...',
    disclaimer:     'Amerni can make mistakes — please verify important information',
    settings:       'Settings',
    lbl_account:    'Account',
    lbl_lang:       'Interface Language',
    lbl_appearance: 'Appearance',
    darkMode:       'Dark Mode',
    lbl_responses:  'Responses',
    lbl_style:      'Response Style',
    lbl_length:     'Response Length',
    lbl_memory:     'Memory',
    memoryDesc:     'Information you want me to remember',
    memoryHint:     'This info is included in every chat so I understand you better',
    memoryPlaceholder: 'Example: I\'m a software engineer, I prefer practical examples...',
    saveMemory:     'Save',
    lbl_chats:      'Chats',
    autosave:       'Auto-save',
    deleteAll:      '🗑 Delete All Chats',
    lbl_about:      'About',
    aboutVer:       'Version 8.0 · PDF · Word · Excel · PPT',
    login:          'Sign In',
    logout:         'Sign Out',
    welcomeTitle:   'How can I help you?',
    welcomeSub:     'Ask me anything — write, analyze, translate, code, and create files',
    copy:           'Copy',
    copied:         '✓ Done',
    download:       '⬇ Download',
    confirmDelete:  'Delete all chats?',
    confirmLogout:  'Sign out?',
    generating:     (type) => `Generating ${type} file...`,
    genReady:       (type) => `${type} file ready ✅`,
    genFailed:      'File generation failed',
    analyzeImage:   'Analyze this image',
    styleOpts:      [['formal','Formal'],['casual','Casual']],
    lengthOpts:     [['short','Short'],['medium','Balanced'],['long','Detailed']],
  }
};

function t(key, ...args) {
  const val = UI[SETTINGS.lang]?.[key] ?? UI.ar[key] ?? key;
  return typeof val === 'function' ? val(...args) : val;
}

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  checkAuth();
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
  }
});

// ════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════
function checkAuth() {
  const saved = localStorage.getItem('amerni_user');
  if (saved) {
    try { STATE.user = JSON.parse(saved); enterApp(); } catch { localStorage.removeItem('amerni_user'); }
  }
}

function handleGoogleLogin(response) {
  try {
    const raw   = response.credential.split('.')[1];
    const pad   = raw + '==='.slice(0, (4 - raw.length % 4) % 4);
    const data  = JSON.parse(atob(pad.replace(/-/g,'+').replace(/_/g,'/')));
    STATE.user  = { name: data.name || 'Google User', email: data.email || '', photo: data.picture || null, type: 'google' };
    localStorage.setItem('amerni_user', JSON.stringify(STATE.user));
    enterApp();
  } catch (err) { alert('Login error: ' + err.message); }
}

function loginAsGuest() {
  STATE.user = { name: t('guest'), email: '', photo: null, type: 'guest' };
  enterApp();
}

function loginWithApple() {
  const msg = SETTINGS.lang === 'en'
    ? 'Apple Sign In requires a registered custom domain in Apple Developer Console.\n\nUse Google or continue as Guest for now.'
    : 'تسجيل الدخول بـ Apple يتطلب ربط نطاق مخصص في Apple Developer Console.\n\nيمكنك استخدام Google أو المتابعة كزائر.';
  alert(msg);
}

document.addEventListener('AppleIDSignInOnSuccess', (e) => {
  const d = e.detail;
  STATE.user = {
    name:  d.user ? `${d.user.name?.firstName||''} ${d.user.name?.lastName||''}`.trim() || 'Apple User' : 'Apple User',
    email: d.user?.email || '',
    photo: null, type: 'apple'
  };
  localStorage.setItem('amerni_user', JSON.stringify(STATE.user));
  enterApp();
});

function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  const app = document.getElementById('app');
  app.style.display = 'flex';

  // Show sidebar on desktop, hide on mobile by default
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 640) {
    sidebar.classList.add('hidden');
  } else {
    sidebar.classList.remove('hidden');
  }

  applyLang(false);
  updateUserUI();
  loadHistory();
  setTimeout(() => document.getElementById('user-input').focus(), 100);
}

function updateUserUI() {
  if (!STATE.user) return;
  const { name, email, photo, type } = STATE.user;
  const initial = (name || '?').charAt(0).toUpperCase();
  const photoHTML = photo ? `<img src="${photo}" alt=""/>` : initial;

  // Sidebar user chip
  const ua = document.getElementById('user-avatar');
  const un = document.getElementById('user-name');
  const us = document.getElementById('user-status');
  if (ua) ua.innerHTML = photoHTML;
  if (un) un.textContent = name;
  if (us) us.textContent = type === 'google' || type === 'apple' ? (email || type) : t('guestStatus');

  // Settings account card
  const sa = document.getElementById('acc-avatar');
  const sn = document.getElementById('acc-name');
  const se = document.getElementById('acc-email');
  const sb = document.getElementById('acc-action-btn');
  if (sa) sa.innerHTML = photoHTML;
  if (sn) sn.textContent = name;
  if (se) se.textContent = email || (type === 'guest' ? t('guestStatus') : '');
  if (sb) {
    sb.textContent = type === 'guest' ? t('login') : t('logout');
    sb.className   = 's-account-btn' + (type !== 'guest' ? ' logout' : '');
  }
}

function handleAccountAction() {
  if (STATE.user?.type === 'guest') {
    closeSettings();
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  } else {
    if (confirm(t('confirmLogout'))) {
      localStorage.removeItem('amerni_user');
      STATE.user = null;
      closeSettings();
      document.getElementById('app').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
    }
  }
}

// ════════════════════════════════════════
//  SEND MESSAGE
// ════════════════════════════════════════
async function sendMessage() {
  if (STATE.isLoading) return;
  const input   = document.getElementById('user-input');
  const content = input.value.trim();
  if (!content && !STATE.imageBase64) return;

  // Hide welcome
  document.getElementById('welcome').style.display = 'none';

  const userMsg = { role: 'user', content: content || t('analyzeImage') };
  STATE.messages.push(userMsg);
  appendUserMsg(content, STATE.imageBase64);

  input.value = '';
  autoResize(input);
  removeImage();

  STATE.isLoading = true;
  document.getElementById('send-btn').disabled = true;
  const typingId = showTyping();

  try {
    const memory = localStorage.getItem('amerni_memory') || '';

    const res = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: STATE.messages,
        style:    SETTINGS.style  || 'formal',
        length:   SETTINGS.length || 'medium',
        lang:     SETTINGS.lang,
        userName: STATE.user?.name || t('guest'),
        memory,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    removeTyping(typingId);
    STATE.messages.push({ role: 'assistant', content: data.reply });
    await appendAIMsgTyping(data.reply);

    if (data.generateData) await handleFileGeneration(data.generateData, data.reply);
    if (data.fileData)     appendFileCard(data.fileData);

    saveChat(content);

  } catch (err) {
    removeTyping(typingId);
    appendAIMsg(`⚠️ ${err.message}`);
  }

  STATE.isLoading = false;
  document.getElementById('send-btn').disabled = false;
  input.focus();
}

function quickSend(text) {
  document.getElementById('welcome').style.display = 'none';
  const inp = document.getElementById('user-input');
  inp.value = text;
  autoResize(inp);
  sendMessage();
  if (window.innerWidth <= 640) closeSidebar();
}

// ════════════════════════════════════════
//  MESSAGE RENDERING
// ════════════════════════════════════════
function appendUserMsg(text, img64) {
  const c = document.getElementById('msgs');
  const d = document.createElement('div');
  d.className = 'msg user';
  const photo   = STATE.user?.photo;
  const initial = (STATE.user?.name || 'U').charAt(0).toUpperCase();
  d.innerHTML = `
    <div class="msg-av user-av">${photo ? `<img src="${photo}" alt=""/>` : initial}</div>
    <div class="msg-content">
      ${img64 ? `<img src="data:image/jpeg;base64,${img64}" class="msg-image" alt=""/>` : ''}
      ${text  ? `<div class="msg-bubble">${esc(text)}</div>` : ''}
    </div>`;
  c.appendChild(d); scrollDown();
}

function appendAIMsg(text) {
  const c = document.getElementById('msgs');
  const d = document.createElement('div');
  d.className = 'msg ai';
  const html = parseMarkdown(text);
  d.innerHTML = `
    <div class="msg-av ai-av"><img src="logo.png" alt=""/></div>
    <div class="msg-content">
      <div class="msg-bubble">${html}</div>
      <div class="msg-actions">
        <button class="action-btn" onclick="copyMsg(this)">${t('copy')}</button>
      </div>
    </div>`;
  c.appendChild(d);
  d.querySelectorAll('pre code').forEach(el => addCopyCodeBtn(el.closest('pre')));
  scrollDown();
  return d;
}

async function appendAIMsgTyping(text) {
  const c = document.getElementById('msgs');
  const d = document.createElement('div');
  d.className = 'msg ai';
  d.innerHTML = `
    <div class="msg-av ai-av"><img src="logo.png" alt=""/></div>
    <div class="msg-content">
      <div class="msg-bubble"></div>
      <div class="msg-actions" style="opacity:0;pointer-events:none">
        <button class="action-btn" onclick="copyMsg(this)">${t('copy')}</button>
      </div>
    </div>`;
  c.appendChild(d); scrollDown();

  const bubble  = d.querySelector('.msg-bubble');
  const actions = d.querySelector('.msg-actions');
  bubble.style.opacity    = '0';
  bubble.style.transition = 'opacity .22s ease';
  bubble.innerHTML        = parseMarkdown(text);

  await new Promise(r => setTimeout(r, 25));
  bubble.style.opacity    = '1';
  actions.style.opacity   = '';
  actions.style.pointerEvents = '';

  d.querySelectorAll('pre code').forEach(el => addCopyCodeBtn(el.closest('pre')));
  scrollDown();
  return d;
}

function parseMarkdown(text) {
  if (typeof marked !== 'undefined') return marked.parse(text);
  return esc(text).replace(/\n/g, '<br/>');
}

function addCopyCodeBtn(preEl) {
  if (!preEl || preEl.querySelector('.copy-code-btn')) return;
  const btn = document.createElement('button');
  btn.className   = 'copy-code-btn';
  btn.textContent = t('copy');
  btn.onclick = () => {
    const code = preEl.querySelector('code')?.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      btn.textContent = t('copied');
      setTimeout(() => btn.textContent = t('copy'), 2000);
    });
  };
  preEl.style.position = 'relative';
  preEl.appendChild(btn);
}

function copyMsg(btn) {
  const text = btn.closest('.msg-content')?.querySelector('.msg-bubble')?.innerText || '';
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = t('copied');
    setTimeout(() => btn.textContent = t('copy'), 2000);
  });
}

// ════════════════════════════════════════
//  TYPING INDICATOR
// ════════════════════════════════════════
let _typingN = 0;
function showTyping() {
  const id = `tp-${++_typingN}`;
  const c  = document.getElementById('msgs');
  const d  = document.createElement('div');
  d.id = id; d.className = 'msg ai';
  d.innerHTML = `
    <div class="msg-av ai-av"><img src="logo.png" alt=""/></div>
    <div class="msg-content">
      <div class="msg-bubble">
        <div class="typing"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  c.appendChild(d); scrollDown(); return id;
}
function removeTyping(id) { document.getElementById(id)?.remove(); }

// ════════════════════════════════════════
//  FILE CARDS
// ════════════════════════════════════════
function appendFileCard(fileData) {
  const c = document.getElementById('msgs');
  const d = document.createElement('div');
  d.className = 'msg ai';
  const ext   = fileData.name.split('.').pop().toLowerCase();
  const icons = { txt:'📄', md:'📝', html:'🌐', json:'🔧', csv:'📊', js:'💻', py:'🐍' };
  const b64   = btoa(unescape(encodeURIComponent(fileData.content)));
  d.innerHTML = `
    <div class="msg-av ai-av"><img src="logo.png" alt=""/></div>
    <div class="msg-content">
      <div class="file-card">
        <div class="file-card-icon">${icons[ext]||'📄'}</div>
        <div class="file-card-info">
          <div class="file-card-name">${esc(fileData.name)}</div>
          <div class="file-card-size">${fileData.content.length} chars</div>
        </div>
        <button class="file-card-btn" onclick="downloadFile('${esc(fileData.name)}','${b64}')">${t('download')}</button>
      </div>
    </div>`;
  c.appendChild(d); scrollDown();
}

function downloadFile(name, b64) {
  try {
    const content = decodeURIComponent(escape(atob(b64)));
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    a.download = name; a.click();
  } catch { alert(SETTINGS.lang === 'en' ? 'Download failed' : 'فشل التحميل'); }
}

// ════════════════════════════════════════
//  PROFESSIONAL FILE GENERATION
// ════════════════════════════════════════
async function handleFileGeneration(genData, contentText) {
  const typeLabel = { pdf:'PDF', docx:'Word', xlsx:'Excel', pptx:'PowerPoint' }[genData.type] || genData.type.toUpperCase();
  const icons     = { pdf:'📄', docx:'📝', xlsx:'📊', pptx:'📑' };
  const icon      = icons[genData.type] || '📄';
  const cardId    = 'gen-' + Date.now();

  // Insert loading card
  const c = document.getElementById('msgs');
  const d = document.createElement('div');
  d.id = cardId; d.className = 'msg ai';
  d.innerHTML = `
    <div class="msg-av ai-av"><img src="logo.png" alt=""/></div>
    <div class="msg-content">
      <div class="gen-card" id="${cardId}-card">
        <div class="gen-card-icon">${icon}</div>
        <div class="gen-card-info">
          <div class="gen-card-name">${esc(genData.filename||'document')}.${genData.type}</div>
          <div class="gen-card-status">${t('generating', typeLabel)}</div>
        </div>
        <div class="gen-spinner"></div>
      </div>
    </div>`;
  c.appendChild(d); scrollDown();

  try {
    const res = await fetch('/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:     genData.type,
        content:  contentText,
        filename: genData.filename || 'document',
        lang:     genData.lang || SETTINGS.lang,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob     = await res.blob();
    const url      = URL.createObjectURL(blob);
    const isPDF    = genData.type === 'pdf';
    // PDF is actually an HTML file that triggers print dialog — open in new tab
    // Other formats download directly
    const filename = `${genData.filename||'document'}.${isPDF ? 'html' : genData.type}`;
    const displayName = `${genData.filename||'document'}.pdf`;

    const card = document.getElementById(`${cardId}-card`);
    if (card) {
      card.className = 'gen-card ready';
      if (isPDF) {
        // Open in new tab → print dialog auto-fires → user saves as PDF
        card.innerHTML = `
          <div class="gen-card-icon">✅</div>
          <div class="gen-card-info">
            <div class="gen-card-name">${esc(displayName)}</div>
            <div class="gen-card-status done">${t('genReady', typeLabel)}</div>
          </div>
          <a class="file-card-btn" href="${url}" target="_blank" rel="noopener">${t('download')}</a>`;
      } else {
        card.innerHTML = `
          <div class="gen-card-icon">✅</div>
          <div class="gen-card-info">
            <div class="gen-card-name">${esc(filename)}</div>
            <div class="gen-card-status done">${t('genReady', typeLabel)}</div>
          </div>
          <a class="file-card-btn" href="${url}" download="${esc(filename)}">${t('download')}</a>`;
      }
      scrollDown();
    }
  } catch (err) {
    const card = document.getElementById(`${cardId}-card`);
    if (card) {
      card.className = 'gen-card failed';
      card.innerHTML = `
        <div class="gen-card-icon">⚠️</div>
        <div class="gen-card-info">
          <div class="gen-card-name">${t('genFailed')}</div>
          <div class="gen-card-status fail">${esc(err.message)}</div>
        </div>`;
    }
  }
}

// ════════════════════════════════════════
//  IMAGE HANDLING
// ════════════════════════════════════════
function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    alert(SETTINGS.lang === 'en' ? 'Max image size is 10MB' : 'الحجم الأقصى للصورة 10 ميغابايت');
    return;
  }
  STATE.imageMime = file.type;
  STATE.imageName = file.name;
  const r = new FileReader();
  r.onload = ev => {
    STATE.imageBase64 = ev.target.result.split(',')[1];
    document.getElementById('img-thumb').src       = ev.target.result;
    document.getElementById('img-name').textContent = file.name;
    document.getElementById('img-preview').style.display = 'flex';
    document.getElementById('user-input').focus();
  };
  r.readAsDataURL(file);
  e.target.value = '';
}

function removeImage() {
  STATE.imageBase64 = STATE.imageMime = STATE.imageName = null;
  document.getElementById('img-preview').style.display = 'none';
  document.getElementById('img-thumb').src = '';
  document.getElementById('img-name').textContent = '';
}

// ════════════════════════════════════════
//  NEW CHAT
// ════════════════════════════════════════
function newChat() {
  STATE.messages      = [];
  STATE.currentChatId = null;
  removeImage();
  document.getElementById('msgs').innerHTML          = '';
  document.getElementById('welcome').style.display   = 'flex';
  document.getElementById('user-input').value        = '';
  document.querySelectorAll('.h-item-btn').forEach(b => b.classList.remove('active'));
  if (window.innerWidth <= 640) closeSidebar();
  setTimeout(() => document.getElementById('user-input').focus(), 50);
}

// ════════════════════════════════════════
//  CHAT HISTORY
// ════════════════════════════════════════
function getChats() {
  try { return JSON.parse(localStorage.getItem('amerni_chats') || '[]'); } catch { return []; }
}

function saveChat(firstMsg) {
  if (!SETTINGS.saveChats || !STATE.messages.length) return;
  if (!STATE.currentChatId) STATE.currentChatId = Date.now();
  const chats = getChats();
  const title = (firstMsg || t('newChat')).slice(0, 40);
  const chat  = { id: STATE.currentChatId, title, messages: STATE.messages, date: Date.now() };
  const idx   = chats.findIndex(c => c.id === STATE.currentChatId);
  if (idx >= 0) chats[idx] = chat; else chats.unshift(chat);
  localStorage.setItem('amerni_chats', JSON.stringify(chats.slice(0, 30)));
  loadHistory();
}

function loadHistory() {
  const chats = getChats();
  const el    = document.getElementById('history-list');
  if (!chats.length) {
    el.innerHTML = `<p class="history-empty">${t('noHistory')}</p>`;
    return;
  }
  el.innerHTML = chats.map(c => `
    <div class="history-item-row">
      <button class="h-item-btn ${c.id === STATE.currentChatId ? 'active' : ''}" onclick="openChat(${c.id})">💬 ${esc(c.title)}</button>
      <button class="h-del-btn" onclick="deleteChat(${c.id},event)" title="حذف">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
}

function openChat(id) {
  const chat = getChats().find(c => c.id === id);
  if (!chat) return;
  STATE.messages = [...chat.messages];
  STATE.currentChatId = id;
  document.getElementById('welcome').style.display = 'none';
  document.getElementById('msgs').innerHTML = '';
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
  else loadHistory();
}

function clearAllChats() {
  if (!confirm(t('confirmDelete'))) return;
  localStorage.removeItem('amerni_chats');
  newChat(); loadHistory(); closeSettings();
}

// ════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════
function openSettings() {
  const el = document.getElementById('settings-backdrop');
  el.style.display = 'flex';
  // Load memory text
  const mem = document.getElementById('memory-input');
  if (mem) mem.value = localStorage.getItem('amerni_memory') || '';
  // Sync toggles
  const dt = document.getElementById('dark-toggle');
  if (dt) dt.checked = SETTINGS.dark;
  const at = document.getElementById('autosave-toggle');
  if (at) at.checked = SETTINGS.saveChats;
  // Sync selects
  const ss = document.getElementById('style-select');
  if (ss) ss.value = SETTINGS.style || 'formal';
  const ls = document.getElementById('length-select');
  if (ls) ls.value = SETTINGS.length || 'medium';
  // Sync lang buttons
  document.getElementById('lang-btn-ar')?.classList.toggle('active', SETTINGS.lang === 'ar');
  document.getElementById('lang-btn-en')?.classList.toggle('active', SETTINGS.lang === 'en');
}

function closeSettings() {
  const el = document.getElementById('settings-backdrop');
  if (el) el.style.display = 'none';
}

function closeSettingsBackdrop(e) {
  // No-op: full page, no outside click to close
}

function saveMemory() {
  const mem = document.getElementById('memory-input');
  if (!mem) return;
  localStorage.setItem('amerni_memory', mem.value.trim());
  const span = document.getElementById('txt-save-memory');
  if (span) {
    const orig = span.textContent;
    span.textContent = '✓';
    setTimeout(() => span.textContent = t('saveMemory'), 1600);
  }
}

function toggleTheme() {
  SETTINGS.dark = document.getElementById('dark-toggle').checked;
  document.documentElement.setAttribute('data-theme', SETTINGS.dark ? 'dark' : 'light');
  saveSetting('dark', SETTINGS.dark);
}

function saveResponseSettings() {
  const ss = document.getElementById('style-select');
  const ls = document.getElementById('length-select');
  if (ss) { SETTINGS.style  = ss.value; saveSetting('style',  ss.value); }
  if (ls) { SETTINGS.length = ls.value; saveSetting('length', ls.value); }
}

function setLang(lang) {
  SETTINGS.lang = lang;
  saveSetting('lang', lang);
  applyLang(true);
  closeSettings();
}

function applyLang(reloadHistory = true) {
  const isEn = SETTINGS.lang === 'en';
  const app  = document.getElementById('app');
  if (app) { app.dir = isEn ? 'ltr' : 'rtl'; app.lang = SETTINGS.lang; }

  // Textarea direction
  const inp = document.getElementById('user-input');
  if (inp) {
    inp.placeholder = t('placeholder');
    inp.dir = isEn ? 'ltr' : 'rtl';
  }

  // Text elements map
  const elMap = {
    'txt-new-chat':       t('newChat'),
    'txt-history-label':  t('historyLabel'),
    'txt-no-history':     t('noHistory'),
    'txt-welcome-title':  null, // handled separately (has span)
    'txt-welcome-sub':    t('welcomeSub'),
    'txt-disclaimer':     t('disclaimer'),
    'txt-settings':       t('settings'),
    'txt-lbl-account':    t('lbl_account'),
    'txt-lbl-lang':       t('lbl_lang'),
    'txt-lbl-appearance': t('lbl_appearance'),
    'txt-dark-mode':      t('darkMode'),
    'txt-lbl-responses':  t('lbl_responses'),
    'txt-lbl-style':      t('lbl_style'),
    'txt-lbl-length':     t('lbl_length'),
    'txt-lbl-memory':     t('lbl_memory'),
    'txt-memory-desc':    t('memoryDesc'),
    'txt-memory-hint':    t('memoryHint'),
    'txt-save-memory':    t('saveMemory'),
    'txt-lbl-chats':      t('lbl_chats'),
    'txt-autosave':       t('autosave'),
    'txt-delete-all':     t('deleteAll'),
    'txt-lbl-about':      t('lbl_about'),
    'txt-about-ver':      t('aboutVer'),
    'txt-back':           SETTINGS.lang === 'en' ? 'Back' : 'رجوع',
  };

  Object.entries(elMap).forEach(([id, text]) => {
    if (text === null) return;
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  // Welcome title with gradient span
  const wt = document.getElementById('txt-welcome-title');
  if (wt) {
    const titles = {
      ar: 'كيف يمكنني <span>مساعدتك؟</span>',
      en: 'How can I <span>help you?</span>',
    };
    wt.innerHTML = titles[SETTINGS.lang] || titles.ar;
  }

  // Memory placeholder
  const mi = document.getElementById('memory-input');
  if (mi) mi.placeholder = t('memoryPlaceholder');

  // Rebuild style & length select options
  const ss = document.getElementById('style-select');
  if (ss) {
    ss.innerHTML = t('styleOpts').map(([v,l]) =>
      `<option value="${v}" ${SETTINGS.style===v?'selected':''}>${l}</option>`
    ).join('');
  }
  const ls = document.getElementById('length-select');
  if (ls) {
    ls.innerHTML = t('lengthOpts').map(([v,l]) =>
      `<option value="${v}" ${SETTINGS.length===v?'selected':''}>${l}</option>`
    ).join('');
  }

  // Lang buttons
  document.getElementById('lang-btn-ar')?.classList.toggle('active', !isEn);
  document.getElementById('lang-btn-en')?.classList.toggle('active', isEn);

  if (reloadHistory) loadHistory();
  updateUserUI();
}

function saveSetting(key, val) {
  const s = JSON.parse(localStorage.getItem('amerni_settings') || '{}');
  s[key] = val;
  localStorage.setItem('amerni_settings', JSON.stringify(s));
}

function loadSettings() {
  const s = JSON.parse(localStorage.getItem('amerni_settings') || '{}');
  if (s.dark      !== undefined) SETTINGS.dark      = s.dark;
  if (s.lang)                    SETTINGS.lang       = s.lang;
  if (s.style)                   SETTINGS.style      = s.style;
  if (s.length)                  SETTINGS.length     = s.length;
  if (s.saveChats !== undefined) SETTINGS.saveChats  = s.saveChats;

  // Apply dark mode immediately
  document.documentElement.setAttribute('data-theme', SETTINGS.dark ? 'dark' : 'light');

  // Apply lang to html element
  document.documentElement.lang = SETTINGS.lang;
  document.documentElement.dir  = SETTINGS.lang === 'en' ? 'ltr' : 'rtl';
}

// ════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  const isHidden = sb.classList.toggle('hidden');
  if (ov) ov.classList.toggle('active', !isHidden && window.innerWidth <= 640);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.add('hidden');
  const ov = document.getElementById('sidebar-overlay');
  if (ov) ov.classList.remove('active');
}

// ════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function scrollDown() {
  const w = document.getElementById('msgs-wrap');
  if (w) setTimeout(() => w.scrollTo({ top: w.scrollHeight, behavior: 'smooth' }), 50);
}

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}