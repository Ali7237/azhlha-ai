const STATE = {
  messages: [],
  currentChatId: null,
  isLoading: false,
  user: null,
  imageBase64: null,
  imageMime: null,
  imageName: null
};

const SETTINGS = {
  dark: false,
  lang: 'ar',
  style: 'formal',
  length: 'medium'
};

const STR = {
  ar: {
    guest: 'زائر',
    guestStatus: 'تصفح كزائر',
    newChat: 'محادثة جديدة',
    noHistory: 'لا توجد محادثات سابقة',
    placeholder: 'اكتب رسالتك...',
    welcomeTitle: 'كيف يمكنني <span>مساعدتك؟</span>',
    welcomeSub: 'اسألني عن أي شيء: كتابة، تحليل، ترجمة، برمجة، أو إنشاء ملفات.',
    disclaimer: 'آمرني قد يخطئ أحياناً، يرجى التحقق من المعلومات المهمة.',
    settings: 'الإعدادات',
    copied: 'تم النسخ',
    copy: 'نسخ',
    error: 'حدث خطأ',
    deleteAll: 'حذف جميع المحادثات',
    confirmDelete: 'هل تريد حذف جميع المحادثات؟',
    analyzingImage: 'حلل هذه الصورة',
    download: 'تحميل'
  },
  en: {
    guest: 'Guest',
    guestStatus: 'Browsing as guest',
    newChat: 'New Chat',
    noHistory: 'No chats yet',
    placeholder: 'Message Amerni...',
    welcomeTitle: 'How can I <span>help you?</span>',
    welcomeSub: 'Ask me anything: writing, analysis, translation, code, or file creation.',
    disclaimer: 'Amerni can make mistakes. Please verify important information.',
    settings: 'Settings',
    copied: 'Copied',
    copy: 'Copy',
    error: 'Something went wrong',
    deleteAll: 'Delete all chats',
    confirmDelete: 'Delete all chats?',
    analyzingImage: 'Analyze this image',
    download: 'Download'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  if (typeof marked !== 'undefined') marked.setOptions({ breaks: true, gfm: true });
  loginAsGuest();
});

function t(key) {
  return STR[SETTINGS.lang]?.[key] || STR.ar[key] || key;
}

function loginAsGuest() {
  STATE.user = { name: t('guest'), type: 'guest' };
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app').hidden = false;
  if (window.innerWidth <= 720) document.getElementById('sidebar').classList.add('hidden');
  updateUserUI();
  applyLang();
  loadHistory();
  document.getElementById('user-input').focus();
}

async function sendMessage() {
  if (STATE.isLoading) return;
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text && !STATE.imageBase64) return;

  const displayImage = STATE.imageBase64;
  const displayMime = STATE.imageMime || 'image/jpeg';
  const content = text || t('analyzingImage');
  STATE.messages.push({ role: 'user', content });
  appendUserMsg(text, displayImage, displayMime);
  document.getElementById('welcome').hidden = true;
  input.value = '';
  autoResize(input);
  removeImage();
  setLoading(true);
  const typingId = showTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: STATE.messages,
        lang: SETTINGS.lang,
        style: SETTINGS.style,
        length: SETTINGS.length,
        userName: STATE.user?.name || t('guest'),
        memory: localStorage.getItem('amerni_memory') || ''
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    removeTyping(typingId);
    STATE.messages.push({ role: 'assistant', content: data.reply });
    appendAIMsg(data.reply);
    if (data.generateData) await generateFile(data.generateData, data.reply);
    saveChat(content);
  } catch (err) {
    removeTyping(typingId);
    appendAIMsg(`⚠️ ${t('error')}: ${err.message}`);
  } finally {
    setLoading(false);
    input.focus();
  }
}

function quickSend(text) {
  const input = document.getElementById('user-input');
  input.value = text;
  autoResize(input);
  sendMessage();
  if (window.innerWidth <= 720) closeSidebar();
}

function appendUserMsg(text, img64, mime = 'image/jpeg') {
  const wrap = document.createElement('div');
  wrap.className = 'msg user';
  wrap.innerHTML = `
    <div class="msg-avatar">${esc(STATE.user?.name?.[0] || 'U')}</div>
    <div>
      ${img64 ? `<img class="msg-image" src="data:${escAttr(mime)};base64,${img64}" alt="">` : ''}
      ${text ? `<div class="bubble">${esc(text)}</div>` : ''}
    </div>`;
  document.getElementById('msgs').appendChild(wrap);
  scrollDown();
}

function appendAIMsg(text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.innerHTML = `
    <div class="msg-avatar"><img src="assets/logo.png" alt=""></div>
    <div>
      <div class="bubble">${parseMarkdown(text)}</div>
      <button class="history-item" onclick="copyMsg(this)">${t('copy')}</button>
    </div>`;
  document.getElementById('msgs').appendChild(wrap);
  scrollDown();
}

function parseMarkdown(text) {
  if (typeof marked === 'undefined') return esc(text).replace(/\n/g, '<br>');
  return sanitizeHTML(marked.parse(text || ''));
}

function showTyping() {
  const id = `typing-${Date.now()}`;
  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.className = 'msg ai';
  wrap.innerHTML = `<div class="msg-avatar"><img src="assets/logo.png" alt=""></div><div class="bubble"><span class="typing"><span></span><span></span><span></span></span></div>`;
  document.getElementById('msgs').appendChild(wrap);
  scrollDown();
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

async function generateFile(genData, content) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...genData, content, lang: genData.lang || SETTINGS.lang })
  });
  if (!res.ok) return appendAIMsg(`⚠️ ${t('error')}: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const ext = genData.type === 'pdf' ? 'html' : genData.type;
  const name = `${genData.filename || 'document'}.${ext}`;
  appendAIMsg(`[${t('download')} ${esc(name)}](${url})`);
}

function handleImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return;
  if (file.size > 10 * 1024 * 1024) return alert('Max image size is 10MB');
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    STATE.imageBase64 = dataUrl.split(',')[1];
    STATE.imageMime = file.type;
    STATE.imageName = file.name;
    document.getElementById('img-thumb').src = dataUrl;
    document.getElementById('img-name').textContent = file.name;
    document.getElementById('img-preview').hidden = false;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function removeImage() {
  STATE.imageBase64 = null;
  STATE.imageMime = null;
  STATE.imageName = null;
  document.getElementById('img-preview').hidden = true;
}

function newChat() {
  STATE.messages = [];
  STATE.currentChatId = null;
  document.getElementById('msgs').innerHTML = '';
  document.getElementById('welcome').hidden = false;
  loadHistory();
  closeSidebar();
}

function getChats() {
  try { return JSON.parse(localStorage.getItem('amerni_chats') || '[]'); } catch { return []; }
}

function saveChat(title) {
  const chats = getChats();
  if (!STATE.currentChatId) STATE.currentChatId = Date.now();
  const chat = { id: STATE.currentChatId, title: title.slice(0, 54), messages: STATE.messages, date: Date.now() };
  const idx = chats.findIndex(c => c.id === chat.id);
  if (idx >= 0) chats[idx] = chat; else chats.unshift(chat);
  localStorage.setItem('amerni_chats', JSON.stringify(chats.slice(0, 30)));
  loadHistory();
}

function loadHistory() {
  const el = document.getElementById('history-list');
  const chats = getChats();
  if (!chats.length) {
    el.innerHTML = `<p class="history-empty">${t('noHistory')}</p>`;
    return;
  }
  el.innerHTML = chats.map(chat => `<button class="history-item ${chat.id === STATE.currentChatId ? 'active' : ''}" onclick="openChat(${chat.id})">${esc(chat.title)}</button>`).join('');
}

function openChat(id) {
  const chat = getChats().find(c => c.id === id);
  if (!chat) return;
  STATE.currentChatId = id;
  STATE.messages = chat.messages || [];
  document.getElementById('msgs').innerHTML = '';
  document.getElementById('welcome').hidden = true;
  for (const msg of STATE.messages) {
    if (msg.role === 'assistant') appendAIMsg(msg.content);
    else appendUserMsg(msg.content);
  }
  loadHistory();
  closeSidebar();
}

function clearAllChats() {
  if (!confirm(t('confirmDelete'))) return;
  localStorage.removeItem('amerni_chats');
  newChat();
  closeSettings();
}

function openSettings() {
  document.getElementById('settings-backdrop').style.display = 'flex';
  document.getElementById('memory-input').value = localStorage.getItem('amerni_memory') || '';
  document.getElementById('dark-toggle').checked = SETTINGS.dark;
  document.getElementById('lang-select').value = SETTINGS.lang;
  document.getElementById('style-select').value = SETTINGS.style;
  document.getElementById('length-select').value = SETTINGS.length;
}

function closeSettings() {
  document.getElementById('settings-backdrop').style.display = 'none';
}

function closeSettingsBackdrop(event) {
  if (event.target.id === 'settings-backdrop') closeSettings();
}

function saveMemory() {
  localStorage.setItem('amerni_memory', document.getElementById('memory-input').value.trim());
  closeSettings();
}

function toggleTheme() {
  SETTINGS.dark = document.getElementById('dark-toggle').checked;
  saveSettings();
  document.documentElement.dataset.theme = SETTINGS.dark ? 'dark' : 'light';
}

function setLang(lang) {
  SETTINGS.lang = lang;
  saveSettings();
  applyLang();
}

function saveResponseSettings() {
  SETTINGS.style = document.getElementById('style-select').value;
  SETTINGS.length = document.getElementById('length-select').value;
  saveSettings();
}

function saveSettings() {
  localStorage.setItem('amerni_settings', JSON.stringify(SETTINGS));
}

function loadSettings() {
  try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem('amerni_settings') || '{}')); } catch {}
  document.documentElement.dataset.theme = SETTINGS.dark ? 'dark' : 'light';
  document.documentElement.lang = SETTINGS.lang;
  document.documentElement.dir = SETTINGS.lang === 'en' ? 'ltr' : 'rtl';
}

function applyLang() {
  const en = SETTINGS.lang === 'en';
  document.documentElement.lang = SETTINGS.lang;
  document.documentElement.dir = en ? 'ltr' : 'rtl';
  document.getElementById('user-input').placeholder = t('placeholder');
  document.getElementById('user-input').dir = en ? 'ltr' : 'rtl';
  document.getElementById('txt-new-chat').textContent = t('newChat');
  document.getElementById('txt-welcome-title').innerHTML = t('welcomeTitle');
  document.getElementById('txt-welcome-sub').textContent = t('welcomeSub');
  document.getElementById('txt-disclaimer').textContent = t('disclaimer');
  document.getElementById('txt-settings').textContent = t('settings');
  document.getElementById('txt-delete-all').textContent = t('deleteAll');
  updateUserUI();
  loadHistory();
}

function updateUserUI() {
  const name = STATE.user?.name || t('guest');
  document.getElementById('user-avatar').textContent = name[0] || 'U';
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-status').textContent = t('guestStatus');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('hidden');
  document.getElementById('sidebar-overlay').classList.toggle('active', !sidebar.classList.contains('hidden'));
}

function closeSidebar() {
  if (window.innerWidth <= 720) {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }
}

function handleKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
}

function setLoading(isLoading) {
  STATE.isLoading = isLoading;
  document.getElementById('send-btn').disabled = isLoading;
}

function scrollDown() {
  const wrap = document.getElementById('msgs-wrap');
  requestAnimationFrame(() => wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' }));
}

function copyMsg(btn) {
  const text = btn.parentElement.querySelector('.bubble')?.innerText || '';
  navigator.clipboard?.writeText(text).then(() => {
    btn.textContent = t('copied');
    setTimeout(() => btn.textContent = t('copy'), 1200);
  });
}

function esc(str = '') {
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escAttr(str = '') {
  return esc(str).replace(/`/g, '&#96;');
}

function sanitizeHTML(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script, iframe, object, embed, form, input, button').forEach(el => el.remove());
  template.content.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || value.startsWith('javascript:')) el.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}
