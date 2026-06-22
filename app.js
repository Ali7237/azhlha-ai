// ════════════════════════════════════════
//  أزهلها — app.js  v6
// ════════════════════════════════════════

const STATE = {
  messages:      [],
  imageBase64:   null,
  imageMime:     null,
  imageName:     null,
  isLoading:     false,
  currentChatId: null,
  user:          null,
  typingInterval: null,
};

const SETTINGS = {
  dark:       true,
  accent:     { color: '#a78bfa', color2: '#7c3aed' },
  style:      'saudi',
  length:     'medium',
  saveChats:  true,
};

// ══════════════════════════════════════
//  تهيئة
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
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
  const saved = localStorage.getItem('azhlha_user');
  if (saved) {
    STATE.user = JSON.parse(saved);
    enterApp();
  }
}

function handleGoogleLogin(response) {
  try {
    const base64 = response.credential.split('.')[1];
    const pad = base64.length % 4 === 0 ? base64 : base64 + '==='.slice(0, 4 - base64.length % 4);
    const payload = JSON.parse(atob(pad.replace(/-/g, '+').replace(/_/g, '/')));
    STATE.user = {
      name:  payload.name  || 'مستخدم Google',
      email: payload.email || '',
      photo: payload.picture || null,
      type:  'google',
    };
    localStorage.setItem('azhlha_user', JSON.stringify(STATE.user));
    enterApp();
  } catch (err) {
    alert('حدث خطأ في تسجيل الدخول: ' + err.message);
  }
}

function loginAsGuest() {
  STATE.user = { name: 'زائر', email: '', photo: null, type: 'guest' };
  enterApp();
}

function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  updateUserUI();
  loadHistory();
  document.getElementById('user-input').focus();
}

function updateUserUI() {
  if (!STATE.user) return;
  const name     = STATE.user.name;
  const initials = name.charAt(0).toUpperCase();
  const photo    = STATE.user.photo;

  document.getElementById('user-name').textContent   = name;
  document.getElementById('user-status').textContent = STATE.user.type === 'google' ? STATE.user.email : 'تصفح كزائر';

  const sideAvatar = document.getElementById('user-avatar');
  if (photo) {
    sideAvatar.innerHTML = `<img src="${photo}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`;
  } else {
    sideAvatar.textContent = initials;
  }

  document.getElementById('acc-name').textContent  = name;
  document.getElementById('acc-email').textContent = STATE.user.email || 'بدون بريد';

  const accAvatar = document.getElementById('acc-avatar');
  if (photo) {
    accAvatar.innerHTML = `<img src="${photo}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`;
  } else {
    accAvatar.textContent = initials;
  }

  const accBtn = document.getElementById('acc-btn');
  accBtn.textContent = STATE.user.type === 'guest' ? 'دخول' : 'خروج';
  if (STATE.user.type !== 'guest') accBtn.classList.add('logout');
}

function toggleLogin() {
  if (STATE.user?.type === 'google') {
    if (confirm('تبي تخرج من حسابك؟')) {
      localStorage.removeItem('azhlha_user');
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

  const userMsg = { role: 'user', content: content || 'حلل هذه الصورة' };
  STATE.messages.push(userMsg);
  appendUserMsg(content, STATE.imageBase64);

  input.value = '';
  autoResize(input);
  const img64    = STATE.imageBase64;
  const imgMime  = STATE.imageMime;
  removeImage();

  const typingId = showTyping();
  STATE.isLoading = true;
  document.getElementById('send-btn').disabled = true;

  try {
    const res = await fetch('/.netlify/functions/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages:    STATE.messages,
        imageBase64: img64,
        mimeType:    imgMime,
        style:       SETTINGS.style,
        length:      SETTINGS.length,
        userName:    STATE.user?.name || 'زائر',
      }),
    });

    const rawText = await res.text();
    if (!rawText || rawText.trim() === '') {
      throw new Error('الـ Function ما ردت — تأكد من رفع الملفات على Netlify');
    }

    let data;
    try { data = JSON.parse(rawText); }
    catch { throw new Error('رد غير صالح: ' + rawText.slice(0, 100)); }

    if (!res.ok || data.error) throw new Error(data.error || 'خطأ في الاتصال');

    removeTyping(typingId);

    const aiMsg = { role: 'assistant', content: data.reply };
    STATE.messages.push(aiMsg);

    // عرض الرد مع تأثير الكتابة
    await appendAIMsgTyping(data.reply);

    // لو فيه ملف، اعرضه
    if (data.fileData) {
      appendFileCard(data.fileData);
    }

    saveChat(content);

  } catch (err) {
    removeTyping(typingId);
    appendAIMsg(`⚠️ **حدث خطأ:** ${err.message}`);
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
  const imgHtml = img64
    ? `<img src="data:image/jpeg;base64,${img64}" class="msg-image" alt="صورة"/>`
    : '';
  const initial = STATE.user?.name?.charAt(0)?.toUpperCase() || 'أ';
  d.innerHTML = `
    <div class="msg-av user-av">${
      STATE.user?.photo
        ? `<img src="${STATE.user.photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`
        : initial
    }</div>
    <div class="msg-content">
      ${imgHtml}
      ${text ? `<div class="msg-bubble">${esc(text)}</div>` : ''}
    </div>`;
  c.appendChild(d);
  scrollDown();
}

function appendAIMsg(text) {
  const c = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg ai';
  const html = typeof marked !== 'undefined' ? marked.parse(text) : esc(text).replace(/\n/g, '<br/>');
  d.innerHTML = `
    <div class="msg-av ai-av">أ</div>
    <div class="msg-content">
      <div class="msg-bubble">${html}</div>
      <div class="msg-actions">
        <button class="action-btn" onclick="copyMsg(this)" title="نسخ">📋</button>
      </div>
    </div>`;
  c.appendChild(d);
  // highlight code blocks
  d.querySelectorAll('pre code').forEach(el => {
    addCopyCodeBtn(el.parentElement);
  });
  scrollDown();
  return d;
}

// تأثير الكتابة التدريجية
async function appendAIMsgTyping(text) {
  const c = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg ai';
  const initial = 'أ';
  d.innerHTML = `
    <div class="msg-av ai-av">${initial}</div>
    <div class="msg-content">
      <div class="msg-bubble typing-text"></div>
      <div class="msg-actions" style="display:none">
        <button class="action-btn" onclick="copyMsg(this)" title="نسخ">📋</button>
      </div>
    </div>`;
  c.appendChild(d);
  scrollDown();

  const bubble = d.querySelector('.msg-bubble');
  const actions = d.querySelector('.msg-actions');

  // نعرض الـ markdown مباشرة (أسرع وأوضح)
  const html = typeof marked !== 'undefined' ? marked.parse(text) : esc(text).replace(/\n/g, '<br/>');

  // تأثير fade-in بدل كتابة حرف حرف (أسرع وأنعم)
  bubble.style.opacity = '0';
  bubble.innerHTML = html;
  bubble.style.transition = 'opacity 0.3s ease';

  await new Promise(r => setTimeout(r, 30));
  bubble.style.opacity = '1';
  actions.style.display = '';

  // highlight code
  d.querySelectorAll('pre code').forEach(el => {
    addCopyCodeBtn(el.parentElement);
  });

  scrollDown();
  return d;
}

function addCopyCodeBtn(preEl) {
  if (preEl.querySelector('.copy-code-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'copy-code-btn';
  btn.textContent = 'نسخ';
  btn.onclick = () => {
    const code = preEl.querySelector('code')?.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      btn.textContent = '✓ تم';
      setTimeout(() => btn.textContent = 'نسخ', 2000);
    });
  };
  preEl.style.position = 'relative';
  preEl.appendChild(btn);
}

function copyMsg(btn) {
  const bubble = btn.closest('.msg-content').querySelector('.msg-bubble');
  const text = bubble.innerText || bubble.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓';
    setTimeout(() => btn.textContent = '📋', 2000);
  });
}

// بطاقة تحميل الملف
function appendFileCard(fileData) {
  const c = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg ai';

  const ext = fileData.name.split('.').pop().toLowerCase();
  const icons = { txt: '📄', md: '📝', html: '🌐', json: '🔧', csv: '📊', js: '💻', py: '🐍' };
  const icon = icons[ext] || '📄';

  d.innerHTML = `
    <div class="msg-av ai-av">أ</div>
    <div class="msg-content">
      <div class="file-card">
        <div class="file-card-icon">${icon}</div>
        <div class="file-card-info">
          <div class="file-card-name">${esc(fileData.name)}</div>
          <div class="file-card-size">${fileData.content.length} حرف</div>
        </div>
        <button class="file-card-btn" onclick="downloadFile('${esc(fileData.name)}', \`${btoa(unescape(encodeURIComponent(fileData.content)))}\`)">
          ⬇️ تحميل
        </button>
      </div>
    </div>`;
  c.appendChild(d);
  scrollDown();
}

function downloadFile(name, b64Content) {
  try {
    const content = decodeURIComponent(escape(atob(b64Content)));
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert('ما قدرت أحمّل الملف');
  }
}

let typingCount = 0;
function showTyping() {
  const id = `tp-${++typingCount}`;
  const c  = document.getElementById('messages');
  const d  = document.createElement('div');
  d.className = 'msg ai'; d.id = id;
  d.innerHTML = `
    <div class="msg-av ai-av">أ</div>
    <div class="msg-content"><div class="msg-bubble">
      <div class="typing"><span></span><span></span><span></span></div>
    </div></div>`;
  c.appendChild(d); scrollDown();
  return id;
}
function removeTyping(id) { document.getElementById(id)?.remove(); }

// ══════════════════════════════════════
//  صورة
// ══════════════════════════════════════
function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('الصورة كبيرة! الحد 10MB'); return; }
  STATE.imageMime = file.type;
  STATE.imageName = file.name;
  const r = new FileReader();
  r.onload = (ev) => {
    STATE.imageBase64 = ev.target.result.split(',')[1];
    document.getElementById('img-thumb').src = ev.target.result;
    document.getElementById('img-name').textContent = file.name;
    document.getElementById('img-bar').style.display = 'flex';
    document.getElementById('user-input').placeholder = 'اسأل عن الصورة أو أرسل مباشرة...';
    document.getElementById('user-input').focus();
  };
  r.readAsDataURL(file);
  e.target.value = '';
}

function removeImage() {
  STATE.imageBase64 = STATE.imageMime = STATE.imageName = null;
  document.getElementById('img-bar').style.display = 'none';
  document.getElementById('img-thumb').src = '';
  document.getElementById('user-input').placeholder = 'اكتب سؤالك هنا...';
}

// ══════════════════════════════════════
//  اقتراحات سريعة
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

function clearChat() {
  if (!STATE.messages.length || confirm('تأكيد مسح المحادثة؟')) newChat();
}

// ══════════════════════════════════════
//  المحادثات المحفوظة
// ══════════════════════════════════════
function getChats() {
  try { return JSON.parse(localStorage.getItem('azhlha_chats') || '[]'); } catch { return []; }
}

function saveChat(firstMsg) {
  if (!SETTINGS.saveChats || !STATE.messages.length) return;
  if (!STATE.currentChatId) STATE.currentChatId = Date.now();
  const chats    = getChats();
  const title    = firstMsg?.slice(0, 38) || 'محادثة';
  const existing = chats.findIndex(c => c.id === STATE.currentChatId);
  const chat     = { id: STATE.currentChatId, title, messages: STATE.messages, date: new Date().toLocaleDateString('ar') };
  if (existing >= 0) chats[existing] = chat;
  else chats.unshift(chat);
  localStorage.setItem('azhlha_chats', JSON.stringify(chats.slice(0, 30)));
  loadHistory();
}

function loadHistory() {
  const chats = getChats();
  const el    = document.getElementById('history-list');
  if (!chats.length) { el.innerHTML = '<div class="history-empty">ما في محادثات بعد</div>'; return; }
  el.innerHTML = chats.map(c =>
    `<div class="history-item-wrap">
      <button class="history-item ${c.id === STATE.currentChatId ? 'active' : ''}" onclick="openChat(${c.id})">
        💬 ${esc(c.title)}
      </button>
      <button class="history-del" onclick="deleteChat(${c.id}, event)" title="حذف">✕</button>
    </div>`
  ).join('');
}

function openChat(id) {
  const chat = getChats().find(c => c.id === id);
  if (!chat) return;
  STATE.messages = [...chat.messages];
  STATE.currentChatId = id;
  document.getElementById('welcome').style.display  = 'none';
  document.getElementById('messages').innerHTML     = '';
  chat.messages.forEach(m => {
    if (m.role === 'user')           appendUserMsg(m.content, null);
    else if (m.role === 'assistant') appendAIMsg(m.content);
  });
  loadHistory();
  if (window.innerWidth <= 640) closeSidebar();
}

function deleteChat(id, e) {
  e.stopPropagation();
  const chats = getChats().filter(c => c.id !== id);
  localStorage.setItem('azhlha_chats', JSON.stringify(chats));
  if (STATE.currentChatId === id) newChat();
  loadHistory();
}

function clearAllChats() {
  if (!confirm('تأكيد مسح كل المحادثات؟')) return;
  localStorage.removeItem('azhlha_chats');
  newChat();
  loadHistory();
  closeSettings();
}

// ══════════════════════════════════════
//  الإعدادات
// ══════════════════════════════════════
function openSettings()  { document.getElementById('settings-overlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settings-overlay').style.display = 'none'; }
function closeSettingsOutside(e) {
  if (e.target === document.getElementById('settings-overlay')) closeSettings();
}

function toggleTheme() {
  SETTINGS.dark = document.getElementById('dark-toggle').checked;
  document.documentElement.setAttribute('data-theme', SETTINGS.dark ? '' : 'light');
  saveSetting('dark', SETTINGS.dark);
}

function setAccent(btn, color, color2) {
  document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  SETTINGS.accent = { color, color2 };
  document.documentElement.style.setProperty('--acc',  color);
  document.documentElement.style.setProperty('--acc2', color2);
  saveSetting('accent', SETTINGS.accent);
}

function saveStyle() {
  SETTINGS.style  = document.getElementById('style-select').value;
  SETTINGS.length = document.getElementById('length-select').value;
  saveSetting('style',  SETTINGS.style);
  saveSetting('length', SETTINGS.length);
}

function saveSetting(key, val) {
  const s = JSON.parse(localStorage.getItem('azhlha_settings') || '{}');
  s[key] = val;
  localStorage.setItem('azhlha_settings', JSON.stringify(s));
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('azhlha_settings') || '{}');
  if (saved.dark      !== undefined) SETTINGS.dark      = saved.dark;
  if (saved.accent)                  SETTINGS.accent     = saved.accent;
  if (saved.style)                   SETTINGS.style      = saved.style;
  if (saved.length)                  SETTINGS.length     = saved.length;
  if (saved.saveChats !== undefined) SETTINGS.saveChats  = saved.saveChats;

  if (!SETTINGS.dark) {
    document.documentElement.setAttribute('data-theme', 'light');
    const dt = document.getElementById('dark-toggle');
    if (dt) dt.checked = false;
  }
  if (SETTINGS.accent) {
    document.documentElement.style.setProperty('--acc',  SETTINGS.accent.color);
    document.documentElement.style.setProperty('--acc2', SETTINGS.accent.color2);
  }
  const ss = document.getElementById('style-select');
  const ls = document.getElementById('length-select');
  const st = document.getElementById('save-toggle');
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
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}
function scrollDown() {
  const w = document.getElementById('messages-wrap');
  setTimeout(() => w.scrollTo({ top: w.scrollHeight, behavior: 'smooth' }), 50);
}
function esc(t) {
  return (t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
