// [02/19] light/dark theme, saved chat sessions
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
// --- 3. THEME SYSTEM (DARK / LIGHT / AUTO PERSISTENCE) ---
const THEME_KEY = 'companion_theme';
let currentThemeSetting = localStorage.getItem(THEME_KEY) || 'dark';

function applyTheme(setting) {
  currentThemeSetting = setting;
  localStorage.setItem(THEME_KEY, setting);

  const isDark = setting === 'dark' || (setting === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

  const btnLight = document.getElementById('themeLightBtn');
  const btnDark = document.getElementById('themeDarkBtn');
  const btnSystem = document.getElementById('themeSystemBtn');

  if (btnLight) btnLight.classList.toggle('active', setting === 'light');
  if (btnDark) btnDark.classList.toggle('active', setting === 'dark');
  if (btnSystem) btnSystem.classList.toggle('active', setting === 'system');
}

const themeLightBtn = document.getElementById('themeLightBtn');
const themeDarkBtn = document.getElementById('themeDarkBtn');
const themeSystemBtn = document.getElementById('themeSystemBtn');

if (themeLightBtn) themeLightBtn.addEventListener('click', () => applyTheme('light'));
if (themeDarkBtn) themeDarkBtn.addEventListener('click', () => applyTheme('dark'));
if (themeSystemBtn) themeSystemBtn.addEventListener('click', () => applyTheme('system'));

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentThemeSetting === 'system') applyTheme('system');
});
applyTheme(currentThemeSetting);

// --- 4. GLOBAL WORKSPACE & SESSION MEMORY ---
let history = [];
let currentGoal = null;
let completedSteps = [];
let stepCounter = 0;
let awaitingClarification = false;

// Voice Audio State
let isRecording = false;
let mediaRecorder = null;
let chunks = [];

// Staged Media State
let pendingImageFile = null;
let pendingImageUrl = null;
let pendingDocumentId = null;
let pendingDocumentName = null;

// Optical Sensor & Interval Streams
let currentCameraSource = localStorage.getItem('companion_cam_source') || 'webcam';
let snapStream = null;
let liveCamStream = null;
let ipPollIntervalId = null;
let ambientIntervalId = null;
let ambientRunning = false;
let cachedVoices = [];

// Multi-Session Memory Engine
const SESSIONS_KEY = 'companion_sessions';
const initialFeedHTML = feedEl ? feedEl.innerHTML : '';
let sessions = {
  general: {
    history: [],
    completedSteps: [],
    stepCounter: 0,
    currentGoal: null,
    feedHTML: initialFeedHTML,
    name: 'General',
    sessionNote: ''
  }
};
let currentLabel = 'general';
let currentSessionNote = '';

function persistSessions() {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify({ sessions, currentLabel }));
  } catch (e) {
    console.warn('LocalStorage error while saving sessions:', e);
  }
}

(function loadSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSIONS_KEY));
    if (saved && saved.sessions && saved.sessions.general) {
      sessions = saved.sessions;
      currentLabel = saved.currentLabel || 'general';
      const s = sessions[currentLabel] || sessions.general;
      history = s.history || [];
      completedSteps = s.completedSteps || [];
      stepCounter = s.stepCounter || 0;
      currentGoal = s.currentGoal || null;
      currentSessionNote = s.sessionNote || '';
      if (s.feedHTML && feedEl) {
        feedEl.innerHTML = s.feedHTML;
      }
      const hero = document.getElementById('welcomeHero');
      if (hero) {
        hero.style.display = (!history || history.length === 0) ? '' : 'none';
      }
    }
  } catch (e) {
    console.warn('Error loading sessions from storage:', e);
  }
})();

// Navigation Controls
const sidebarEl = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const newChatBtn = document.getElementById('newChatBtn');

function toggleSidebar(force) {
  if (!sidebarEl) return;
  const open = force !== undefined ? force : !sidebarEl.classList.contains('open');
  sidebarEl.classList.toggle('open', open);
  if (sidebarBackdrop) sidebarBackdrop.classList.toggle('open', open);
}

if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', () => toggleSidebar(true));
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', () => toggleSidebar(false));
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));

if (newChatBtn) {
  newChatBtn.addEventListener('click', () => {
    snapshotCurrentSession();
    const timestampId = 'stream_' + Date.now();
    sessions[timestampId] = {
      history: [],
      completedSteps: [],
      stepCounter: 0,
      currentGoal: null,
      feedHTML: initialFeedHTML,
      name: 'Session ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sessionNote: ''
    };
    switchSession(timestampId);
    if (goalEl) goalEl.focus();
  });
}

function updateAgentTag() {
  if (currentAgentTag) {
    const name = sessions[currentLabel] ? sessions[currentLabel].name : 'General';
    currentAgentTag.textContent = name;
  }
}
updateAgentTag();

function renderSidebar() {
  const list = document.getElementById('sessionList');
  if (!list) return;
  list.innerHTML = '';

  const sessionKeys = Object.keys(sessions);
  if (sessionCountBadge) sessionCountBadge.textContent = sessionKeys.length;

  sessionKeys.forEach(label => {
    const item = document.createElement('div');
    item.className = 'sidebar-item' + (label === currentLabel ? ' active' : '');
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'sidebar-item-label';
    labelSpan.textContent = sessions[label].name || label;
    labelSpan.onclick = () => switchSession(label);

    const delBtn = document.createElement('button');
    delBtn.className = 'sidebar-del-btn';
    delBtn.type = 'button';
    delBtn.title = 'Delete conversation';
    delBtn.textContent = '✕';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteSession(label);
    };

    item.appendChild(labelSpan);
    item.appendChild(delBtn);
    list.appendChild(item);
  });
}

function deleteSession(label) {
  if (!confirm(`Delete conversation "${sessions[label].name}"?`)) return;

  delete sessions[label];
  if (Object.keys(sessions).length === 0) {
    sessions.general = {
      history: [], completedSteps: [], stepCounter: 0, currentGoal: null,
      feedHTML: initialFeedHTML, name: 'General', sessionNote: ''
    };
  }

  if (label === currentLabel) {
    const nextLabel = sessions.general ? 'general' : Object.keys(sessions)[0];
    const s = sessions[nextLabel];
    history = s.history || [];
    completedSteps = s.completedSteps || [];
    stepCounter = s.stepCounter || 0;
    currentGoal = s.currentGoal || null;
    currentSessionNote = s.sessionNote || '';
    if (feedEl) feedEl.innerHTML = s.feedHTML;
    currentLabel = nextLabel;
    wirePromptChips();
    const hero = document.getElementById('welcomeHero');
    if (hero) {
      hero.style.display = (!s.history || s.history.length === 0) ? '' : 'none';
    }
  }

  renderSidebar();
  updateAgentTag();
  persistSessions();
}

function clearAllSessions() {
  if (!confirm('Delete all conversations?')) return;
  localStorage.removeItem(SESSIONS_KEY);
  sessions = {
    general: {
      history: [], completedSteps: [], stepCounter: 0, currentGoal: null,
      feedHTML: initialFeedHTML, name: 'General', sessionNote: ''
    }
  };
  currentLabel = 'general';
  history = [];
  completedSteps = [];
  stepCounter = 0;
  currentGoal = null;
  currentSessionNote = '';
  if (feedEl) feedEl.innerHTML = initialFeedHTML;
  const hero = document.getElementById('welcomeHero');
  if (hero) hero.style.display = '';
  wirePromptChips();
  renderSidebar();
  updateAgentTag();
  toggleSidebar(false);
}

const clearAllBtn = document.getElementById('clearAllBtn');
if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllSessions);

function snapshotCurrentSession() {
  if (!sessions[currentLabel]) return;
  sessions[currentLabel] = {
    history,
    completedSteps,
    stepCounter,
    currentGoal,
    feedHTML: feedEl ? feedEl.innerHTML : '',
    name: sessions[currentLabel].name,
    sessionNote: currentSessionNote
  };
  persistSessions();
}

function switchSession(label) {
  if (label !== currentLabel) {
    snapshotCurrentSession();
    const s = sessions[label];
    history = s.history || [];
    completedSteps = s.completedSteps || [];
    stepCounter = s.stepCounter || 0;
    currentGoal = s.currentGoal || null;
    currentSessionNote = s.sessionNote || '';
    if (feedEl) feedEl.innerHTML = s.feedHTML;
    currentLabel = label;
    updateAgentTag();
    renderSidebar();
    persistSessions();
    wirePromptChips();
    const hero = document.getElementById('welcomeHero');
    if (hero) {
      hero.style.display = (!s.history || s.history.length === 0) ? '' : 'none';
    }
    scrollToBottom();
  }
  toggleSidebar(false);
}

async function classifyAndSwitch(text) {
  let label = currentLabel;
  let note = '';
  try {
    const res = await fetch(`${API}/classify-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (res.ok) {
      const d = await res.json();
      label = d.label || currentLabel;
      note = d.note || '';
    }
  } catch (e) {
    console.warn('classify-session error:', e);
    return;
  }

  if (label === currentLabel) return;
  snapshotCurrentSession();
  if (!sessions[label]) {
    sessions[label] = {
      history: [],
      completedSteps: [],
      stepCounter: 0,
      currentGoal: null,
      feedHTML: initialFeedHTML,
      name: label.charAt(0).toUpperCase() + label.slice(1),
      sessionNote: note
    };
  }
  const s = sessions[label];
  history = s.history || [];
  completedSteps = s.completedSteps || [];
  stepCounter = s.stepCounter || 0;
  currentGoal = s.currentGoal || null;
  currentSessionNote = s.sessionNote || '';
  if (feedEl) feedEl.innerHTML = s.feedHTML;
  currentLabel = label;
  updateAgentTag();
  renderSidebar();
  persistSessions();
  wirePromptChips();
}

renderSidebar();
