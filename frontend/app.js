let API = localStorage.getItem('companion_api_host') || ((window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  ? `http://${window.location.hostname}:8000`
  : "http://127.0.0.1:8000");

const feedEl = document.getElementById('feed');
const goalEl = document.getElementById('goal');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const statusEl = document.getElementById('status');
const liveTicker = document.getElementById('liveTicker');
const liveTickerText = document.getElementById('liveTickerText');
const currentAgentTag = document.getElementById('currentAgentTag');
const sessionCountBadge = document.getElementById('sessionCountBadge');

// --- 2. LIVING SYNAPTIC COMPUTATIONAL SUBSTRATE ---
(function initNeuralCanvas() {
  const canvas = document.getElementById('neuralCanvas');
  if (!canvas || canvas.style.display === 'none') return;
  const ctx = canvas.getContext('2d', { alpha: true });
  let width, height, nodes = [];
  const nodeCount = 42;
  const maxDistance = 145;
  let pulses = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      radius: Math.random() * 1.4 + 1.1,
      phase: Math.random() * Math.PI * 2
    });
  }

  // Synaptic signal pulses flowing along links
  for (let p = 0; p < 6; p++) {
    pulses.push({
      from: Math.floor(Math.random() * nodeCount),
      to: Math.floor(Math.random() * nodeCount),
      progress: Math.random(),
      speed: Math.random() * 0.008 + 0.004
    });
  }

  let mouse = { x: -2000, y: -2000, radius: 180 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mouseleave', () => {
    mouse.x = -2000;
    mouse.y = -2000;
  });

  function render(time) {
    if (document.hidden) {
      requestAnimationFrame(render);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const nodeColor = isLight ? 'rgba(124, 92, 255, 0.22)' : 'rgba(124, 92, 255, 0.35)';
    const lineColor = isLight ? 'rgba(124, 92, 255, 0.05)' : 'rgba(124, 92, 255, 0.09)';
    const pulseColor = isLight ? 'rgba(124, 92, 255, 0.65)' : 'rgba(34, 211, 238, 0.75)';

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;

      if (n.x < -10) n.x = width + 10;
      if (n.x > width + 10) n.x = -10;
      if (n.y < -10) n.y = height + 10;
      if (n.y > height + 10) n.y = -10;

      // Gentle mouse interaction
      const mdx = mouse.x - n.x;
      const mdy = mouse.y - n.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mDist < mouse.radius) {
        const force = (1 - mDist / mouse.radius) * 0.6;
        n.x -= (mdx / mDist) * force;
        n.y -= (mdy / mDist) * force;
      }

      // Draw node
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      // Connect to neighbors
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n.x - n2.x;
        const dy = n.y - n2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDistance) {
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = (1 - dist / maxDistance) * 0.9;
          ctx.stroke();
        }
      }
    }

    // Render synaptic data pulses
    for (let p = 0; p < pulses.length; p++) {
      const pulse = pulses[p];
      pulse.progress += pulse.speed;
      if (pulse.progress >= 1) {
        pulse.progress = 0;
        pulse.from = Math.floor(Math.random() * nodeCount);
        pulse.to = Math.floor(Math.random() * nodeCount);
      }
      const n1 = nodes[pulse.from];
      const n2 = nodes[pulse.to];
      if (n1 && n2) {
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDistance * 1.2) {
          const px = n1.x + dx * pulse.progress;
          const py = n1.y + dy * pulse.progress;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = pulseColor;
          ctx.fill();
        }
      }
    }

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      requestAnimationFrame(render);
    }
  }
  render();
})();

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

// --- 5. RIGHT CONTEXT TELEMETRY PANEL LOGIC ---
const contextPanel = document.getElementById('contextPanel');
const contextPanelToggleBtn = document.getElementById('contextPanelToggleBtn');
const contextPanelCloseBtn = document.getElementById('contextPanelCloseBtn');
const contextCamSource = document.getElementById('contextCamSource');
const panelLaunchVisionBtn = document.getElementById('panelLaunchVisionBtn');

if (contextPanelToggleBtn) {
  contextPanelToggleBtn.addEventListener('click', () => {
    if (contextPanel) contextPanel.classList.toggle('collapsed');
  });
}
if (contextPanelCloseBtn) {
  contextPanelCloseBtn.addEventListener('click', () => {
    if (contextPanel) contextPanel.classList.add('collapsed');
  });
}
if (panelLaunchVisionBtn) {
  panelLaunchVisionBtn.addEventListener('click', () => startGuidedSearch());
}

// --- 6. UTILITIES & INPUT BEHAVIOR ---
function setStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', isError);
}

function scrollToBottom() {
  if (feedEl) {
    const viewport = feedEl.parentElement;
    viewport.scrollTop = viewport.scrollHeight;
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

if (goalEl) {
  goalEl.addEventListener('input', () => {
    goalEl.style.height = 'auto';
    goalEl.style.height = Math.min(goalEl.scrollHeight, 140) + 'px';
  });
  goalEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  });
}

function wirePromptChips() {
  document.querySelectorAll('.intent-module-card, .chip-btn').forEach(btn => {
    btn.onclick = () => {
      const goal = btn.getAttribute('data-goal');
      if (goal && goalEl) {
        goalEl.value = goal;
        goalEl.style.height = 'auto';
        goalEl.style.height = Math.min(goalEl.scrollHeight, 140) + 'px';
        handleSendClick();
      }
    };
  });
}
wirePromptChips();

// --- 7. STRUCTURED COGNITIVE TIMELINE & HERO STEP CARDS ---

function addUserBubble(text, imageUrl) {
  if (!feedEl) return;
  const hero = document.getElementById('welcomeHero');
  if (hero) hero.style.display = 'none';

  const div = document.createElement('div');
  div.className = 'msg user';

  const metaHeader = document.createElement('div');
  metaHeader.className = 'msg-meta-header';
  metaHeader.innerHTML = `<span>You</span><span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
  div.appendChild(metaHeader);

  const textSpan = document.createElement('div');
  textSpan.className = 'msg-body-text';
  textSpan.textContent = text;
  div.appendChild(textSpan);

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'msg-thumb';
    img.alt = 'Attached Frame';
    div.appendChild(img);
  }

  feedEl.appendChild(div);
  scrollToBottom();
}

function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch (e) {}
}

function formatTimer(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function addAssistantBubble(steps, isFinal) {
  if (!feedEl) return null;
  const div = document.createElement('div');
  div.className = 'msg assistant';

  const synthesisTag = document.createElement('div');
  synthesisTag.className = 'synthesis-header-tag';
  synthesisTag.innerHTML = `<span>Smart Companion</span>`;
  div.appendChild(synthesisTag);

  // Clarification Handling
  const clarifyStep = steps.find(s => s.clarify);
  if (clarifyStep) {
    const wrap = document.createElement('div');
    wrap.className = 'step-sequence-wrap';

    const q = document.createElement('div');
    q.style.fontSize = '15px';
    q.style.fontWeight = '500';
    q.style.marginBottom = '12px';
    q.textContent = clarifyStep.text;
    wrap.appendChild(q);

    if (clarifyStep.choices && clarifyStep.choices.length) {
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;';
      clarifyStep.choices.forEach(choice => {
        const cb = document.createElement('button');
        cb.className = 'btn-subtle';
        cb.textContent = choice;
        cb.onclick = () => {
          btnRow.querySelectorAll('button').forEach(b => b.disabled = true);
          awaitingClarification = false;
          sendMessage(`${currentGoal} - ${choice}`);
        };
        btnRow.appendChild(cb);
      });
      wrap.appendChild(btnRow);
    } else {
      awaitingClarification = true;
    }

    addSpeakButton(wrap, clarifyStep.text);
    div.appendChild(wrap);
    feedEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  awaitingClarification = false;

  // Hero Micro-Step Component
  const wrap = document.createElement('div');
  wrap.className = 'step-sequence-wrap';

  // Segmented Progression Deck
  const progressionDeck = document.createElement('div');
  progressionDeck.className = 'step-progression-deck';
  progressionDeck.innerHTML = `
    <div class="progression-labels">
      <span class="progression-stage-title">Next steps</span>
      <span class="progression-metric-badge">0 of ${steps.length} completed</span>
    </div>
    <div class="progression-track">
      <div class="progression-fill" style="width: 0%;"></div>
    </div>
  `;
  wrap.appendChild(progressionDeck);

  const list = document.createElement('div');
  list.className = 'step-card-list';
  const stepEntries = [];

  steps.forEach((s, idx) => {
    stepCounter += 1;
    const stepIndex = stepCounter;
    const item = document.createElement('div');
    item.className = 'step-item' + (idx === 0 ? ' active-focus' : ' pending');

    const chk = document.createElement('button');
    chk.className = 'step-checkbox';
    chk.type = 'button';
    chk.setAttribute('aria-label', `Complete milestone ${stepIndex}`);
    chk.textContent = String(stepIndex).padStart(2, '0');

    const body = document.createElement('div');
    body.className = 'step-body';

    const stateTag = document.createElement('span');
    stateTag.className = 'step-state-tag ' + (idx === 0 ? 'focus' : 'pending');
    stateTag.textContent = (idx === 0 ? 'Current step' : `Step ${idx + 1}`);
    body.appendChild(stateTag);

    const title = document.createElement('div');
    title.className = 'step-title';
    title.textContent = s.text ?? '';
    body.appendChild(title);

    const metaRow = document.createElement('div');
    metaRow.className = 'step-meta-row';

    if (s.time) {
      const durChip = document.createElement('span');
      durChip.className = 'step-duration-chip';
      durChip.textContent = `⏱ ~ ${s.time}`;
      metaRow.appendChild(durChip);

      const mMatch = String(s.time).match(/(\d+)/);
      const totalSec = mMatch ? parseInt(mMatch[1], 10) * 60 : 300;
      let remainingSec = totalSec;
      let timerId = null;

      const timerBtn = document.createElement('button');
      timerBtn.type = 'button';
      timerBtn.className = 'step-timer-btn';
      timerBtn.textContent = '⏱ Start Timer';

      timerBtn.onclick = (e) => {
        e.stopPropagation();
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
          timerBtn.classList.remove('running');
          timerBtn.textContent = `⏱ Resume (${formatTimer(remainingSec)})`;
        } else {
          timerBtn.classList.add('running');
          timerId = setInterval(() => {
            remainingSec -= 1;
            if (remainingSec <= 0) {
              clearInterval(timerId);
              timerId = null;
              timerBtn.classList.remove('running');
              timerBtn.textContent = '⏱ Time complete!';
              playCompletionChime();
            } else {
              timerBtn.textContent = `⏱ ${formatTimer(remainingSec)} [Pause]`;
            }
          }, 1000);
        }
      };
      metaRow.appendChild(timerBtn);
    }

    body.appendChild(metaRow);
    item.appendChild(chk);
    item.appendChild(body);
    list.appendChild(item);

    const entry = { item, chk, stateTag, stepIndex };
    stepEntries.push(entry);

    const toggleDone = () => {
      const isCompleted = item.classList.toggle('completed');
      if (isCompleted) {
        chk.textContent = '✓';
        stateTag.className = 'step-state-tag done';
        stateTag.textContent = 'Completed';
        item.classList.remove('active-focus');
        item.classList.remove('pending');
        playCompletionChime();
      } else {
        chk.textContent = String(stepIndex).padStart(2, '0');
        stateTag.className = 'step-state-tag pending';
        stateTag.textContent = `Step ${stepIndex}`;
        item.classList.add('pending');
      }

      // Re-evaluate active focus: next uncompleted step becomes active-focus
      let foundFocus = false;
      let completedCount = 0;
      stepEntries.forEach(se => {
        if (se.item.classList.contains('completed')) {
          completedCount += 1;
        } else if (!foundFocus) {
          se.item.classList.remove('pending');
          se.item.classList.add('active-focus');
          se.stateTag.className = 'step-state-tag focus';
          se.stateTag.textContent = 'Current step';
          foundFocus = true;
        } else {
          se.item.classList.remove('active-focus');
          se.item.classList.add('pending');
          se.stateTag.className = 'step-state-tag pending';
          se.stateTag.textContent = `Step ${se.stepIndex}`;
        }
      });

      // Update progress bar
      const fillEl = progressionDeck.querySelector('.progression-fill');
      const badgeEl = progressionDeck.querySelector('.progression-metric-badge');
      const pct = Math.round((completedCount / stepEntries.length) * 100);
      if (fillEl) fillEl.style.width = pct + '%';
      if (badgeEl) {
        if (completedCount === stepEntries.length) {
          badgeEl.textContent = `All ${stepEntries.length} completed ✓`;
          const doneBtn = wrap.querySelector('.done-btn');
          if (doneBtn) {
            doneBtn.innerHTML = `<span>Done — what's next?</span> <span>→</span>`;
          }
        } else {
          badgeEl.textContent = `${completedCount} of ${stepEntries.length} completed`;
          const doneBtn = wrap.querySelector('.done-btn');
          if (doneBtn) {
            doneBtn.innerHTML = `<span>Done — what's next?</span> <span>→</span>`;
          }
        }
      }
    };

    chk.onclick = (e) => {
      e.stopPropagation();
      toggleDone();
    };
    item.onclick = (e) => {
      if (e.target.closest('.step-timer-btn')) return;
      toggleDone();
    };
  });

  wrap.appendChild(list);

  if (!isFinal) {
    const actionBar = document.createElement('div');
    actionBar.className = 'next-step-action-bar';

    const btn = document.createElement('button');
    btn.className = 'done-btn';
    btn.type = 'button';
    btn.innerHTML = `<span>Done — what's next?</span> <span>→</span>`;
    btn.onclick = () => handleDone(btn);

    actionBar.appendChild(btn);
    wrap.appendChild(actionBar);
  } else {
    const note = document.createElement('div');
    note.className = 'done-note';
    note.innerHTML = `<span>✓ Task completed</span>`;
    wrap.appendChild(note);
  }

  addSpeakButton(wrap, steps.map(s => s.text ?? '').join('. '));
  div.appendChild(wrap);
  feedEl.appendChild(div);
  scrollToBottom();
  return div;
}

function addAnswerBubble(headline, stepsOrDetail) {
  if (!feedEl) return;
  const div = document.createElement('div');
  div.className = 'msg assistant';

  const synthesisTag = document.createElement('div');
  synthesisTag.className = 'synthesis-header-tag';
  synthesisTag.innerHTML = `<span>Smart Companion</span>`;
  div.appendChild(synthesisTag);

  const headlineEl = document.createElement('div');
  headlineEl.className = 'answer-headline';
  headlineEl.textContent = headline;
  div.appendChild(headlineEl);

  if (Array.isArray(stepsOrDetail) && stepsOrDetail.length > 0) {
    const detailEl = document.createElement('div');
    detailEl.className = 'answer-detail';
    stepsOrDetail.forEach(point => {
      const line = document.createElement('div');
      line.className = 'point-line';
      line.innerHTML = `<span class="point-dot">▸</span><span>${escapeHtml(point)}</span>`;
      detailEl.appendChild(line);
    });
    div.appendChild(detailEl);
  } else if (typeof stepsOrDetail === 'string' && stepsOrDetail.trim()) {
    const detailEl = document.createElement('div');
    detailEl.className = 'answer-detail';
    detailEl.textContent = stepsOrDetail;
    div.appendChild(detailEl);
  }

  addSpeakButton(div, flattenAnswer(headline, stepsOrDetail));
  feedEl.appendChild(div);
  scrollToBottom();
}

function flattenAnswer(headline, stepsOrDetail) {
  if (Array.isArray(stepsOrDetail)) return [headline, ...stepsOrDetail].join(' ').trim();
  return `${headline} ${stepsOrDetail || ''}`.trim();
}

function addSpeakButton(container, text) {
  if (!text || !text.trim() || !window.speechSynthesis) return;
  const btn = document.createElement('button');
  btn.className = 'speak-bubble-btn';
  btn.type = 'button';
  btn.title = 'Vocalize';
  btn.innerHTML = `<span>🔊 Read Aloud</span>`;
  btn.onclick = (e) => {
    e.stopPropagation();
    speak(text);
  };
  container.appendChild(btn);
}

// --- 8. TASK DECOMPOSITION BACKEND INTEGRATION ---

async function callBackend(goal, resetTask) {
  if (resetTask) completedSteps = [];
  const res = await fetch(`${API}/decompose-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal,
      reading_level: "simple",
      max_steps: 3,
      tone: "encouraging",
      completed_steps: completedSteps,
      history,
      session_note: currentSessionNote,
      language: currentLangCode(),
      health_context: (currentLabel === 'medical') ? recentHealthLogSummary() : ''
    }),
  });
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  return res.json();
}

async function sendMessage(text) {
  if (!text.trim()) return;
  await classifyAndSwitch(text);
  addUserBubble(text);
  history.push({ role: "user", content: text });
  currentGoal = text;
  stepCounter = 0;
  setStatus('Thinking…');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const data = await callBackend(text, true);
    const steps = data.steps || [];
    completedSteps = steps.map(s => s.text);
    const bubble = addAssistantBubble(steps, data.is_final);
    if (!data.is_emergency && !data.was_error && !steps.some(s => s.clarify) && currentLabel !== 'medical') {
    attachResources(text, bubble);
}
    if (!data.was_error) {
      history.push({ role: "assistant", content: steps.map(s => s.text).join(' ') });
    }
    snapshotCurrentSession();

    if (data.is_emergency) {
      showEmergencyPanel();
    } else {
      maybeShowNearbyHealthcare();
    }

    if (data.is_final) celebrateTaskDone();
    setStatus('');
  } catch (err) {
    console.error('sendMessage error:', err);
    setStatus("Cannot connect right now. Please check that the app server is running.", true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function handleDone(btnEl) {
  btnEl.disabled = true;
  btnEl.innerHTML = `<span>Getting your next steps…</span>`;
  setStatus('Getting your next steps…');

  try {
    const data = await callBackend(currentGoal, false);
    const newSteps = data.steps || [];
    completedSteps = completedSteps.concat(newSteps.map(s => s.text));
    btnEl.remove();
    addAssistantBubble(newSteps, data.is_final);
    if (!data.was_error) {
      history.push({ role: "assistant", content: newSteps.map(s => s.text).join(' ') });
    }
    celebrateStep();
    snapshotCurrentSession();
    if (data.is_final) celebrateTaskDone();
    setStatus('');
  } catch (err) {
    console.error('handleDone error:', err);
    setStatus("Something went wrong. Please try again.", true);
    btnEl.disabled = false;
    btnEl.innerHTML = `<span>Next step</span><span>→</span>`;
  }
}

if (sendBtn) sendBtn.addEventListener('click', () => handleSendClick());

// --- 9. AUDIO CAPTURE & SPEECH SYNTHESIS ENGINE ---
// The mic now stops BY ITSELF when you stop talking, and never sends silence to the server.

const LiveRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let liveRecognition = null;

// live words under the input box while you speak (shown only in the little ticker, never put in the text box)
function startLiveCaptions() {
  if (!LiveRecognition) return;
  stopLiveCaptions();
  const rec = new LiveRecognition();
  liveRecognition = rec;
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = currentLang().bcp;
  if (liveTicker) liveTicker.style.display = 'flex';
  if (liveTickerText) liveTickerText.textContent = 'Listening…';
  rec.onresult = (event) => {
    if (rec !== liveRecognition) return;            // ignore late results from an earlier recording
    let combined = '';
    for (let i = 0; i < event.results.length; i++) combined += event.results[i][0].transcript;
    if (liveTickerText) liveTickerText.textContent = combined || 'Listening…';
  };
  rec.onerror = () => {};
  try { rec.start(); } catch (e) {}
}

function stopLiveCaptions() {
  const rec = liveRecognition;
  liveRecognition = null;
  if (liveTicker) liveTicker.style.display = 'none';
  if (rec) {
    rec.onresult = null; rec.onend = null;
    try { rec.abort(); } catch (e) {}               // abort() drops pending results; stop() lets them arrive late
  }
}

const MIC_SILENCE_MS = 1500;     // stop this long after you stop talking
const MIC_NO_SPEECH_MS = 6000;   // give up if nothing is said at all
const MIC_MAX_MS = 45000;        // hard limit for one message
const MIC_MIN_VOICE_MS = 350;    // less speech than this counts as "nothing"
let micSession = null;
let micBusy = false;

async function startMic() {
  if (micSession || micBusy) return;
  if (window.speechSynthesis) window.speechSynthesis.cancel();   // never record our own voice
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    setStatus('Microphone access denied.', true);
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const rec = new MediaRecorder(stream);
  const s = { stream, ctx, rec, chunks: [], t0: Date.now(), lastVoice: 0, voiceMs: 0, noise: [], thr: null, hadSpeech: false, timer: null };
  micSession = s;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) s.chunks.push(e.data); };
  rec.onstop = () => finishMic(s);
  rec.start();
  startLiveCaptions();
  isRecording = true;
  if (micBtn) micBtn.classList.add('recording');
  setStatus('Listening… just stop talking when you are done.');
  const buf = new Uint8Array(analyser.fftSize);
  s.timer = setInterval(() => {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
    const level = Math.sqrt(sum / buf.length);
    const now = Date.now(), elapsed = now - s.t0;
    if (elapsed < 500) { s.noise.push(level); return; }          // first half second: learn the room's background noise
    if (s.thr === null) {
      const avg = s.noise.length ? s.noise.reduce((a, b) => a + b, 0) / s.noise.length : 0;
      s.thr = Math.min(0.06, Math.max(0.025, avg * 3));
    }
    if (level > s.thr) { s.lastVoice = now; s.voiceMs += 80; }
    const heard = s.voiceMs >= MIC_MIN_VOICE_MS;
    if (heard && now - s.lastVoice > MIC_SILENCE_MS) stopMic();
    else if (!heard && elapsed > MIC_NO_SPEECH_MS) stopMic();
    else if (elapsed > MIC_MAX_MS) stopMic();
  }, 80);
}

function stopMic() {
  const s = micSession;
  if (!s) return;
  micSession = null;
  clearInterval(s.timer);
  s.hadSpeech = s.voiceMs >= MIC_MIN_VOICE_MS;
  isRecording = false;
  if (micBtn) micBtn.classList.remove('recording');
  stopLiveCaptions();
  try { if (s.rec.state !== 'inactive') s.rec.stop(); } catch (e) { finishMic(s); }
  s.stream.getTracks().forEach(t => t.stop());
  try { s.ctx.close(); } catch (e) {}
}

async function finishMic(s) {
  if (s.done) return;
  s.done = true;
  if (!s.hadSpeech || !s.chunks.length) {            // silence: do NOT send anything to the server
    setStatus("I didn't hear anything. Tap the mic and try again.", true);
    return;
  }
  micBusy = true;
  if (micBtn) micBtn.disabled = true;
  setStatus('Turning your voice into text…');
  const blob = new Blob(s.chunks, { type: s.rec.mimeType || 'audio/webm' });
  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  formData.append('language', currentLangCode());
  try {
    const res = await fetch(`${API}/transcribe`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('transcribe failed');
    const data = await res.json();
    setStatus('');
    // follow the language that was really spoken (the dropdown, replies and read-aloud switch with it)
    if (data.language && data.language !== currentLangCode() && typeof setLangCode === 'function') setLangCode(data.language);
    if (data.text && data.text.trim()) {
      unlockBadge('voice', 'Voice Explorer');
      if (goalEl) { goalEl.value = ''; goalEl.style.height = 'auto'; }
      sendMessage(data.text);
    } else {
      setStatus("Did not catch that. Please try again.", true);
    }
  } catch (err) {
    console.error('Audio transcription error:', err);
    setStatus('Could not understand the audio. Please try again.', true);
  } finally {
    micBusy = false;
    if (micBtn) micBtn.disabled = false;
  }
}

if (micBtn) {
  micBtn.addEventListener('click', () => {
    if (micBusy) return;
    micSession ? stopMic() : startMic();             // tap again to stop early
  });
}

function refreshVoices() {
  if (window.speechSynthesis) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
}
if (window.speechSynthesis) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function pickFemaleVoice() {
  const pattern = /female|zira|samantha|susan|karen|moira|tessa|victoria|google us english|google uk english female/i;
  return cachedVoices.find(v => pattern.test(v.name));
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0;
  const female = pickFemaleVoice();
  if (female) utter.voice = female;
  window.speechSynthesis.speak(utter);
}

// --- 10. OPTICAL SENSOR HUB: WEBCAM & IP CAMERA ---

const btnSrcWebcam = document.getElementById('btnSrcWebcam');
const btnSrcIp = document.getElementById('btnSrcIp');
const btnIpSettings = document.getElementById('btnIpSettings');
const headerIpDot = document.getElementById('headerIpDot');
const ipModalDot = document.getElementById('ipModalDot');
const ipModalStatusText = document.getElementById('ipModalStatusText');
const ipTestBtn = document.getElementById('ipTestBtn');
const ipCameraUrlInput = document.getElementById('ipCameraUrlInput');
const backendApiHostInput = document.getElementById('backendApiHostInput');
const ipSettingsModal = document.getElementById('ipSettingsModal');
const ipSettingsCancelBtn = document.getElementById('ipSettingsCancelBtn');
const ipSettingsCancelIcon = document.getElementById('ipSettingsCancelIcon');
const ipSettingsSaveBtn = document.getElementById('ipSettingsSaveBtn');

const camBtn = document.getElementById('camBtn');
const camMenu = document.getElementById('camMenu');
const camChooseBtn = document.getElementById('camChooseBtn');
const camTakeBtn = document.getElementById('camTakeBtn');
const camGuideBtn = document.getElementById('camGuideBtn');
const camDocBtn = document.getElementById('camDocBtn');
const camMenuSourceLabel = document.getElementById('camMenuSourceLabel');
const camMenuSwitchBtn = document.getElementById('camMenuSwitchBtn');

const camInputLibrary = document.getElementById('camInputLibrary');
const camInputCamera = document.getElementById('camInputCamera');
const docInput = document.getElementById('docInput');

const attachPreview = document.getElementById('attachPreview');
const attachThumb = document.getElementById('attachThumb');
const attachRemoveBtn = document.getElementById('attachRemoveBtn');
const docAttachPreview = document.getElementById('docAttachPreview');
const docAttachLabel = document.getElementById('docAttachLabel');
const docAttachRemoveBtn = document.getElementById('docAttachRemoveBtn');

const snapOverlay = document.getElementById('snapOverlay');
const snapOverlaySwitcher = document.getElementById('snapOverlaySwitcher');
const snapSrcWebcam = document.getElementById('snapSrcWebcam');
const snapSrcIp = document.getElementById('snapSrcIp');
const snapVideo = document.getElementById('snapVideo');
const snapIpImg = document.getElementById('snapIpImg');
const snapHint = document.getElementById('snapHint');
const snapCaptureBtn = document.getElementById('snapCaptureBtn');
const snapCancelBtn = document.getElementById('snapCancelBtn');

const liveCamOverlay = document.getElementById('liveCamOverlay');
const liveOverlaySwitcher = document.getElementById('liveOverlaySwitcher');
const liveSrcWebcam = document.getElementById('liveSrcWebcam');
const liveSrcIp = document.getElementById('liveSrcIp');
const liveCamBadge = document.getElementById('liveCamBadge');
const liveCamVideo = document.getElementById('liveCamVideo');
const liveCamIpImg = document.getElementById('liveCamIpImg');
const liveCamAnswer = document.getElementById('liveCamAnswer');
const liveCamGoal = document.getElementById('liveCamGoal');
const liveCamMicBtn = document.getElementById('liveCamMicBtn');
const liveCamSendBtn = document.getElementById('liveCamSendBtn');
const ambientToggleBtn = document.getElementById('ambientToggleBtn');
const liveCamCloseBtn = document.getElementById('liveCamCloseBtn');

const panelWebcamPreview = document.getElementById('panelWebcamPreview');
const panelIpImgPreview = document.getElementById('panelIpImgPreview');

function startIpImgPolling(imgEl) {
  stopIpImgPolling();
  ipPollIntervalId = setInterval(() => {
    imgEl.src = `${API}/camera/frame?t=${Date.now()}`;
    if (panelIpImgPreview && panelIpImgPreview.style.display !== 'none') {
      panelIpImgPreview.src = `${API}/camera/frame?t=${Date.now()}`;
    }
  }, 200);
}

function stopIpImgPolling() {
  if (ipPollIntervalId) {
    clearInterval(ipPollIntervalId);
    ipPollIntervalId = null;
  }
}

function setCameraSource(source) {
  currentCameraSource = source;
  localStorage.setItem('companion_cam_source', source);
  const isWebcam = source === 'webcam';

  btnSrcWebcam && btnSrcWebcam.classList.toggle('active', isWebcam);
  btnSrcIp && btnSrcIp.classList.toggle('active', !isWebcam);
  liveSrcWebcam && liveSrcWebcam.classList.toggle('active', isWebcam);
  liveSrcIp && liveSrcIp.classList.toggle('active', !isWebcam);
  snapSrcWebcam && snapSrcWebcam.classList.toggle('active', isWebcam);
  snapSrcIp && snapSrcIp.classList.toggle('active', !isWebcam);

  if (camMenuSourceLabel) camMenuSourceLabel.textContent = isWebcam ? 'Webcam' : 'IP Camera';
  if (camMenuSwitchBtn) camMenuSwitchBtn.textContent = isWebcam ? 'Use IP Cam' : 'Use Webcam';
  if (contextCamSource) contextCamSource.textContent = isWebcam ? 'WEBCAM' : 'IP CAM';

  if (isWebcam) {
    if (panelIpImgPreview) panelIpImgPreview.style.display = 'none';
    if (panelWebcamPreview) panelWebcamPreview.style.display = 'block';
  } else {
    if (panelWebcamPreview) panelWebcamPreview.style.display = 'none';
    if (panelIpImgPreview) {
      panelIpImgPreview.style.display = 'block';
      startIpImgPolling(panelIpImgPreview);
    }
  }

  if (snapOverlay && snapOverlay.classList.contains('active')) startSnapCapture();
  if (liveCamOverlay && liveCamOverlay.classList.contains('active')) startGuidedSearch();
}

if (btnSrcWebcam) btnSrcWebcam.addEventListener('click', () => setCameraSource('webcam'));
if (btnSrcIp) btnSrcIp.addEventListener('click', () => setCameraSource('ipcamera'));
if (liveSrcWebcam) liveSrcWebcam.addEventListener('click', () => setCameraSource('webcam'));
if (liveSrcIp) liveSrcIp.addEventListener('click', () => setCameraSource('ipcamera'));
if (snapSrcWebcam) snapSrcWebcam.addEventListener('click', () => setCameraSource('webcam'));
if (snapSrcIp) snapSrcIp.addEventListener('click', () => setCameraSource('ipcamera'));
if (camMenuSwitchBtn) camMenuSwitchBtn.addEventListener('click', () => {
  setCameraSource(currentCameraSource === 'webcam' ? 'ipcamera' : 'webcam');
});

async function checkCameraStatus() {
  try {
    const res = await fetch(`${API}/camera/status`);
    if (res.ok) {
      const data = await res.json();
      if (data.url && ipCameraUrlInput && document.activeElement !== ipCameraUrlInput) {
        ipCameraUrlInput.value = data.url;
      }
      const isConnected = !!data.connected;
      const color = isConnected ? 'var(--teal)' : 'var(--coral)';
      if (headerIpDot) {
        headerIpDot.style.background = color;
        headerIpDot.title = isConnected ? `IP Camera online (${data.url})` : 'IP Camera offline';
      }
      if (ipModalDot) ipModalDot.style.background = color;
      if (ipModalStatusText) {
        ipModalStatusText.textContent = isConnected
          ? 'Camera connected'
          : (data.message || 'Camera not connected');
        ipModalStatusText.style.color = color;
      }
      return data;
    }
  } catch (e) {
    if (headerIpDot) headerIpDot.style.background = 'var(--text-faint)';
    if (ipModalDot) ipModalDot.style.background = 'var(--text-faint)';
    if (ipModalStatusText) {
      ipModalStatusText.textContent = 'App server offline';
      ipModalStatusText.style.color = 'var(--text-muted)';
    }
  }
  return null;
}
checkCameraStatus();
setInterval(checkCameraStatus, 8000);

if (btnIpSettings) {
  btnIpSettings.addEventListener('click', () => {
    if (ipSettingsModal) ipSettingsModal.classList.add('active');
    if (backendApiHostInput) backendApiHostInput.value = localStorage.getItem('companion_api_host') || '';
    checkCameraStatus();
    if (ipCameraUrlInput) ipCameraUrlInput.focus();
  });
}
if (ipSettingsCancelBtn) ipSettingsCancelBtn.addEventListener('click', () => ipSettingsModal.classList.remove('active'));
if (ipSettingsCancelIcon) ipSettingsCancelIcon.addEventListener('click', () => ipSettingsModal.classList.remove('active'));
if (ipSettingsModal) {
  ipSettingsModal.addEventListener('click', (e) => {
    if (e.target === ipSettingsModal) ipSettingsModal.classList.remove('active');
  });
}

if (ipTestBtn) {
  ipTestBtn.addEventListener('click', async () => {
    ipTestBtn.disabled = true;
    ipTestBtn.textContent = 'Pinging…';
    const status = await checkCameraStatus();
    ipTestBtn.disabled = false;
    ipTestBtn.textContent = 'Test camera';
    if (status && status.connected) setStatus('Camera connected.');
    else setStatus('Camera not connected. Check the address.', true);
  });
}

if (ipSettingsSaveBtn) {
  ipSettingsSaveBtn.addEventListener('click', async () => {
    if (backendApiHostInput) {
      const customHost = backendApiHostInput.value.trim();
      if (customHost) {
        API = customHost;
        localStorage.setItem('companion_api_host', API);
      } else {
        localStorage.removeItem('companion_api_host');
        API = (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
          ? `http://${window.location.hostname}:8000`
          : "http://127.0.0.1:8000";
      }
    }
    const newUrl = ipCameraUrlInput ? ipCameraUrlInput.value.trim() : '';
    if (!newUrl) {
      if (ipSettingsModal) ipSettingsModal.classList.remove('active');
      setStatus('Settings applied.');
      return;
    }
    setStatus('Connecting to camera…');
    ipSettingsSaveBtn.disabled = true;
    ipSettingsSaveBtn.textContent = 'Connecting…';
    try {
      const res = await fetch(`${API}/camera/set-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl })
      });
      if (res.ok) {
        const data = await res.json();
        ipCameraUrlInput.value = data.url;
        setCameraSource('ipcamera');
        await checkCameraStatus();
        setStatus(data.connected ? 'Camera connected.' : 'Camera address saved.');
      } else {
        setStatus('Could not save the camera settings.', true);
      }
    } catch (err) {
      setStatus('Cannot reach the app server.', true);
    } finally {
      ipSettingsSaveBtn.disabled = false;
      ipSettingsSaveBtn.textContent = 'Save & Apply';
      if (ipSettingsModal) ipSettingsModal.classList.remove('active');
    }
  });
}

// Camera Menu Controls
if (camBtn) {
  camBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    camMenu.classList.toggle('open');
  });
}
document.addEventListener('click', () => {
  if (camMenu) camMenu.classList.remove('open');
});
if (camChooseBtn) {
  camChooseBtn.addEventListener('click', () => {
    camMenu.classList.remove('open');
    if (camInputLibrary) camInputLibrary.click();
  });
}
if (camTakeBtn) {
  camTakeBtn.addEventListener('click', () => {
    camMenu.classList.remove('open');
    startSnapCapture();
  });
}
if (camGuideBtn) {
  camGuideBtn.addEventListener('click', () => {
    camMenu.classList.remove('open');
    startGuidedSearch();
  });
}
if (camDocBtn) {
  camDocBtn.addEventListener('click', () => {
    camMenu.classList.remove('open');
    if (docInput) docInput.click();
  });
}

// Tool Nav Shortcuts
const camVisionToolBtn = document.getElementById('camVisionToolBtn');
if (camVisionToolBtn) {
  camVisionToolBtn.addEventListener('click', () => {
    toggleSidebar(false);
    startGuidedSearch();
  });
}
const docToolBtn = document.getElementById('docToolBtn');
if (docToolBtn) {
  docToolBtn.addEventListener('click', () => {
    toggleSidebar(false);
    if (docInput) docInput.click();
  });
}

// --- 11. OPTICAL SNAPSHOT MODAL ---

async function startSnapCapture() {
  if (currentCameraSource === 'webcam') {
    stopIpImgPolling();
    if (snapIpImg) { snapIpImg.style.display = 'none'; snapIpImg.src = ''; }
    if (snapVideo) snapVideo.style.display = 'block';
    if (snapHint) snapHint.textContent = 'Point the webcam, then take a photo';
    try {
      if (!snapStream) snapStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (snapVideo) snapVideo.srcObject = snapStream;
      if (snapOverlay) snapOverlay.classList.add('active');
    } catch (err) {
      setStatus('Webcam access unavailable.', true);
    }
  } else {
    if (snapStream) {
      snapStream.getTracks().forEach(t => t.stop());
      snapStream = null;
    }
    if (snapVideo) snapVideo.style.display = 'none';
    if (snapIpImg) {
      snapIpImg.style.display = 'block';
      startIpImgPolling(snapIpImg);
    }
    if (snapHint) snapHint.textContent = 'Point the IP camera, then take a photo';
    if (snapOverlay) snapOverlay.classList.add('active');
  }
}

function stopSnapCapture() {
  if (snapStream) {
    snapStream.getTracks().forEach(t => t.stop());
    snapStream = null;
  }
  stopIpImgPolling();
  if (snapIpImg) snapIpImg.src = '';
  if (snapOverlay) snapOverlay.classList.remove('active');
}

if (snapCancelBtn) snapCancelBtn.addEventListener('click', stopSnapCapture);
if (snapOverlay) {
  snapOverlay.addEventListener('click', (e) => {
    if (e.target === snapOverlay) stopSnapCapture();
  });
}

if (snapCaptureBtn) {
  snapCaptureBtn.addEventListener('click', async () => {
    if (currentCameraSource === 'webcam') {
      const canvas = document.createElement('canvas');
      canvas.width = snapVideo.videoWidth || 640;
      canvas.height = snapVideo.videoHeight || 480;
      canvas.getContext('2d').drawImage(snapVideo, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], 'webcam-frame.jpg', { type: 'image/jpeg' });
        pendingImageFile = file;
        pendingImageUrl = URL.createObjectURL(blob);
        if (attachThumb) attachThumb.src = pendingImageUrl;
        if (attachPreview) attachPreview.classList.add('active');
        if (goalEl) {
          goalEl.placeholder = "Ask a question about this photo…";
          goalEl.focus();
        }
        stopSnapCapture();
      }, 'image/jpeg', 0.85);
    } else {
      setStatus('Taking a picture from the IP camera…');
      try {
        const res = await fetch(`${API}/camera/frame?t=${Date.now()}`);
        if (!res.ok) throw new Error('Could not retrieve frame');
        const blob = await res.blob();
        const file = new File([blob], 'ipcam-frame.jpg', { type: 'image/jpeg' });
        pendingImageFile = file;
        pendingImageUrl = URL.createObjectURL(blob);
        if (attachThumb) attachThumb.src = pendingImageUrl;
        if (attachPreview) attachPreview.classList.add('active');
        if (goalEl) {
          goalEl.placeholder = "Ask a question about this photo…";
          goalEl.focus();
        }
        stopSnapCapture();
        setStatus('');
      } catch (err) {
        setStatus('Could not take a picture from the camera.', true);
      }
    }
  });
}

// Media Attachment Pickers
if (camInputLibrary) camInputLibrary.addEventListener('change', () => attachPhoto(camInputLibrary));
if (camInputCamera) camInputCamera.addEventListener('change', () => attachPhoto(camInputCamera));

function attachPhoto(inputEl) {
  const file = inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  clearDocumentAttachment();
  pendingImageFile = file;
  pendingImageUrl = URL.createObjectURL(file);
  if (attachThumb) attachThumb.src = pendingImageUrl;
  if (attachPreview) attachPreview.classList.add('active');
  if (goalEl) {
    goalEl.placeholder = "Ask a question about this photo…";
    goalEl.focus();
  }
}

if (attachRemoveBtn) attachRemoveBtn.addEventListener('click', clearAttachment);

function clearAttachment() {
  pendingImageFile = null;
  if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
  pendingImageUrl = null;
  if (attachPreview) attachPreview.classList.remove('active');
  if (goalEl) goalEl.placeholder = "Specify a goal or question — e.g. how do I make biryani";
}

// Document Upload
if (docInput) {
  docInput.addEventListener('change', async () => {
    const file = docInput.files[0];
    docInput.value = '';
    if (!file) return;
    clearAttachment();
    setStatus('Opening your document…');
    if (sendBtn) sendBtn.disabled = true;

    const formData = new FormData();
    formData.append('file', file, file.name);

    try {
      const res = await fetch(`${API}/upload-document`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      pendingDocumentId = data.document_id;
      pendingDocumentName = data.filename;
      if (docAttachLabel) docAttachLabel.textContent = `${data.filename} (${data.page_count} pages)`;
      if (docAttachPreview) docAttachPreview.classList.add('active');
      if (goalEl) {
        goalEl.placeholder = "Ask a question about this document…";
        goalEl.focus();
      }
      setStatus(data.truncated ? 'Opened the first part of this large document.' : '');
    } catch (err) {
      setStatus('Could not open the document. Please try again.', true);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  });
}

if (docAttachRemoveBtn) docAttachRemoveBtn.addEventListener('click', clearDocumentAttachment);

function clearDocumentAttachment() {
  pendingDocumentId = null;
  pendingDocumentName = null;
  if (docAttachPreview) docAttachPreview.classList.remove('active');
  if (goalEl) goalEl.placeholder = "Specify a goal or question — e.g. how do I make biryani";
}

// Unified Send Dispatcher
function handleSendClick() {
  const text = goalEl ? goalEl.value.trim() : '';

  if (awaitingClarification && text && !pendingDocumentId && !pendingImageFile) {
    awaitingClarification = false;
    goalEl.value = '';
    goalEl.style.height = 'auto';
    sendMessage(`${currentGoal} - ${text}`);
    return;
  }

  if (pendingDocumentId) {
    const question = text || "Summarize the primary conclusions of this document.";
    goalEl.value = '';
    goalEl.style.height = 'auto';
    askDocument(question);
  } else if (pendingImageFile) {
    const question = text || "Describe the contents and objects within this image.";
    goalEl.value = '';
    goalEl.style.height = 'auto';
    sendImageMessage(pendingImageFile, pendingImageUrl, question);
    clearAttachment();
  } else {
    if (!text) return;
    goalEl.value = '';
    goalEl.style.height = 'auto';
    sendMessage(text);
  }
}

async function askDocument(question) {
  unlockBadge('doc', 'Bookworm');
  addUserBubble(`📄 ${question}`);
  history.push({ role: "user", content: question });
  setStatus('Reading your document…');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch(`${API}/ask-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: pendingDocumentId, question }),
    });
    if (!res.ok) throw new Error('ask-document failed');
    const data = await res.json();
    addAnswerBubble(data.headline, data.detail);
    history.push({ role: "assistant", content: flattenAnswer(data.headline, data.detail) });
    setStatus('');
  } catch (err) {
    setStatus('Could not read the document. Please try again.', true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function sendImageMessage(file, imageUrl, question) {
  unlockBadge('photo', 'Photo Detective');
  addUserBubble(question, imageUrl);
  history.push({ role: "user", content: question });
  setStatus('Looking at your photo…');
  if (sendBtn) sendBtn.disabled = true;

  const formData = new FormData();
  formData.append('file', file, file.name || 'snapshot.jpg');
  formData.append('question', question);
  formData.append('history', JSON.stringify(history.slice(-8)));

  try {
    const res = await fetch(`${API}/caption-image`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('caption failed');
    const data = await res.json();
    addAnswerBubble(data.headline, data.steps);
    history.push({ role: "assistant", content: flattenAnswer(data.headline, data.steps) });
    setStatus('');
  } catch (err) {
    setStatus('Could not read the photo. Please try again.', true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

// --- 12. VISION HUD WORKSPACE & CONTINUOUS SCENE REASONING ---

async function startGuidedSearch() {
  unlockBadge('live', 'Live Explorer');
  if (currentCameraSource === 'webcam') {
    stopIpImgPolling();
    if (liveCamIpImg) { liveCamIpImg.style.display = 'none'; liveCamIpImg.src = ''; }
    if (liveCamVideo) liveCamVideo.style.display = 'block';
    try {
      if (!liveCamStream) {
        liveCamStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
      }
      if (liveCamVideo) liveCamVideo.srcObject = liveCamStream;
      if (liveCamOverlay) liveCamOverlay.classList.add('active');
      setLiveCamAnswer("Webcam is on. Point it at something and ask a question.");
      speak("Webcam active.");
      if (liveCamGoal) { liveCamGoal.value = ''; liveCamGoal.focus(); }
    } catch (err) {
      setStatus('Camera access was blocked.', true);
    }
  } else {
    if (liveCamStream) {
      liveCamStream.getTracks().forEach(t => t.stop());
      liveCamStream = null;
    }
    if (liveCamVideo) liveCamVideo.style.display = 'none';
    if (liveCamIpImg) {
      liveCamIpImg.style.display = 'block';
      startIpImgPolling(liveCamIpImg);
    }
    if (liveCamOverlay) liveCamOverlay.classList.add('active');
    setLiveCamAnswer("IP camera is on. Point it at something and ask a question.");
    speak("IP Camera active.");
    if (liveCamGoal) { liveCamGoal.value = ''; liveCamGoal.focus(); }
  }
}

function stopLiveCam() {
  if (liveCamStream) {
    liveCamStream.getTracks().forEach(t => t.stop());
    liveCamStream = null;
  }
  stopIpImgPolling();
  stopAmbientMode();
  if (liveCamIpImg) liveCamIpImg.src = '';
  if (liveCamOverlay) liveCamOverlay.classList.remove('active');
  window.speechSynthesis && window.speechSynthesis.cancel();
}

if (liveCamCloseBtn) liveCamCloseBtn.addEventListener('click', stopLiveCam);
if (liveCamOverlay) {
  liveCamOverlay.addEventListener('click', (e) => {
    if (e.target === liveCamOverlay) stopLiveCam();
  });
}

function setLiveCamAnswer(text, isThinking = false) {
  if (!liveCamAnswer) return;
  liveCamAnswer.textContent = text;
  liveCamAnswer.classList.toggle('thinking', isThinking);
}

async function captureCurrentFrame() {
  if (currentCameraSource === 'webcam') {
    if (!liveCamStream || !liveCamVideo) return null;
    const canvas = document.createElement('canvas');
    canvas.width = liveCamVideo.videoWidth || 640;
    canvas.height = liveCamVideo.videoHeight || 480;
    canvas.getContext('2d').drawImage(liveCamVideo, 0, 0);
    return new Promise((resolve) => canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8));
  } else {
    try {
      const res = await fetch(`${API}/camera/frame?t=${Date.now()}`);
      if (!res.ok) return null;
      return await res.blob();
    } catch (e) {
      return null;
    }
  }
}

async function askLiveCamera() {
  const question = liveCamGoal ? liveCamGoal.value.trim() : '';
  if (!question) return;
  liveCamGoal.value = '';
  setLiveCamAnswer("Looking at the picture…", true);
  if (liveCamSendBtn) liveCamSendBtn.disabled = true;

  const blob = await captureCurrentFrame();
  if (!blob) {
    setLiveCamAnswer(currentCameraSource === 'webcam'
      ? "Could not capture the picture."
      : "Camera picture unavailable. Check the connection.");
    if (liveCamSendBtn) liveCamSendBtn.disabled = false;
    return;
  }

  const formData = new FormData();
  formData.append('file', blob, 'frame.jpg');
  formData.append('question', question);
  formData.append('history', JSON.stringify(history.slice(-8)));
  const endpoint = currentCameraSource === 'webcam' ? '/caption-image' : '/camera/ask';

  try {
    const res = await fetch(`${API}${endpoint}`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('request failed');
    const data = await res.json();
    if (data.error) {
      setLiveCamAnswer(data.error);
      speak("Camera problem.");
    } else {
      const fullAnswer = flattenAnswer(data.headline, data.steps);
      setLiveCamAnswer(fullAnswer);
      speak(data.headline);
      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: fullAnswer });
    }
  } catch (err) {
    setLiveCamAnswer("Cannot reach the camera helper.");
  } finally {
    if (liveCamSendBtn) liveCamSendBtn.disabled = false;
  }
}

if (liveCamSendBtn) liveCamSendBtn.addEventListener('click', askLiveCamera);
if (liveCamGoal) {
  liveCamGoal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askLiveCamera();
    }
  });
}

if (liveCamMicBtn) {
  liveCamMicBtn.addEventListener('click', async () => {
    if (!LiveRecognition) {
      setStatus('Speech recognition unsupported in this client.', true);
      return;
    }
    const rec = new LiveRecognition();
    rec.lang = currentLang().bcp;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript;
      }
      if (liveCamGoal) liveCamGoal.value = combined;
    };
    liveCamMicBtn.classList.add('recording');
    rec.onend = () => {
      liveCamMicBtn.classList.remove('recording');
      if (liveCamGoal && liveCamGoal.value.trim()) askLiveCamera();
    };
    try { rec.start(); } catch (e) {}
  });
}

// Continuous Ambient Scene Description Loop
if (ambientToggleBtn) {
  ambientToggleBtn.addEventListener('click', () => {
    ambientRunning ? stopAmbientMode() : startAmbientMode();
  });
}

function startAmbientMode() {
  ambientRunning = true;
  ambientToggleBtn.classList.add('active');
  describeSceneOnce();
  ambientIntervalId = setInterval(describeSceneOnce, 6000);
}

function stopAmbientMode() {
  ambientRunning = false;
  if (ambientToggleBtn) ambientToggleBtn.classList.remove('active');
  if (ambientIntervalId) {
    clearInterval(ambientIntervalId);
    ambientIntervalId = null;
  }
}

async function describeSceneOnce() {
  const blob = await captureCurrentFrame();
  if (!blob) return;
  const formData = new FormData();
  formData.append('file', blob, 'frame.jpg');
  formData.append('question', "Briefly summarize what is visible in this frame in one direct sentence.");
  formData.append('history', '[]');
  const endpoint = currentCameraSource === 'webcam' ? '/caption-image' : '/camera/ask';

  try {
    const res = await fetch(`${API}${endpoint}`, { method: 'POST', body: formData });
    if (!res.ok) return;
    const data = await res.json();
    if (data.error) return;
    setLiveCamAnswer(data.headline);
    speak(data.headline);
  } catch (e) {}
}

// --- 13. PERSONAL GROWTH & CAPABILITY PROGRESS ---

const GAMIFY_KEY = 'companion_gamify';
const PLANT_STAGES = ['🌱 Seedling', '🌿 Sprout', '🪴 Branching', '🌳 Flourishing', '🌸 Master'];

function loadGamify() {
  try {
    return JSON.parse(localStorage.getItem(GAMIFY_KEY)) || defaultGamify();
  } catch (e) {
    return defaultGamify();
  }
}

function defaultGamify() {
  return { totalSteps: 0, streak: 0, lastActiveDate: null, plantStage: 0, badges: [] };
}

function saveGamify(g) {
  try {
    localStorage.setItem(GAMIFY_KEY, JSON.stringify(g));
  } catch (e) {}
}

function celebrateStep() {
  const g = loadGamify();
  g.totalSteps += 1;
  g.plantStage = Math.min(4, Math.floor(g.totalSteps / 5));
  updateStreak(g);
  saveGamify(g);
  showToast(`Step done. Total: ${g.totalSteps}`);
  renderGamifyBar();
}

function celebrateTaskDone() {
  showToast("All steps done. Well done!", true);
}

function updateStreak(g) {
  const today = new Date().toDateString();
  if (g.lastActiveDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  g.streak = (g.lastActiveDate === yesterday) ? g.streak + 1 : 1;
  g.lastActiveDate = today;
}

function unlockBadge(name, label) {
  const g = loadGamify();
  if (g.badges.includes(name)) return;
  g.badges.push(name);
  saveGamify(g);
  showToast(`New badge: ${label}`);
}

function showToast(msg, isAccent = false) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed; bottom:78px; left:50%; transform:translateX(-50%);
    background-color:${isAccent ? 'var(--teal)' : 'var(--bg-elevated)'};
    color:${isAccent ? 'var(--bg-base)' : 'var(--text-primary)'};
    border:1px solid var(--border-medium); padding:7px 16px; border-radius:4px;
    font-family:var(--font-mono); font-size:12px; font-weight:600; z-index:900;
    box-shadow:var(--shadow-card); animation:fadeIn 0.2s ease;`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function renderGamifyBar() {
  const g = loadGamify();
  const stageIcon = document.getElementById('gamifyStageIcon');
  const label = document.getElementById('gamifyLabel');
  const streak = document.getElementById('gamifyStreak');

  const stageIcons = ['🌱', '🌿', '🪴', '🌳', '🌸'];
  if (stageIcon) stageIcon.textContent = stageIcons[g.plantStage] || '🌱';
  if (label) label.textContent = `${g.totalSteps} steps completed`;
  if (streak) streak.textContent = `${g.streak}d streak`;

  // Update Right Panel Growth Meter
  const growthMeterFill = document.getElementById('growthMeterFill');
  const growthStageName = document.getElementById('growthStageName');
  const growthNextTarget = document.getElementById('growthNextTarget');
  
  if (growthMeterFill) {
    const pct = Math.min(100, ((g.totalSteps % 5) / 5) * 100);
    growthMeterFill.style.width = pct + '%';
  }
  if (growthStageName) {
    growthStageName.textContent = PLANT_STAGES[g.plantStage] || 'Seedling';
  }
  if (growthNextTarget) {
    const remaining = 5 - (g.totalSteps % 5);
    growthNextTarget.textContent = `${remaining} steps to next phase`;
  }
}
renderGamifyBar();

// Milestones Modal
const viewBadgesBtn = document.getElementById('viewBadgesBtn');
const badgesModal = document.getElementById('badgesModal');
const badgesCloseBtn = document.getElementById('badgesCloseBtn');
const badgesContainer = document.getElementById('badgesContainer');

const ALL_BADGES = [
  { id: 'voice', title: 'Voice', desc: 'Asked a question using your voice' },
  { id: 'photo', title: 'Photo Helper', desc: 'Asked a question about a photo' },
  { id: 'doc', title: 'Document Reader', desc: 'Asked a question about a PDF' },
  { id: 'live', title: 'Live Camera', desc: 'Used the live camera guide' },
];

function showBadgesModal() {
  const g = loadGamify();
  if (badgesContainer) {
    badgesContainer.innerHTML = ALL_BADGES.map(b => {
      const unlocked = g.badges.includes(b.id);
      return `
        <div class="milestone-tile ${unlocked ? 'unlocked' : ''}">
          <div style="font-size:16px;">${unlocked ? '✓' : '○'}</div>
          <div>
            <div class="milestone-name">${b.title}</div>
            <div class="milestone-desc">${unlocked ? 'Unlocked' : 'Locked'} - ${b.desc}</div>
          </div>
        </div>
      `;
    }).join('');
  }
  if (badgesModal) badgesModal.classList.add('active');
  toggleSidebar(false);
}

if (viewBadgesBtn) viewBadgesBtn.addEventListener('click', showBadgesModal);
const gamifyBarEl = document.getElementById('gamifyBar');
if (gamifyBarEl) gamifyBarEl.addEventListener('click', showBadgesModal);
if (badgesCloseBtn) badgesCloseBtn.addEventListener('click', () => badgesModal.classList.remove('active'));
if (badgesModal) {
  badgesModal.addEventListener('click', (e) => {
    if (e.target === badgesModal) badgesModal.classList.remove('active');
  });
}

// --- 14. PRIVATE HEALTH LOG SYSTEM ---

const HEALTH_LOG_KEY = 'companion_health_log';

function loadHealthLog() {
  try {
    return JSON.parse(localStorage.getItem(HEALTH_LOG_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveHealthLog(entries) {
  try {
    localStorage.setItem(HEALTH_LOG_KEY, JSON.stringify(entries));
  } catch (e) {}
}

function addHealthLogEntry(type, value, note) {
  const entries = loadHealthLog();
  entries.unshift({ id: Date.now(), type, value, note, timestamp: new Date().toISOString() });
  saveHealthLog(entries);
}

function recentHealthLogSummary(limit = 5) {
  const entries = loadHealthLog().slice(0, limit);
  if (!entries.length) return '';
  const parts = entries.map(e => {
    const d = new Date(e.timestamp).toLocaleDateString();
    return `${e.type}: ${e.value}${e.note ? ` (${e.note})` : ''} on ${d}`;
  });
  return `Recent health telemetry: ${parts.join('; ')}.`;
}

const healthLogBtnEl = document.getElementById('healthLogBtn');
if (healthLogBtnEl) healthLogBtnEl.addEventListener('click', showHealthLogPanel);

function showHealthLogPanel() {
  toggleSidebar(false);
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const box = document.createElement('div');
  box.className = 'settings-box';

  box.innerHTML = `
    <div class="dialog-header">
      <div class="dialog-title-group">
        <div class="dialog-badge">PRIVATE ON THIS DEVICE</div>
        <div class="dialog-title">Health Log</div>
      </div>
      <button type="button" class="dialog-close-btn" id="hlCloseIcon" aria-label="Close">✕</button>
    </div>

    <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:12px;">
      Saved only on this device. Used only to give better answers in medical chats.
    </p>

    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <input id="hlType" placeholder="Metric (Glucose, BP, Mood)" style="flex:1; padding:8px 10px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
      <input id="hlValue" placeholder="Value (e.g. 110, 120/80)" style="width:140px; padding:8px 10px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
    </div>
    <input id="hlNote" placeholder="Note (optional)" style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px; margin-bottom:12px;">
    <button id="hlAddBtn" class="btn-execute" style="width:100%; margin-bottom:16px;">Save Entry</button>

    <div style="font-family:var(--font-mono); font-size:10px; font-weight:700; color:var(--text-muted); margin-bottom:6px;">YOUR ENTRIES</div>
    <div id="hlList" style="max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;"></div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function renderList() {
    const entries = loadHealthLog();
    const list = box.querySelector('#hlList');
    if (!entries.length) {
      list.innerHTML = '<div style="color:var(--text-muted); font-size:12px; padding:6px 0;">No entries yet.</div>';
      return;
    }
    list.innerHTML = entries.slice(0, 20).map(e => {
      const d = new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `
        <div style="padding:8px 10px; border:1px solid var(--border-subtle); border-radius:4px; background:var(--bg-subtle); font-size:13px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${escapeHtml(e.type)}</strong>: ${escapeHtml(String(e.value))}
            ${e.note ? `<span style="color:var(--text-secondary);"> — ${escapeHtml(e.note)}</span>` : ''}
          </div>
          <div style="color:var(--text-muted); font-family:var(--font-mono); font-size:10.5px; margin-left:8px;">${d}</div>
        </div>
      `;
    }).join('');
  }
  renderList();

  box.querySelector('#hlAddBtn').onclick = () => {
    const type = box.querySelector('#hlType').value.trim();
    const value = box.querySelector('#hlValue').value.trim();
    const note = box.querySelector('#hlNote').value.trim();
    if (!type || !value) return;
    addHealthLogEntry(type, value, note);
    box.querySelector('#hlType').value = '';
    box.querySelector('#hlValue').value = '';
    box.querySelector('#hlNote').value = '';
    renderList();
  };

  const closeMe = () => overlay.remove();
  box.querySelector('#hlCloseIcon').onclick = closeMe;
  overlay.onclick = (e) => { if (e.target === overlay) closeMe(); };
}

// --- 14.5. EMERGENCY CONTACTS STORAGE & ALERT SYSTEM ---

const EMERGENCY_CONTACTS_KEY = 'companion_emergency_contacts';

function loadEmergencyContacts() {
  try {
    const raw = localStorage.getItem(EMERGENCY_CONTACTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveEmergencyContacts(list) {
  try {
    localStorage.setItem(EMERGENCY_CONTACTS_KEY, JSON.stringify(list));
  } catch (e) {}
}

function buildEmergencyAlertMessage(contact, coords, hospital) {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
  let msg = `🚨 EMERGENCY SOS ALERT from Smart Companion 🚨\n`;
  msg += `Hi ${contact.name || 'there'}, I need immediate emergency medical assistance!\n\n`;
  if (coords && coords.lat != null && coords.lon != null) {
    msg += `📍 My GPS Coordinates: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}\n`;
    msg += `🗺️ Google Maps Location & Directions:\nhttps://maps.google.com/?q=${coords.lat},${coords.lon}\n\n`;
  }
  if (hospital && hospital.name) {
    msg += `🏥 Target / Nearest Facility: ${hospital.name}`;
    if (hospital.distance_km != null) msg += ` (${hospital.distance_km} km away)`;
    msg += `\n`;
    if (hospital.address) msg += `Address: ${hospital.address}\n`;
    msg += `\n`;
  }
  msg += `⏰ Timestamp: ${timeStr}, ${dateStr}\n`;
  msg += `Please call me or send emergency help immediately!`;
  return msg;
}

const emergencyContactsBtnEl = document.getElementById('emergencyContactsBtn');
if (emergencyContactsBtnEl) emergencyContactsBtnEl.addEventListener('click', showEmergencyContactsModal);

function showEmergencyContactsModal() {
  toggleSidebar(false);
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.zIndex = '999';

  const box = document.createElement('div');
  box.className = 'settings-box';
  box.style.maxWidth = '540px';

  function renderModalContent() {
    const contacts = loadEmergencyContacts();
    box.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-title-group">
          <div class="dialog-badge" style="color:var(--coral);">SAFETY</div>
          <div class="dialog-title">Emergency Contacts & SOS Alerts</div>
        </div>
        <button type="button" class="dialog-close-btn" id="ecCloseBtn" aria-label="Close">✕</button>
      </div>

      <div class="dialog-body" style="padding:16px 18px; max-height:80vh; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:12.5px; color:var(--text-secondary); margin:0;">
          Save trusted emergency contacts (family, physician, close friend). When you activate the SOS Protocol, an automated emergency alert with your live GPS location and Google Maps link will be sent to them immediately.
        </p>

        <!-- Add Contact Form -->
        <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:12px; display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:12px; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em;">
            ➕ Add Emergency Contact
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <input id="ecNameInput" placeholder="Name (e.g. Mom, Dr. Sarah)" style="flex:1; min-width:140px; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface-elevated); color:var(--text-primary); font-size:12.5px;">
            <input id="ecPhoneInput" placeholder="Phone (e.g. +91 98765 43210)" style="flex:1; min-width:160px; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface-elevated); color:var(--text-primary); font-size:12.5px;">
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <input id="ecRelInput" placeholder="Relationship (e.g. Parent, Spouse, Physician)" style="flex:1; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface-elevated); color:var(--text-primary); font-size:12.5px;">
            <button type="button" id="ecSaveBtn" class="btn-execute" style="padding:8px 16px; font-size:12.5px; white-space:nowrap; background:var(--coral);">Save Contact</button>
          </div>
        </div>

        <!-- Saved Contacts List -->
        <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">
            SAVED EMERGENCY CONTACTS (${contacts.length})
          </div>
          <div id="ecList" style="display:flex; flex-direction:column; gap:6px;">
            ${contacts.length ? contacts.map(c => `
              <div class="contacts-manager-card">
                <div>
                  <div style="font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:6px; font-size:13px;">
                    <span>👤</span>
                    <span>${escapeHtml(c.name)}</span>
                    ${c.relationship ? `<span style="font-size:10.5px; color:var(--text-muted); border:1px solid var(--border-subtle); padding:1px 5px; border-radius:4px;">${escapeHtml(c.relationship)}</span>` : ''}
                  </div>
                  <div style="color:var(--text-secondary); font-family:var(--font-mono); font-size:12px; margin-top:2px;">
                    📞 ${escapeHtml(c.phone)}
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <a href="tel:${escapeHtml(c.phone.replace(/\D/g, ''))}" class="btn-subtle" style="padding:4px 8px; font-size:11.5px; text-decoration:none; color:var(--teal);" title="Call">📞 Call</a>
                  <button type="button" class="btn-subtle ec-delete-btn" data-id="${c.id}" style="padding:4px 8px; font-size:11.5px; color:var(--coral);" title="Delete">🗑️</button>
                </div>
              </div>
            `).join('') : `
              <div style="color:var(--text-muted); font-size:12px; padding:10px; text-align:center; background:var(--bg-subtle); border-radius:var(--radius-sm); border:1px dashed var(--border-subtle);">
                No emergency contacts saved yet. Add one above to enable automated SMS & WhatsApp SOS alerts.
              </div>
            `}
          </div>
        </div>

        <!-- Sample Emergency SMS Preview -->
        <div style="margin-top:4px;">
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">
            MESSAGE THAT WILL BE SENT
          </div>
          <div class="sos-message-preview-box">🚨 EMERGENCY SOS ALERT from Smart Companion 🚨
Hi Mom, I need immediate emergency medical assistance!

📍 My GPS Coordinates: 22.57264, 88.36389
🗺️ Google Maps Location & Directions:
https://maps.google.com/?q=22.57264,88.36389

🏥 Target / Nearest Facility: SSKM Hospital (1.2 km away)
⏰ Timestamp: 10:55 AM, Oct 9
Please call me or send emergency help immediately!</div>
        </div>

        <button type="button" id="ecDismissBtn" class="btn-subtle" style="width:100%; margin-top:4px;">Close</button>
      </div>
    `;

    box.querySelector('#ecCloseBtn').onclick = () => overlay.remove();
    box.querySelector('#ecDismissBtn').onclick = () => overlay.remove();

    box.querySelectorAll('.ec-delete-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const remaining = loadEmergencyContacts().filter(c => c.id !== id);
        saveEmergencyContacts(remaining);
        renderModalContent();
      };
    });

    const saveBtn = box.querySelector('#ecSaveBtn');
    const nameInput = box.querySelector('#ecNameInput');
    const phoneInput = box.querySelector('#ecPhoneInput');
    const relInput = box.querySelector('#ecRelInput');

    const handleSave = () => {
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const rel = relInput.value.trim();
      if (!name || !phone) return;
      const list = loadEmergencyContacts();
      list.push({ id: 'ec-' + Date.now(), name, phone, relationship: rel });
      saveEmergencyContacts(list);
      renderModalContent();
    };

    if (saveBtn) saveBtn.onclick = handleSave;
    [nameInput, phoneInput, relInput].forEach(inp => {
      if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSave(); });
    });
  }

  renderModalContent();
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// --- 15. EMERGENCY SOS MEDICAL PROTOCOL ---

// Caches the browser's last known location client-side, so we don't
// re-ask GPS (with its own permission prompt + latency) on every single
// lookup - same pattern apps like Zomato/Swiggy use. maxAgeMs controls
// how stale a cached fix is allowed to be before we fetch a fresh one.
const LOCATION_CACHE_KEY = 'companion_last_location';

function getCachedOrFreshLocation(maxAgeMs = 10 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    try {
      const cached = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY));
      if (cached && (Date.now() - cached.timestamp) < maxAgeMs) {
        resolve({ lat: cached.lat, lon: cached.lon, fromCache: true });
        return;
      }
    } catch (e) {}

    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        try { localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ lat, lon, timestamp: Date.now() })); } catch (e) {}
        resolve({ lat, lon, fromCache: false });
      },
      (err) => reject(err),
      { timeout: 8000 }
    );
  });
}

const sosBtnEl = document.getElementById('sosBtn');
if (sosBtnEl) sosBtnEl.addEventListener('click', showEmergencyPanel);

function showEmergencyPanel() {
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.zIndex = '999';

  const box = document.createElement('div');
  box.className = 'settings-box emergency-dialog';

  // State tracking for SOS Location & Google Maps Navigation:
  let originData = null; // { lat, lon, label }
  let destinationData = null; // { id, name, lat, lon, address, phone, distance_km }
  let currentTravelMode = 'driving'; // 'driving', 'walking', 'transit'
  let currentDirFlg = 'd'; // 'd', 'w', 'r'
  let nearbyHospitalsList = [];
  let alertDispatched = false;

  box.innerHTML = `
    <div class="dialog-header">
      <div class="dialog-title-group">
        <div class="dialog-badge" style="color:var(--coral); display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--coral); box-shadow:0 0 8px var(--coral); animation:pulse-dot 1.5s infinite;"></span>
          EMERGENCY
        </div>
        <div class="dialog-title" style="color:var(--coral);">Emergency Help</div>
      </div>
      <button type="button" class="dialog-close-btn" id="sosCloseBtn" aria-label="Close">✕</button>
    </div>

    <div class="sos-dialog-body">
      <p style="font-size:13px; color:var(--text-secondary); margin:0;">
        If you or someone nearby is experiencing chest pain, acute respiratory distress, severe trauma, or urgent symptoms, call emergency services directly:
      </p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <a href="tel:108" style="display:flex; align-items:center; justify-content:space-between; padding:11px 13px; border-radius:var(--radius-sm); background-color:var(--coral); color:#ffffff; font-weight:700; text-decoration:none; box-shadow:0 3px 12px rgba(244,63,94,0.3);">
          <span>🚨 Call Ambulance</span>
          <span style="font-family:var(--font-mono); font-size:15px;">108</span>
        </a>
        <a href="tel:104" style="display:flex; align-items:center; justify-content:space-between; padding:11px 13px; border-radius:var(--radius-sm); background-color:var(--bg-subtle); border:1px solid var(--border-subtle); color:var(--text-primary); font-weight:700; text-decoration:none;">
          <span>📞 Health Helpline</span>
          <span style="font-family:var(--font-mono); font-size:15px;">104</span>
        </a>
      </div>

      <!-- Emergency Contact & Automated Message Alert Section -->
      <div id="sosContactSection" class="sos-contact-section"></div>

      <!-- SOS Location & Google Map Route Section -->
      <div id="sosLocationSection" class="sos-card-container">
        <div class="sos-location-header">
          <div class="sos-location-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--coral);"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            <span>Directions to a hospital</span>
          </div>
          <span class="sos-google-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
            Google Maps
          </span>
        </div>

        <div id="sosLocationContent">
          <div id="sosLocationLoading" style="display:flex; align-items:center; gap:10px; padding:16px 12px; background:var(--bg-subtle); border-radius:var(--radius-sm); border:1px solid var(--border-subtle); color:var(--text-secondary); font-size:12.5px;">
            <span style="display:inline-block; width:14px; height:14px; border-radius:50%; border:2px solid var(--coral); border-top-color:transparent; animation:spin 0.8s linear infinite; flex-shrink:0;"></span>
            <span>Finding your location and the nearest hospital…</span>
          </div>
        </div>
      </div>

      <button id="sosCloseActionBtn" class="btn-subtle" style="width:100%;">Close</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const closeMe = () => overlay.remove();
  box.querySelector('#sosCloseBtn').onclick = closeMe;
  box.querySelector('#sosCloseActionBtn').onclick = closeMe;
  overlay.onclick = (e) => { if (e.target === overlay) closeMe(); };

  const contentArea = box.querySelector('#sosLocationContent');
  const contactArea = box.querySelector('#sosContactSection');

  function renderEmergencyContactCard() {
    if (!contactArea) return;
    const contacts = loadEmergencyContacts();

    if (!contacts.length) {
      contactArea.innerHTML = `
        <div class="sos-contact-header">
          <div class="sos-contact-title">
            <span style="font-size:15px;">⚠️</span>
            <span>Emergency Contact</span>
          </div>
          <span class="sos-alert-badge pending">NO CONTACT YET</span>
        </div>
        <p style="font-size:12px; color:var(--text-secondary); margin:0;">
          Add a trusted contact number so an automated emergency message with your live GPS coordinates & map link is prepared and sent immediately:
        </p>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:2px;">
          <input id="sosQuickName" placeholder="Name (e.g. Mom)" style="flex:1; min-width:110px; padding:7px 9px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:12.5px;">
          <input id="sosQuickPhone" placeholder="Phone (+91...)" style="flex:1; min-width:140px; padding:7px 9px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:12.5px;">
          <button type="button" id="sosQuickSaveBtn" class="btn-execute" style="padding:7px 12px; font-size:12px; white-space:nowrap; background:var(--coral);">Save contact</button>
        </div>
      `;

      const quickSaveBtn = contactArea.querySelector('#sosQuickSaveBtn');
      const quickNameInput = contactArea.querySelector('#sosQuickName');
      const quickPhoneInput = contactArea.querySelector('#sosQuickPhone');

      const handleQuickSave = () => {
        const name = quickNameInput.value.trim() || 'Emergency Contact';
        const phone = quickPhoneInput.value.trim();
        if (!phone) return;
        saveEmergencyContacts([{ id: 'ec-' + Date.now(), name, phone, relationship: 'Emergency Contact' }]);
        renderEmergencyContactCard();
      };

      if (quickSaveBtn) quickSaveBtn.onclick = handleQuickSave;
      if (quickPhoneInput) {
        quickPhoneInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleQuickSave(); });
      }
      return;
    }

    const primaryContact = contacts[0];
    const alertMessage = buildEmergencyAlertMessage(primaryContact, originData, destinationData);

    const cleanDigits = primaryContact.phone.replace(/\D/g, '');
    const waDigits = cleanDigits.length === 10 ? '91' + cleanDigits : cleanDigits;
    const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(alertMessage)}`;
    const smsUrl = `sms:${cleanDigits}?body=${encodeURIComponent(alertMessage)}`;
    const telUrl = `tel:${cleanDigits}`;

    contactArea.innerHTML = `
      <div class="sos-contact-header">
        <div class="sos-contact-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--coral);"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
          <span>Alert your emergency contact</span>
        </div>
        <span id="sosAlertStatusBadge" class="sos-alert-badge ${alertDispatched ? 'dispatched' : 'pending'}">
          ${alertDispatched ? '✅ Alert Dispatched & Logged' : '⚡ Preparing alert…'}
        </span>
      </div>

      <div class="sos-contact-details">
        <div class="sos-contact-name-tag">
          <span>👤</span>
          <span>${escapeHtml(primaryContact.name)}</span>
          ${primaryContact.relationship ? `<span style="font-size:10.5px; color:var(--text-muted);">(${escapeHtml(primaryContact.relationship)})</span>` : ''}
        </div>
        <div class="sos-contact-phone-tag">
          📞 ${escapeHtml(primaryContact.phone)}
        </div>
      </div>

      <div class="sos-message-preview-box">${escapeHtml(alertMessage)}</div>

      <div class="sos-contact-actions">
        <a id="sosSendSmsLink" href="${smsUrl}" class="btn-sos-sms" title="Send SMS message directly">
          <span>📲 Send SMS (${escapeHtml(primaryContact.name)})</span>
        </a>
        <a id="sosSendWaLink" href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-sos-wa" title="Send WhatsApp alert">
          <span>💬 WhatsApp Alert</span>
        </a>
        <a href="${telUrl}" class="btn-sos-contact-call" title="Call directly">
          <span>📞 Call</span>
        </a>
        <button type="button" id="sosManageContactsBtn" class="btn-subtle" style="padding:6px 10px; font-size:11.5px; border-radius:var(--radius-sm);" title="Manage Emergency Contacts">
          ⚙️
        </button>
      </div>
    `;

    const manageBtn = contactArea.querySelector('#sosManageContactsBtn');
    if (manageBtn) {
      manageBtn.onclick = () => {
        showEmergencyContactsModal();
      };
    }

    // Automatically dispatch alert to backend service
    if (!alertDispatched && primaryContact.phone) {
      alertDispatched = true;
      fetch(`${API}/directory/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: primaryContact.name,
          contact_phone: primaryContact.phone,
          message: alertMessage,
          lat: originData ? originData.lat : null,
          lon: originData ? originData.lon : null,
          hospital_name: destinationData ? destinationData.name : null
        })
      })
      .then(res => res.json())
      .then(resData => {
        const badge = contactArea.querySelector('#sosAlertStatusBadge');
        if (badge) {
          badge.className = 'sos-alert-badge dispatched';
          badge.textContent = resData.sms_gateway_sent ? '✅ SMS Gateway Sent' : '✅ Alert Dispatched & Logged';
        }
      })
      .catch(() => {
        const badge = contactArea.querySelector('#sosAlertStatusBadge');
        if (badge) {
          badge.className = 'sos-alert-badge dispatched';
          badge.textContent = '✅ Alert ready. Tap Send below';
        }
      });
    }
  }

  // Initial render of contact card
  renderEmergencyContactCard();

  function getEmbedAndNavUrls() {
    if (!originData || !destinationData) return { embedUrl: '', navUrl: '' };

    const originParam = (originData.lat != null && originData.lon != null)
      ? `${originData.lat},${originData.lon}`
      : originData.label;

    const destParam = (destinationData.lat != null && destinationData.lon != null)
      ? `${destinationData.lat},${destinationData.lon}`
      : (destinationData.address ? `${destinationData.name}, ${destinationData.address}` : destinationData.name);

    const embedUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(originParam)}&daddr=${encodeURIComponent(destParam)}&dirflg=${currentDirFlg}&output=embed`;
    const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}&travelmode=${currentTravelMode}`;

    return { embedUrl, navUrl };
  }

  function renderMapRouteUI() {
    if (!originData || !destinationData) return;

    const { embedUrl, navUrl } = getEmbedAndNavUrls();
    const phone = destinationData.phone ? destinationData.phone.split(';')[0].trim() : null;
    const destMetaParts = [];
    if (destinationData.distance_km != null) destMetaParts.push(`${destinationData.distance_km} km away`);
    if (destinationData.address) destMetaParts.push(destinationData.address);
    const destMetaStr = destMetaParts.join(' · ') || 'Emergency Healthcare Facility';

    const originText = (originData.lat != null && originData.lon != null)
      ? `GPS: ${originData.lat.toFixed(4)}°, ${originData.lon.toFixed(4)}°`
      : escapeHtml(originData.label);

    let chipsHtml = '';
    if (nearbyHospitalsList && nearbyHospitalsList.length > 1) {
      chipsHtml = nearbyHospitalsList.map(h => {
        const isActive = (destinationData.id && h.id === destinationData.id) || (h.name === destinationData.name);
        return `
          <button type="button" class="sos-facility-chip ${isActive ? 'active' : ''}" data-hospital-id="${h.id || ''}" data-hospital-name="${escapeHtml(h.name)}">
            <span>🏥</span>
            <span>${escapeHtml(h.name)}</span>
            <span style="opacity:0.75; font-size:10.5px;">(${h.distance_km} km)</span>
          </button>
        `;
      }).join('');
    }

    contentArea.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div class="sos-route-summary">
          <div class="sos-route-point">
            <div class="sos-point-icon" style="color:#38bdf8;">📍</div>
            <div class="sos-point-content">
              <div class="sos-point-label">Your Current Location (Origin)</div>
              <div class="sos-point-val" id="sosOriginDisplay">${originText}</div>
              <div class="sos-point-meta" style="display:flex; align-items:center; gap:8px;">
                <span>Your live location</span>
                <button type="button" id="sosRefreshLocBtn" class="btn-subtle" style="padding:2px 7px; font-size:10.5px; border-radius:3px; cursor:pointer;">🔄 Refresh GPS</button>
              </div>
            </div>
          </div>

          <div style="border-top:1px dashed var(--border-subtle); margin:2px 0;"></div>

          <div class="sos-route-point">
            <div class="sos-point-icon" style="color:var(--coral);">🏥</div>
            <div class="sos-point-content">
              <div class="sos-point-label">Destination Facility</div>
              <div class="sos-point-val" id="sosDestName">${escapeHtml(destinationData.name)}</div>
              <div class="sos-point-meta" id="sosDestMeta">${escapeHtml(destMetaStr)}</div>
            </div>
          </div>
        </div>

        <!-- Travel Mode Selector -->
        <div class="sos-mode-selector">
          <button type="button" class="sos-mode-btn ${currentTravelMode === 'driving' ? 'active' : ''}" data-mode="driving" data-dir="d">
            <span>🚗</span> Drive (Fastest)
          </button>
          <button type="button" class="sos-mode-btn ${currentTravelMode === 'walking' ? 'active' : ''}" data-mode="walking" data-dir="w">
            <span>🚶</span> Walk
          </button>
          <button type="button" class="sos-mode-btn ${currentTravelMode === 'transit' ? 'active' : ''}" data-mode="transit" data-dir="r">
            <span>🚌</span> Transit
          </button>
        </div>

        <!-- Embedded Google Map -->
        <div class="sos-map-viewport">
          <iframe id="sosMapIframe" class="sos-map-iframe" src="${embedUrl}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="Google Map Directions"></iframe>
        </div>

        <!-- Action Buttons -->
        <div class="sos-actions-row">
          <a id="sosNavBtn" href="${navUrl}" target="_blank" rel="noopener noreferrer" class="btn-sos-navigate">
            <span>🗺️ Start Turn-by-Turn Navigation (${currentTravelMode.toUpperCase()})</span>
            <span style="font-size:11px; opacity:0.85;">↗</span>
          </a>
          ${phone ? `
            <a id="sosCallBtn" href="tel:${phone.replace(/\D/g, '')}" class="btn-sos-call">
              📞 Call ${escapeHtml(phone)}
            </a>
          ` : ''}
        </div>

        ${chipsHtml ? `
          <div class="sos-facilities-chips-container">
            <div class="sos-facilities-label">Other Nearby Facilities:</div>
            <div class="sos-facilities-chips">
              ${chipsHtml}
            </div>
          </div>
        ` : ''}

        <!-- Custom Destination Toggle & Input -->
        <div style="margin-top:2px;">
          <button type="button" id="sosCustomDestToggle" class="sos-custom-search-toggle">
            <span>🔍 Route to a specific hospital or address</span>
          </button>
          <div id="sosCustomInputBar" class="sos-custom-input-bar">
            <input id="sosCustomDestInput" placeholder="Enter hospital name or destination address..." style="flex:1; padding:7px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:12.5px;">
            <button type="button" id="sosCustomDestApplyBtn" class="btn-execute" style="padding:7px 14px; font-size:12px; white-space:nowrap;">Route</button>
          </div>
        </div>
      </div>
    `;

    bindMapControls();
    renderEmergencyContactCard();
  }

  function bindMapControls() {
    // Mode switcher
    contentArea.querySelectorAll('.sos-mode-btn').forEach(btn => {
      btn.onclick = () => {
        contentArea.querySelectorAll('.sos-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTravelMode = btn.dataset.mode;
        currentDirFlg = btn.dataset.dir;
        const { embedUrl, navUrl } = getEmbedAndNavUrls();
        const iframe = contentArea.querySelector('#sosMapIframe');
        const navBtn = contentArea.querySelector('#sosNavBtn');
        if (iframe) iframe.src = embedUrl;
        if (navBtn) {
          navBtn.href = navUrl;
          navBtn.innerHTML = `<span>🗺️ Start Turn-by-Turn Navigation (${currentTravelMode.toUpperCase()})</span> <span style="font-size:11px; opacity:0.85;">↗</span>`;
        }
      };
    });

    // Facility chip switcher
    contentArea.querySelectorAll('.sos-facility-chip').forEach(chip => {
      chip.onclick = () => {
        const hid = chip.dataset.hospitalId;
        const hname = chip.dataset.hospitalName;
        const match = nearbyHospitalsList.find(h => (hid && String(h.id) === hid) || h.name === hname);
        if (match) {
          destinationData = { ...match };
          renderMapRouteUI();
        }
      };
    });

    // Refresh GPS
    const refreshBtn = contentArea.querySelector('#sosRefreshLocBtn');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        try { localStorage.removeItem(LOCATION_CACHE_KEY); } catch (e) {}
        loadEmergencyLocation(true);
      };
    }

    // Custom destination input toggle & apply
    const customToggle = contentArea.querySelector('#sosCustomDestToggle');
    const customBar = contentArea.querySelector('#sosCustomInputBar');
    const customInput = contentArea.querySelector('#sosCustomDestInput');
    const customApply = contentArea.querySelector('#sosCustomDestApplyBtn');

    if (customToggle && customBar) {
      customToggle.onclick = () => {
        customBar.classList.toggle('open');
        if (customBar.classList.contains('open') && customInput) customInput.focus();
      };
    }

    const applyCustom = () => {
      const val = customInput ? customInput.value.trim() : '';
      if (!val) return;
      destinationData = {
        id: 'custom-' + Date.now(),
        name: val,
        lat: null,
        lon: null,
        address: 'Custom Emergency Destination',
        phone: null,
        distance_km: null
      };
      renderMapRouteUI();
    };

    if (customApply) customApply.onclick = applyCustom;
    if (customInput) {
      customInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyCustom();
      });
    }
  }

  function renderLocationFallbackUI(errorMsg) {
    contentArea.innerHTML = `
      <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:14px; font-size:12.5px; color:var(--text-secondary); display:flex; flex-direction:column; gap:10px;">
        <div style="font-weight:600; color:var(--coral); display:flex; align-items:center; gap:6px;">
          <span>⚠️</span> Can not find your location
        </div>
        <p style="margin:0; line-height:1.4;">
          ${escapeHtml(errorMsg || 'Unable to detect your exact GPS coordinates automatically.')} You can enter your current location to plot the Google Map directions, or open Google Maps directly:
        </p>
        <div style="display:flex; gap:8px;">
          <input id="sosManualOriginInput" placeholder="Enter your current city or area (e.g. Salt Lake, Kolkata)..." style="flex:1; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface-elevated); color:var(--text-primary); font-size:12.5px;">
          <button type="button" id="sosManualRouteBtn" class="btn-execute" style="padding:8px 14px; font-size:12px; white-space:nowrap;">Get Directions</button>
        </div>
        <div style="display:flex; gap:8px; margin-top:2px;">
          <a href="https://www.google.com/maps/search/nearest+emergency+hospital" target="_blank" rel="noopener noreferrer" class="btn-sos-navigate" style="flex:1;">
            <span>🗺️ Search Nearest Hospitals on Google Maps</span>
            <span style="font-size:11px; opacity:0.85;">↗</span>
          </a>
        </div>
      </div>
    `;

    const manualInput = contentArea.querySelector('#sosManualOriginInput');
    const manualBtn = contentArea.querySelector('#sosManualRouteBtn');
    const handleManual = () => {
      const area = manualInput ? manualInput.value.trim() : '';
      if (!area) return;
      originData = { lat: null, lon: null, label: area };
      destinationData = {
        name: 'Nearest Emergency Hospital',
        lat: null,
        lon: null,
        address: 'Resolving route via Google Maps',
        phone: null,
        distance_km: null
      };
      renderMapRouteUI();
    };
    if (manualBtn) manualBtn.onclick = handleManual;
    if (manualInput) {
      manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleManual();
      });
    }
    renderEmergencyContactCard();
  }

  function loadEmergencyLocation(forceFresh = false) {
    contentArea.innerHTML = `
      <div id="sosLocationLoading" style="display:flex; align-items:center; gap:10px; padding:16px 12px; background:var(--bg-subtle); border-radius:var(--radius-sm); border:1px solid var(--border-subtle); color:var(--text-secondary); font-size:12.5px;">
        <span style="display:inline-block; width:14px; height:14px; border-radius:50%; border:2px solid var(--coral); border-top-color:transparent; animation:spin 0.8s linear infinite; flex-shrink:0;"></span>
        <span>${forceFresh ? 'Updating your location…' : 'Finding your location and the nearest hospital…'}</span>
      </div>
    `;

    getCachedOrFreshLocation(forceFresh ? 0 : 2 * 60 * 1000)
      .then(async ({ lat, lon }) => {
        originData = { lat, lon, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };

        try {
          const res = await fetch(`${API}/directory/search?lat=${lat}&lon=${lon}&radius_km=25&limit=4`);
          const data = await res.json();
          if (data.doctors && data.doctors.length) {
            nearbyHospitalsList = data.doctors;
            destinationData = { ...nearbyHospitalsList[0] };
          } else {
            // No doctors in local DB radius -> Google Maps fallback
            nearbyHospitalsList = [];
            destinationData = {
              name: 'Nearest Emergency Hospital',
              lat: null,
              lon: null,
              address: 'Auto-resolved via Google Maps navigation',
              phone: null,
              distance_km: null
            };
          }
        } catch (e) {
          // Backend offline or error -> Google Maps still resolves route!
          nearbyHospitalsList = [];
          destinationData = {
            name: 'Nearest Emergency Hospital',
            lat: null,
            lon: null,
            address: 'Direct Google Maps Emergency Routing',
            phone: null,
            distance_km: null
          };
        }

        renderMapRouteUI();
      })
      .catch((err) => {
        renderLocationFallbackUI(err && err.message ? err.message : 'Location telemetry unavailable.');
      });
  }

  // Initial load
  loadEmergencyLocation(false);
}

// --- 16. CLINICAL DIRECTORY & LOCATION INTEGRATION ---

const INDIA_HEALTH_HELPLINES = [
  { name: "National Health Helpline", phone: "104" },
  { name: "Ambulance", phone: "108" },
  { name: "Ask your local ASHA worker or nearest PHC", phone: null },
];

function maybeShowNearbyHealthcare() {
  if (currentLabel !== 'medical') return;
  if (!feedEl) return;
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.innerHTML = '<div style="font-weight:600; margin-bottom:6px;">Need local clinic or medical facility listings?</div>';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;';

  const hereBtn = document.createElement('button');
  hereBtn.className = 'btn-subtle';
  hereBtn.textContent = '📍 Search Near Me';
  hereBtn.onclick = () => {
    btnRow.remove();
    searchNearbyByGeolocation();
  };

  const elsewhereBtn = document.createElement('button');
  elsewhereBtn.className = 'btn-subtle';
  elsewhereBtn.textContent = '🔍 Search by Area / City';
  elsewhereBtn.onclick = () => {
    btnRow.remove();
    showPlaceInput(div);
  };

  btnRow.appendChild(hereBtn);
  btnRow.appendChild(elsewhereBtn);
  div.appendChild(btnRow);
  feedEl.appendChild(div);
  scrollToBottom();
}

function searchNearbyByGeolocation() {
  setStatus('Searching OSM healthcare directory…');
  getCachedOrFreshLocation(10 * 60 * 1000) // reuse up to 10 min old - plenty fresh for "nearby doctors"
    .then(({ lat, lon }) => {
      setStatus('');
      fetchAndRenderNearby(lat, lon);
    })
    .catch(() => {
      setStatus('');
      renderNearbyCard([]);
    });
}

function showPlaceInput(parentDiv) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:8px; margin-top:8px;';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'e.g. Park Street, Kolkata';
  input.style.cssText = 'flex:1; padding:7px 10px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;';

  const goBtn = document.createElement('button');
  goBtn.className = 'btn-execute';
  goBtn.textContent = 'Search';
  goBtn.onclick = async () => {
    const place = input.value.trim();
    if (!place) return;
    row.remove();
    setStatus('Looking up area coordinates…');
    try {
      const res = await fetch(`${API}/directory/geocode?place=${encodeURIComponent(place)}`);
      const data = await res.json();
      setStatus('');
      if (!data.found) {
        renderNearbyCard([]);
        return;
      }
      await fetchAndRenderNearby(data.lat, data.lon);
    } catch (e) {
      setStatus('Area resolution error.', true);
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') goBtn.click(); });
  row.appendChild(input);
  row.appendChild(goBtn);
  parentDiv.appendChild(row);
}

async function fetchAndRenderNearby(lat, lon) {
  try {
    const res = await fetch(`${API}/directory/search?lat=${lat}&lon=${lon}&radius_km=10`);
    const data = await res.json();
    renderNearbyCard(data.doctors || []);
  } catch (e) {
    renderNearbyCard([]);
  }
}

function renderNearbyCard(doctors) {
  if (!feedEl) return;
  const div = document.createElement('div');
  div.className = 'msg assistant';

  let html = '<div style="font-weight:600; margin-bottom:6px;">Nearby clinics and hospitals</div>';
  if (doctors.length) {
    html += '<div style="display:flex; flex-direction:column; gap:8px; margin-top:6px;">';
    doctors.forEach(d => {
      html += `
        <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); padding:10px 12px; border-radius:4px; font-size:13px;">
          <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(d.name)}</div>
          <div style="color:var(--text-muted); font-size:12px;">${escapeHtml(d.specialty)} ${d.distance_km ? `· ${d.distance_km} km away` : ''}</div>
          ${d.address ? `<div style="color:var(--text-secondary); font-size:11.5px; margin-top:2px;">${escapeHtml(d.address)}</div>` : ''}
          <div style="display:flex; gap:12px; margin-top:8px; align-items:center; flex-wrap:wrap;">
            ${d.phone ? `<a href="tel:${escapeHtml(d.phone.replace(/\D/g, ''))}" style="color:var(--teal); font-weight:600; text-decoration:none;">📞 Call ${escapeHtml(d.phone)}</a>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((d.lat != null && d.lon != null) ? `${d.lat},${d.lon}` : d.name)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-purple); font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-size:12px;">
              <span>🗺️ Google Maps Directions</span>
            </a>
          </div>
        </div>
      `;
    });
    html += '</div>';
  } else {
    html += '<p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">No listed facilities found nearby. Please contact helpline services:</p>';
    INDIA_HEALTH_HELPLINES.forEach(h => {
      html += `<div style="font-size:12.5px; margin-bottom:4px;">${escapeHtml(h.name)}: <b>${h.phone ? `<a href="tel:${h.phone}">${h.phone}</a>` : 'Contact local clinic'}</b></div>`;
    });
  }

  div.innerHTML = html;
  feedEl.appendChild(div);
  scrollToBottom();
}

// --- 17. GLOBAL SHORTCUTS & ESCAPE LISTENER ---
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    if (newChatBtn) newChatBtn.click();
    return;
  }
  if (e.key === 'Escape') {
    const dynamicModals = document.querySelectorAll('.settings-modal.active');
    if (dynamicModals.length > 0) {
      dynamicModals.forEach(m => {
        if (m === ipSettingsModal) m.classList.remove('active');
        else m.remove();
      });
      return;
    }
    if (camMenu && camMenu.classList.contains('open')) camMenu.classList.remove('open');
    else if (badgesModal && badgesModal.classList.contains('active')) badgesModal.classList.remove('active');
    else if (ipSettingsModal && ipSettingsModal.classList.contains('active')) ipSettingsModal.classList.remove('active');
    else if (snapOverlay && snapOverlay.classList.contains('active')) stopSnapCapture();
    else if (liveCamOverlay && liveCamOverlay.classList.contains('active')) stopLiveCam();
    else if (sidebarEl && sidebarEl.classList.contains('open')) toggleSidebar(false);
  }
});
// ---- EXPLORE MORE: links + images under the answer ----
// Paste at the bottom of app.js. Called from sendMessage (see step 3 in the guide).

function isSafeUrl(u) { return typeof u === 'string' && /^https?:\/\//i.test(u); }

async function attachResources(goal, bubble) {
  if (!goal || !goal.trim()) return;
  try {
    const res = await fetch(`${API}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: goal }),
    });
    if (!res.ok) return;                       // silent: resources are a bonus, never an error
    const data = await res.json();
    const links = (data.links || []).filter(l => isSafeUrl(l.url));
    const images = (data.images || []).filter(i => isSafeUrl(i.src));
    if (!links.length && !images.length) return;

    const card = document.createElement('div');
    card.className = 'explore-card';

    const head = document.createElement('div');
    head.className = 'explore-head';
    head.textContent = 'EXPLORE MORE';
    card.appendChild(head);

    if (images.length) {
      const strip = document.createElement('div');
      strip.className = 'explore-images';
      images.forEach(img => {
        const a = document.createElement('a');
        a.href = isSafeUrl(img.link) ? img.link : img.src;
        a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.title = img.caption || '';
        const el = document.createElement('img');
        el.src = img.src; el.alt = img.caption || 'related image';
        el.loading = 'lazy'; el.referrerPolicy = 'no-referrer';
        el.onerror = () => a.remove();          // hide broken images
        a.appendChild(el);
        strip.appendChild(a);
      });
      card.appendChild(strip);
    }

    links.forEach(l => {
      const a = document.createElement('a');
      a.className = 'explore-link';
      a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const t = document.createElement('div');
      t.className = 'explore-link-title'; t.textContent = l.title || l.url;
      const s = document.createElement('div');
      s.className = 'explore-link-snippet';
      let host = ''; try { host = new URL(l.url).hostname.replace('www.', ''); } catch (e) {}
      s.textContent = (host ? host + ' - ' : '') + (l.snippet || '');
      a.appendChild(t); a.appendChild(s);
      card.appendChild(a);
    });

    (bubble || feedEl).appendChild(card);
    scrollToBottom();
    snapshotCurrentSession();   // saves the card too, so it survives switching chats or reloading
  } catch (e) {
    console.warn('resources skipped:', e);
  }
}

// ---- MULTILINGUAL VOICE: English / Hindi / Bengali ----
// Paste at the very bottom of app.js. Needs the 4 one-line edits in INTEGRATION.md.
// Replies, speech-to-text AND read-aloud all follow the language picked in the little dropdown by the mic.

const LANGS = {
  en: { label: 'English', bcp: 'en-US', whisper: 'en' },
  hi: { label: 'हिन्दी',   bcp: 'hi-IN', whisper: 'hi' },
  bn: { label: 'বাংলা',    bcp: 'bn-IN', whisper: 'bn' },
};
const LANG_KEY = 'companion_lang';

function currentLangCode() {
  let c = 'en';
  try { c = localStorage.getItem(LANG_KEY) || 'en'; } catch (e) {}
  return LANGS[c] ? c : 'en';
}
// used when the server tells us which language was really spoken
function setLangCode(code) {
  if (!LANGS[code]) return;
  try { localStorage.setItem(LANG_KEY, code); } catch (e) {}
  const sel = document.getElementById('langPicker'); if (sel) sel.value = code;
}
function currentLang() { const code = currentLangCode(); return { code, ...LANGS[code] }; }

// The language picker (injected, so index.html needs no change)
(function addLangPicker() {
  if (!micBtn || document.getElementById('langPicker')) return;
  const st = document.createElement('style');
  st.textContent = `.lang-picker{background:var(--bg-subtle,rgba(128,128,128,.12));color:var(--text-primary,inherit);
    border:1px solid var(--border-subtle,rgba(128,128,128,.3));border-radius:8px;padding:4px 6px;font-size:12px;
    cursor:pointer;margin-right:4px;max-width:92px;color-scheme:dark}
    [data-theme="light"] .lang-picker{color-scheme:light}
    .lang-picker option{background:#181d2e;color:#f8fafc}
    [data-theme="light"] .lang-picker option{background:#ffffff;color:#0f172a}`;
  document.head.appendChild(st);
  const sel = document.createElement('select');
  sel.id = 'langPicker'; sel.className = 'lang-picker';
  sel.title = 'Voice and reply language'; sel.setAttribute('aria-label', 'Language');
  Object.entries(LANGS).forEach(([code, l]) => {
    const o = document.createElement('option'); o.value = code; o.textContent = l.label; sel.appendChild(o);
  });
  sel.value = currentLangCode();
  sel.onchange = () => { try { localStorage.setItem(LANG_KEY, sel.value); } catch (e) {} };
  micBtn.parentNode.insertBefore(sel, micBtn);
})();

// ---- Read aloud: pick the voice from the SCRIPT of the text itself ----
function detectScript(text) {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  if (/[ঀ-৿]/.test(text)) return 'bn';
  return 'en';
}

function voiceFor(code) {
  if (code === 'en') return pickFemaleVoice();
  const list = cachedVoices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(code));
  return list.find(v => /female|google|natural|neural/i.test(v.name)) || list[0] || null;
}

let _serverAudio = null;
function stopServerAudio() {
  if (_serverAudio) { try { _serverAudio.pause(); } catch (e) {} _serverAudio = null; }
}
// the app already calls speechSynthesis.cancel() when you stop/close - make that stop server audio too
if (window.speechSynthesis) {
  const _cancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);
  window.speechSynthesis.cancel = () => { stopServerAudio(); _cancel(); };
}

async function serverSpeak(text, code) {
  try {
    const res = await fetch(`${API}/tts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 600), lang: code }),
    });
    if (!res.ok) throw new Error('tts');
    const url = URL.createObjectURL(await res.blob());
    _serverAudio = new Audio(url);
    _serverAudio.onended = () => URL.revokeObjectURL(url);
    await _serverAudio.play();
  } catch (e) {
    setStatus(`No ${LANGS[code].label} voice is available on this device.`, true);
  }
}

// Same name as the old function on purpose: this later declaration replaces it everywhere it is called.
function speak(text) {
  if (!text || !text.trim()) return;
  const code = detectScript(text);
  if (window.speechSynthesis) window.speechSynthesis.cancel(); else stopServerAudio();
  const voice = window.speechSynthesis ? voiceFor(code) : null;
  if (code !== 'en' && !voice) { serverSpeak(text, code); return; }   // no local Hindi/Bengali voice -> server fallback
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0;
  if (voice) { utter.voice = voice; utter.lang = voice.lang; } else { utter.lang = LANGS[code].bcp; }
  window.speechSynthesis.speak(utter);
}

// ---- HEALTH LOG v2: easier to use, reads prescriptions, makes a PDF for the doctor ----
// Paste at the very bottom of app.js. It takes over the "Health Log" button (the old panel is simply not opened any more).
// Everything is saved in this browser only. Old entries are kept: same keys, same format.

const HL = {
  vitals:  'companion_health_log',     // BP, glucose, symptoms, other (same format as before)
  meds:    'companion_medicines',      // same key the old medicines section used
  conds:   'companion_conditions',
  profile: 'companion_profile',        // name, age, allergies (only used in the PDF)
  notes:   'companion_doctor_notes',   // "things to tell my doctor"
};
const HL_PDF_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

function hlGet(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; }
  catch (e) { return fallback; }
}
function hlSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
function hlEsc(s) { return escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function hlDate(iso, withTime) {
  const d = new Date(iso); if (isNaN(d)) return '';
  const o = { day: '2-digit', month: 'short', year: 'numeric' };
  if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
  return d.toLocaleString('en-IN', o);
}
function hlMeds() {   // also understands the older {name, dosage, time} items
  return hlGet(HL.meds, []).map(m => ({
    ...m, dose: m.dose ?? m.dosage ?? '', frequency: m.frequency ?? m.time ?? '',
    duration: m.duration ?? '', notes: m.notes ?? '', active: m.active !== false,
  }));
}

// "1-0-1" -> "Morning, Night"
function hlFriendlyFreq(f) {
  const m = String(f || '').trim().match(/^(\d)\s*[-–]\s*(\d)\s*[-–]\s*(\d)(?:\s*[-–]\s*(\d))?$/);
  if (!m) return '';
  const names = m[4] !== undefined ? ['Morning', 'Afternoon', 'Evening', 'Night'] : ['Morning', 'Afternoon', 'Night'];
  const out = names.filter((_, i) => Number(m[i + 1]) > 0);
  return out.join(', ');
}

// What the assistant may see in MEDICAL chats only: conditions, current medicine names, last 5 readings.
// Same name as the old function on purpose, so the existing call in sendMessage keeps working.
function recentHealthLogSummary() {
  const bits = [];
  const c = hlGet(HL.conds, []).slice(0, 6).map(x => x.name);
  if (c.length) bits.push('Conditions: ' + c.join(', '));
  const m = hlMeds().filter(x => x.active).slice(0, 8).map(x => x.name + (x.dose ? ' ' + x.dose : ''));
  if (m.length) bits.push('Medicines: ' + m.join(', '));
  const v = hlGet(HL.vitals, []).slice(0, 5).map(e => `${e.type} ${e.value}${e.note ? ' (' + e.note + ')' : ''} on ${hlDate(e.timestamp)}`);
  if (v.length) bits.push('Recent readings: ' + v.join('; '));
  return bits.join('. ');
}

// ---------- vitals helpers ----------
const HL_IS_BP = t => /^(bp|blood\s*pressure)/i.test(t || '');
const HL_IS_SUGAR = t => /(glucose|sugar)/i.test(t || '');
const HL_IS_SYMPTOM = t => /^symptom/i.test(t || '');

function hlAddVital(type, value, note) {
  const list = hlGet(HL.vitals, []);
  list.unshift({ id: Date.now(), type, value: String(value), note: note || '', timestamp: new Date().toISOString() });
  hlSet(HL.vitals, list);
}
function hlDescribe(e) {
  if (HL_IS_BP(e.type)) return { icon: '🩺', main: `BP ${e.value} mmHg`, sub: e.note };
  if (HL_IS_SUGAR(e.type)) return { icon: '🩸', main: `Sugar ${e.value} mg/dL`, sub: e.note };
  if (HL_IS_SYMPTOM(e.type)) return { icon: '🤒', main: e.value, sub: e.note };
  return { icon: '📏', main: `${e.type}: ${e.value}`, sub: e.note };
}

// ---------- one-time CSS ----------
(function hlInjectStyles() {
  const st = document.createElement('style');
  st.textContent = `
  .hl2-box{max-width:560px;width:100%}
  .hl2-body{max-height:62vh;overflow-y:auto;padding:2px 2px 6px}
  .hl2-tabs{display:flex;gap:6px;margin:12px 0;flex-wrap:wrap}
  .hl2-tab{flex:1;min-width:92px;padding:10px 8px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;
    color:var(--text-secondary);font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit}
  .hl2-tab.on{background:var(--accent-purple-subtle,rgba(124,92,255,.14));color:var(--accent-purple,#7c5cff);border-color:var(--accent-purple,#7c5cff)}
  .hl2-upload{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;cursor:pointer;
    border:1.5px dashed var(--accent-purple,#7c5cff);background:var(--accent-purple-subtle,rgba(124,92,255,.08));color:var(--text-primary);font-size:14px;font-weight:600}
  .hl2-upload small{display:block;font-weight:400;color:var(--text-secondary);font-size:12px;margin-top:2px}
  .hl2-card{border:1px solid var(--border-subtle);background:var(--bg-subtle);border-radius:12px;padding:12px;margin-bottom:10px}
  .hl2-card-title{font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:8px}
  .hl2-row{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
  .hl2-row>*{flex:1;min-width:110px}
  .hl2-row>.hl2-slash{flex:0 0 auto;min-width:0;color:var(--text-muted);font-size:18px}
  .hl2-box input,.hl2-box select,.hl2-box textarea{padding:10px 11px;border-radius:8px;border:1px solid var(--border-subtle);
    background:var(--bg-surface-elevated,var(--bg-subtle));color:var(--text-primary);font-size:14px;font-family:inherit;width:100%;box-sizing:border-box}
  .hl2-box textarea{min-height:84px;resize:vertical}
  .hl2-btn{padding:10px 14px;border-radius:8px;border:none;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;
    background:var(--accent-purple,#7c5cff);color:#fff;flex:0 0 auto;min-width:0}
  .hl2-btn.ghost{background:transparent;color:var(--text-secondary);border:1px solid var(--border-subtle);font-weight:600}
  .hl2-btn.small{padding:5px 9px;font-size:12px}
  .hl2-btn.danger{color:var(--coral,#f43f5e)}
  .hl2-btn.wide{width:100%}
  .hl2-sub{font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--text-muted);margin:14px 0 6px}
  .hl2-item{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:10px 12px;border:1px solid var(--border-subtle);
    border-radius:10px;background:var(--bg-subtle);margin-bottom:6px;font-size:13.5px;color:var(--text-primary)}
  .hl2-item .meta{color:var(--text-secondary);font-size:12px;margin-top:2px}
  .hl2-item.stopped{opacity:.6}
  .hl2-tag{display:inline-block;font-size:10.5px;padding:1px 6px;border-radius:6px;border:1px solid var(--border-subtle);color:var(--text-muted);margin-left:6px}
  .hl2-err{color:var(--coral,#f43f5e);font-size:12.5px;min-height:16px;margin:2px 0 6px}
  .hl2-ok{color:var(--accent-mint,#10b981);font-size:12.5px}
  .hl2-hint{font-size:12px;color:var(--text-secondary);margin:0 0 10px}
  .hl2-more summary{cursor:pointer;color:var(--text-secondary);font-size:13px;margin:4px 0 8px}
  .hl2-check{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start;padding:10px;border:1px solid var(--border-subtle);border-radius:10px;margin-bottom:8px;background:var(--bg-subtle)}
  .hl2-check input[type=checkbox]{width:20px;height:20px;margin-top:8px}
  .hl2-check .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .hl2-check .grid .full{grid-column:1/-1}
  `;
  document.head.appendChild(st);
})();

// ---------- the panel ----------
function hlOpenPanel() {
  if (typeof toggleSidebar === 'function') toggleSidebar(false);
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  const box = document.createElement('div');
  box.className = 'settings-box hl2-box';
  overlay.appendChild(box); document.body.appendChild(overlay);

  let tab = 'today';
  const TABS = [['today', '📝 Today'], ['conds', '🩺 Conditions'], ['meds', '💊 Medicines'], ['report', '📄 Doctor report']];
  const close = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) close(); };

  function shell() {
    box.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-title-group">
          <div class="dialog-badge">PRIVATE · SAVED ONLY ON THIS DEVICE</div>
          <div class="dialog-title">My Health Log</div>
        </div>
        <button type="button" class="dialog-close-btn" id="hlClose" aria-label="Close">✕</button>
      </div>
      <label class="hl2-upload" style="margin-top:12px">
        <span style="font-size:24px">📷</span>
        <span id="hlUpText">Add from a prescription
          <small>Take a photo or pick a file. I'll find the medicines and conditions for you to check.</small></span>
        <input type="file" id="hlFile" accept="image/*,application/pdf" hidden>
      </label>
      <div class="hl2-hint" style="margin:6px 0 0">The photo is sent to the AI only to read it. Nothing is saved on our server. Only your conditions, medicine names and last few readings are shared, and only when you chat about health.</div>
      <div class="hl2-err" id="hlUpErr"></div>
      <div class="hl2-tabs">${TABS.map(([k, l]) => `<button type="button" class="hl2-tab ${k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="hl2-body" id="hlBody"></div>`;
    box.querySelector('#hlClose').onclick = close;
    box.querySelectorAll('.hl2-tab').forEach(b => b.onclick = () => { tab = b.dataset.tab; shell(); });
    box.querySelector('#hlFile').onchange = ev => {
      const f = ev.target.files[0]; if (f) hlUploadPrescription(f, box, shell);
    };
    const body = box.querySelector('#hlBody');
    ({ today: hlTabToday, conds: hlTabConds, meds: hlTabMeds, report: hlTabReport })[tab](body, () => { const y = body.scrollTop; shell(); box.querySelector('#hlBody').scrollTop = y; });
  }
  shell();
}

// the old Health Log button -> new panel (cloning removes the old click handler without editing old code)
(function hlRebindButton() {
  const old = document.getElementById('healthLogBtn');
  if (!old) return;
  const fresh = old.cloneNode(true);
  old.replaceWith(fresh);
  fresh.addEventListener('click', hlOpenPanel);
})();

// ---------- tab: today ----------
function hlTabToday(body, refresh) {
  body.innerHTML = `
    <div class="hl2-err" id="hlErr"></div>
    <div class="hl2-card"><div class="hl2-card-title">🩺 Blood pressure</div>
      <div class="hl2-row">
        <input id="bpSys" type="number" inputmode="numeric" placeholder="Upper (e.g. 120)" aria-label="Upper BP number">
        <span class="hl2-slash">/</span>
        <input id="bpDia" type="number" inputmode="numeric" placeholder="Lower (e.g. 80)" aria-label="Lower BP number">
        <button class="hl2-btn" id="bpSave" type="button">Save</button></div></div>
    <div class="hl2-card"><div class="hl2-card-title">🩸 Blood sugar</div>
      <div class="hl2-row">
        <input id="sgVal" type="number" inputmode="decimal" placeholder="mg/dL (e.g. 110)" aria-label="Blood sugar">
        <select id="sgCtx" aria-label="When"><option>Fasting</option><option>After meal</option><option>Before meal</option><option>Bedtime</option><option>Random</option></select>
        <button class="hl2-btn" id="sgSave" type="button">Save</button></div></div>
    <div class="hl2-card"><div class="hl2-card-title">🤒 How am I feeling?</div>
      <div class="hl2-row">
        <input id="syTxt" placeholder="e.g. headache, dizziness" aria-label="Symptom">
        <select id="sySev" aria-label="How bad"><option>Mild</option><option>Moderate</option><option>Severe</option></select>
        <button class="hl2-btn" id="sySave" type="button">Save</button></div></div>
    <details class="hl2-more"><summary>Something else (temperature, weight, SpO₂…)</summary>
      <div class="hl2-row"><input id="otName" placeholder="What (e.g. Weight)"><input id="otVal" placeholder="Value (e.g. 62 kg)">
        <button class="hl2-btn" id="otSave" type="button">Save</button></div></details>
    <div class="hl2-sub">RECENT ENTRIES</div><div id="hlRecent"></div>`;

  const err = m => { body.querySelector('#hlErr').textContent = m || ''; };
  const num = id => parseFloat(body.querySelector(id).value);
  const done = () => { hlToast('Saved ✓'); refresh(); };

  body.querySelector('#bpSave').onclick = () => {
    const s = num('#bpSys'), d = num('#bpDia');
    if (!(s >= 50 && s <= 260 && d >= 30 && d <= 160 && s > d)) return err('Please check the two BP numbers. The upper one should be bigger than the lower one.');
    hlAddVital('BP', `${Math.round(s)}/${Math.round(d)}`, ''); done();
  };
  body.querySelector('#sgSave').onclick = () => {
    const v = num('#sgVal');
    if (!(v >= 20 && v <= 700)) return err('Please check the sugar number (in mg/dL).');
    hlAddVital('Glucose', v, body.querySelector('#sgCtx').value); done();
  };
  body.querySelector('#sySave').onclick = () => {
    const t = body.querySelector('#syTxt').value.trim();
    if (!t) return err('Please write how you are feeling.');
    hlAddVital('Symptom', t, body.querySelector('#sySev').value); done();
  };
  body.querySelector('#otSave').onclick = () => {
    const n = body.querySelector('#otName').value.trim(), v = body.querySelector('#otVal').value.trim();
    if (!n || !v) return err('Please fill in both boxes.');
    hlAddVital(n, v, ''); done();
  };

  const list = hlGet(HL.vitals, []).slice(0, 15);
  body.querySelector('#hlRecent').innerHTML = list.length ? list.map(e => {
    const d = hlDescribe(e);
    return `<div class="hl2-item"><div>${d.icon} <b>${hlEsc(d.main)}</b>${d.sub ? ` <span class="hl2-tag">${hlEsc(d.sub)}</span>` : ''}
      <div class="meta">${hlDate(e.timestamp, true)}</div></div>
      <button type="button" class="hl2-btn ghost small danger" data-del="${e.id}" aria-label="Delete entry">✕</button></div>`;
  }).join('') : '<div class="hl2-hint">Nothing here yet. Add your first reading above.</div>';
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    hlSet(HL.vitals, hlGet(HL.vitals, []).filter(e => String(e.id) !== b.dataset.del)); refresh();
  });
}

function hlToast(msg) {   // small pill at the bottom of the screen (the normal status bar is hidden behind the panel)
  const t = document.createElement('div'); t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#10b981;color:#fff;padding:10px 18px;border-radius:999px;font-size:14px;font-weight:600;z-index:2000;box-shadow:0 4px 16px rgba(0,0,0,.3)';
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}

// ---------- tab: conditions ----------
function hlTabConds(body, refresh) {
  const list = hlGet(HL.conds, []);
  body.innerHTML = `
    <p class="hl2-hint">Health problems you live with (for example migraine, high BP, diabetes). They go into the report for your doctor.</p>
    <div class="hl2-card"><div class="hl2-row">
      <input id="cdName" placeholder="Condition (e.g. Migraine)"><input id="cdNote" placeholder="Note (optional, e.g. since 2019)">
      <button class="hl2-btn" id="cdSave" type="button">Add</button></div><div class="hl2-err" id="cdErr"></div></div>
    <div class="hl2-sub">MY CONDITIONS</div>
    ${list.length ? list.map(c => `<div class="hl2-item"><div><b>${hlEsc(c.name)}</b>
      ${c.source === 'prescription' ? '<span class="hl2-tag">📄 from prescription</span>' : ''}
      ${c.note ? `<div class="meta">${hlEsc(c.note)}</div>` : ''}</div>
      <button type="button" class="hl2-btn ghost small danger" data-del="${c.id}" aria-label="Delete">✕</button></div>`).join('')
      : '<div class="hl2-hint">No conditions yet. Add one above, or upload a prescription.</div>'}`;
  body.querySelector('#cdSave').onclick = () => {
    const name = body.querySelector('#cdName').value.trim();
    if (!name) { body.querySelector('#cdErr').textContent = 'Please type the condition name.'; return; }
    if (list.some(c => c.name.toLowerCase() === name.toLowerCase())) { body.querySelector('#cdErr').textContent = 'That one is already in your list.'; return; }
    list.unshift({ id: Date.now(), name, note: body.querySelector('#cdNote').value.trim(), source: 'me', addedAt: new Date().toISOString() });
    hlSet(HL.conds, list); refresh();
  };
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (confirm('Remove this condition?')) { hlSet(HL.conds, list.filter(c => String(c.id) !== b.dataset.del)); refresh(); }
  });
}

// ---------- tab: medicines ----------
function hlTabMeds(body, refresh) {
  const meds = hlMeds();
  const card = m => {
    const fr = hlFriendlyFreq(m.frequency);
    const line = [m.dose, m.frequency ? m.frequency + (fr ? ` (${fr})` : '') : '', m.duration].filter(Boolean).join(' · ');
    return `<div class="hl2-item ${m.active ? '' : 'stopped'}"><div><b>${hlEsc(m.name)}</b>
      ${m.source === 'prescription' ? '<span class="hl2-tag">📄 prescription</span>' : ''}
      ${line ? `<div class="meta">${hlEsc(line)}</div>` : ''}${m.notes ? `<div class="meta">${hlEsc(m.notes)}</div>` : ''}</div>
      <div style="display:flex;gap:6px;flex:0 0 auto">
        <button type="button" class="hl2-btn ghost small" data-toggle="${m.id}">${m.active ? 'Stop' : 'Restart'}</button>
        <button type="button" class="hl2-btn ghost small danger" data-del="${m.id}" aria-label="Delete">✕</button></div></div>`;
  };
  const active = meds.filter(m => m.active), stopped = meds.filter(m => !m.active);
  body.innerHTML = `
    <div class="hl2-card"><div class="hl2-card-title">➕ Add a medicine</div>
      <div class="hl2-row"><input id="mdName" placeholder="Medicine name"></div>
      <div class="hl2-row"><input id="mdDose" placeholder="Dose (e.g. 500 mg)">
        <input id="mdFreq" list="hl2freq" placeholder="How often (e.g. 1-0-1)"></div>
      <div class="hl2-row"><input id="mdDur" placeholder="For how long (e.g. 5 days)"><input id="mdNote" placeholder="Note (e.g. after food)"></div>
      <datalist id="hl2freq"><option value="Once a day, morning"><option value="Once a day, night"><option value="Twice a day"><option value="Three times a day"><option value="1-0-1"><option value="1-1-1"><option value="0-0-1"><option value="1-0-0"><option value="Only when needed"></datalist>
      <div class="hl2-err" id="mdErr"></div>
      <button class="hl2-btn wide" id="mdSave" type="button">Save medicine</button></div>
    <div class="hl2-sub">TAKING NOW (${active.length})</div>
    ${active.length ? active.map(card).join('') : '<div class="hl2-hint">No medicines yet. Add one above, or upload a prescription.</div>'}
    ${stopped.length ? `<div class="hl2-sub">STOPPED / PAST (${stopped.length})</div>${stopped.map(card).join('')}` : ''}`;
  body.querySelector('#mdSave').onclick = () => {
    const name = body.querySelector('#mdName').value.trim();
    if (!name) { body.querySelector('#mdErr').textContent = 'Please type the medicine name.'; return; }
    meds.unshift({ id: Date.now(), name, dose: body.querySelector('#mdDose').value.trim(), frequency: body.querySelector('#mdFreq').value.trim(),
      duration: body.querySelector('#mdDur').value.trim(), notes: body.querySelector('#mdNote').value.trim(), active: true, source: 'me', addedAt: new Date().toISOString() });
    hlSet(HL.meds, meds); refresh();
  };
  body.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
    const m = meds.find(x => String(x.id) === b.dataset.toggle); if (m) { m.active = !m.active; hlSet(HL.meds, meds); refresh(); }
  });
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (confirm('Delete this medicine?')) { hlSet(HL.meds, meds.filter(m => String(m.id) !== b.dataset.del)); refresh(); }
  });
}

// ---------- prescription upload + review ----------
async function hlUploadPrescription(file, box, refresh) {
  const errEl = box.querySelector('#hlUpErr'), txt = box.querySelector('#hlUpText');
  errEl.textContent = '';
  txt.innerHTML = 'Reading your prescription… <small>This can take 10–20 seconds.</small>';
  try {
    const fd = new FormData(); fd.append('file', file, file.name);
    const res = await fetch(`${API}/extract-prescription`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('server');
    const data = await res.json();
    if (!data.ok) { errEl.textContent = data.message || 'I could not read that.'; refresh(); return; }
    hlReviewPrescription(data, refresh);
  } catch (e) {
    errEl.textContent = 'Could not reach the server. Check your connection and try again.';
    refresh();
  }
}

function hlReviewPrescription(data, refresh) {
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active'; overlay.style.zIndex = '1001';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  const box = document.createElement('div'); box.className = 'settings-box hl2-box';
  overlay.appendChild(box); document.body.appendChild(overlay);

  box.innerHTML = `
    <div class="dialog-header"><div class="dialog-title-group"><div class="dialog-badge">CHECK BEFORE SAVING</div>
      <div class="dialog-title">Here's what I found</div></div></div>
    <p class="hl2-hint" style="margin-top:10px">Compare with your prescription. I can make mistakes with handwriting. Untick anything wrong and fix any spelling.
      ${data.doctor || data.date ? `<br>${hlEsc([data.doctor, data.date].filter(Boolean).join(' · '))}` : ''}</p>
    <div class="hl2-body" id="rvBody">
      ${data.conditions.length ? '<div class="hl2-sub">CONDITIONS WRITTEN ON IT</div>' : ''}
      ${data.conditions.map((c, i) => `<div class="hl2-check"><input type="checkbox" checked data-cond="${i}" aria-label="Keep">
        <input value="${hlEsc(c)}" data-cname="${i}"></div>`).join('')}
      ${data.medicines.length ? '<div class="hl2-sub">MEDICINES</div>' : ''}
      ${data.medicines.map((m, i) => `<div class="hl2-check"><input type="checkbox" checked data-med="${i}" aria-label="Keep">
        <div class="grid"><input class="full" value="${hlEsc(m.name)}" data-f="name" data-i="${i}" placeholder="Name">
          <input value="${hlEsc(m.dose)}" data-f="dose" data-i="${i}" placeholder="Dose">
          <input value="${hlEsc(m.frequency)}" data-f="frequency" data-i="${i}" placeholder="How often">
          <input value="${hlEsc(m.duration)}" data-f="duration" data-i="${i}" placeholder="For how long">
          <input value="${hlEsc(m.notes)}" data-f="notes" data-i="${i}" placeholder="Note"></div></div>`).join('')}
    </div>
    <div class="hl2-row" style="margin-top:12px"><button class="hl2-btn ghost" id="rvCancel" type="button">Cancel</button>
      <button class="hl2-btn" id="rvSave" type="button">Save to my Health Log</button></div>`;

  box.querySelector('#rvCancel').onclick = () => overlay.remove();
  box.querySelector('#rvSave').onclick = () => {
    const now = new Date().toISOString();
    const conds = hlGet(HL.conds, []), meds = hlMeds();
    let addedC = 0, addedM = 0;
    box.querySelectorAll('[data-cond]').forEach(cb => {
      if (!cb.checked) return;
      const name = box.querySelector(`[data-cname="${cb.dataset.cond}"]`).value.trim();
      if (name && !conds.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        conds.unshift({ id: Date.now() + addedC, name, note: data.date ? `Prescription ${data.date}` : '', source: 'prescription', addedAt: now }); addedC++;
      }
    });
    box.querySelectorAll('[data-med]').forEach(cb => {
      if (!cb.checked) return;
      const i = cb.dataset.med, get = f => box.querySelector(`[data-f="${f}"][data-i="${i}"]`).value.trim();
      const name = get('name'), dose = get('dose');
      if (!name || meds.some(m => m.name.toLowerCase() === name.toLowerCase() && (m.dose || '').toLowerCase() === dose.toLowerCase())) return;
      meds.unshift({ id: Date.now() + 100 + addedM, name, dose, frequency: get('frequency'), duration: get('duration'), notes: get('notes'),
        active: true, source: 'prescription', doctor: data.doctor || '', prescribed: data.date || '', addedAt: now }); addedM++;
    });
    hlSet(HL.conds, conds); hlSet(HL.meds, meds);
    overlay.remove();
    hlToast(`Saved ${addedM} medicine${addedM === 1 ? '' : 's'} and ${addedC} condition${addedC === 1 ? '' : 's'} ✓`);
    refresh();
  };
}

// ---------- tab: doctor report ----------
function hlTabReport(body) {
  const prof = hlGet(HL.profile, { name: '', age: '', allergies: '' });
  const notes = hlGet(HL.notes, '');
  let range = Number(hlGet('companion_report_range', 90));
  body.innerHTML = `
    <p class="hl2-hint">One tap makes a PDF with everything you logged. Show it or send it to your doctor so nothing is forgotten.</p>
    <div class="hl2-card"><div class="hl2-card-title">About me (printed on the report)</div>
      <div class="hl2-row"><input id="pfName" placeholder="Name" value="${hlEsc(prof.name)}"><input id="pfAge" placeholder="Age" value="${hlEsc(prof.age)}"></div>
      <input id="pfAll" placeholder="Allergies (if any)" value="${hlEsc(prof.allergies)}"></div>
    <div class="hl2-card"><div class="hl2-card-title">Things I want to tell the doctor</div>
      <textarea id="dnNotes" placeholder="e.g. Headaches are worse in the evening. Felt dizzy twice this week. Ask about the new tablet.">${hlEsc(notes)}</textarea></div>
    <div class="hl2-card"><div class="hl2-card-title">Show readings from</div>
      <select id="rpRange"><option value="30">Last 30 days</option><option value="90">Last 3 months</option><option value="180">Last 6 months</option><option value="0">Everything</option></select></div>
    <div id="rpSummary" class="hl2-hint"></div><div class="hl2-err" id="rpErr"></div>
    <button class="hl2-btn wide" id="rpPdf" type="button" style="padding:14px;font-size:15px">⬇ Download PDF for my doctor</button>
    <p class="hl2-hint" style="margin-top:8px">The PDF is made inside your browser. Your health data is not sent anywhere.</p>`;

  const sel = body.querySelector('#rpRange'); sel.value = String(range);
  const saveProfile = () => hlSet(HL.profile, { name: body.querySelector('#pfName').value.trim(), age: body.querySelector('#pfAge').value.trim(), allergies: body.querySelector('#pfAll').value.trim() });
  ['#pfName', '#pfAge', '#pfAll'].forEach(id => body.querySelector(id).oninput = saveProfile);
  body.querySelector('#dnNotes').oninput = e => hlSet(HL.notes, e.target.value);

  function summary() {
    range = Number(sel.value); hlSet('companion_report_range', range);
    const v = hlRangeVitals(range);
    body.querySelector('#rpSummary').textContent =
      `Will include: ${hlGet(HL.conds, []).length} condition(s), ${hlMeds().length} medicine(s), ${v.filter(e => HL_IS_BP(e.type)).length} BP reading(s), ${v.filter(e => HL_IS_SUGAR(e.type)).length} sugar reading(s), ${v.filter(e => HL_IS_SYMPTOM(e.type)).length} symptom note(s).`;
  }
  sel.onchange = summary; summary();

  body.querySelector('#rpPdf').onclick = async ev => {
    const btn = ev.currentTarget, errEl = body.querySelector('#rpErr');
    errEl.textContent = ''; btn.disabled = true; btn.textContent = 'Making your PDF…';
    try { await hlMakePdf(Number(sel.value)); btn.textContent = '✓ Downloaded - tap to make again'; }
    catch (e) { console.error(e); errEl.textContent = 'Could not make the PDF. Check your internet connection once and try again.'; btn.textContent = '⬇ Download PDF for my doctor'; }
    btn.disabled = false;
  };
}

// ---------- PDF ----------
function hlRangeVitals(days) {
  const cutoff = days ? Date.now() - days * 86400000 : 0;
  return hlGet(HL.vitals, []).filter(e => new Date(e.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));     // oldest first
}
function hlLoadPdfLib() {
  if (window.html2pdf) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = window.HL_PDF_LIB_URL || HL_PDF_LIB;
    s.onload = res; s.onerror = () => rej(new Error('pdf library'));
    document.head.appendChild(s);
  });
}

function hlStats(vals) {
  const n = vals.length, sum = vals.reduce((a, b) => a + b, 0);
  return { n, avg: Math.round(sum / n), min: Math.min(...vals), max: Math.max(...vals), last: vals[n - 1] };
}

function hlChart(series, w = 690, h = 150) {
  const pts = series.flatMap(s => s.points);
  if (pts.length < 2) return '';
  const t0 = Math.min(...pts.map(p => p.t)), t1 = Math.max(...pts.map(p => p.t));
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  const pad = Math.max(5, (hi - lo) * 0.15); lo -= pad; hi += pad;
  const L = 40, R = 10, T = 10, B = 24;
  const x = t => L + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (w - L - R);
  const y = v => T + (1 - (v - lo) / (hi - lo)) * (h - T - B);
  const grid = [0, 0.5, 1].map(f => { const v = lo + (hi - lo) * f; return `<line x1="${L}" x2="${w - R}" y1="${y(v)}" y2="${y(v)}" stroke="#ddd"/><text x="${L - 5}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="#666">${Math.round(v)}</text>`; }).join('');
  const lines = series.map(s => `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${s.points.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>` +
    s.points.map(p => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.6" fill="${s.color}"/>`).join('')).join('');
  const d = t => new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const legend = series.length > 1 ? series.map((s, i) => `<text x="${L + 6 + i * 90}" y="${T + 2}" font-size="10" fill="${s.color}">● ${s.name}</text>`).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">${grid}${lines}
    <text x="${L}" y="${h - 6}" font-size="10" fill="#666">${d(t0)}</text><text x="${w - R}" y="${h - 6}" font-size="10" text-anchor="end" fill="#666">${d(t1)}</text>${legend}</svg>`;
}

function hlBuildReport(days) {
  const prof = hlGet(HL.profile, {}), notes = (hlGet(HL.notes, '') || '').trim();
  const conds = hlGet(HL.conds, []), meds = hlMeds();
  const v = hlRangeVitals(days);
  const bp = v.filter(e => HL_IS_BP(e.type)).map(e => { const m = String(e.value).match(/(\d{2,3})\s*\/\s*(\d{2,3})/); return m ? { e, s: +m[1], d: +m[2], t: new Date(e.timestamp).getTime() } : null; }).filter(Boolean);
  const sg = v.filter(e => HL_IS_SUGAR(e.type)).map(e => ({ e, v: parseFloat(e.value), t: new Date(e.timestamp).getTime() })).filter(x => !isNaN(x.v));
  const sy = v.filter(e => HL_IS_SYMPTOM(e.type));
  const ot = v.filter(e => !HL_IS_BP(e.type) && !HL_IS_SUGAR(e.type) && !HL_IS_SYMPTOM(e.type));

  const H2 = t => `<h2 style="font-size:14px;margin:18px 0 6px;padding-bottom:3px;border-bottom:1.5px solid #333;page-break-after:avoid">${t}</h2>`;
  const th = 'text-align:left;background:#f0f0f0;padding:5px 7px;border:1px solid #ccc;font-size:11px', td = 'padding:5px 7px;border:1px solid #ddd;font-size:11.5px;vertical-align:top';
  const table = (head, rows) => `<table style="width:100%;border-collapse:collapse"><thead><tr>${head.map(h => `<th style="${th}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr style="page-break-inside:avoid">${r.map(c => `<td style="${td}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const capped = (arr, n = 45) => arr.length > n ? { rows: arr.slice(-n), note: `<div style="font-size:10.5px;color:#666;margin-top:3px">Showing the latest ${n} of ${arr.length} readings. The chart includes all of them.</div>` } : { rows: arr, note: '' };
  const rev = a => a.slice().reverse();
  const stat = (label, s, unit) => `<div style="font-size:12px;margin:4px 0"><b>${label}:</b> ${s.n} readings · average <b>${s.avg}</b> · lowest ${s.min} · highest ${s.max} · latest <b>${s.last}</b> ${unit}</div>`;
  const when = days ? `last ${days} days` : 'all time';

  let h = `<div style="width:690px;background:#fff;color:#111;font-family:system-ui,'Segoe UI','Noto Sans','Noto Sans Devanagari','Noto Sans Bengali',Arial,sans-serif;font-size:12px;line-height:1.45">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #7c5cff;padding-bottom:8px">
      <div><div style="font-size:22px;font-weight:800">Health Summary</div><div style="color:#555;font-size:11.5px">Prepared ${hlDate(new Date().toISOString())} · covers ${when}</div></div>
      <div style="text-align:right;font-size:12px">${prof.name ? `<b>${hlEsc(prof.name)}</b>` : ''}${prof.age ? ` · ${hlEsc(prof.age)} yrs` : ''}</div></div>
    ${prof.allergies ? `<div style="margin-top:8px;padding:6px 9px;background:#fff3f3;border:1px solid #e0a0a0;border-radius:4px"><b>Allergies:</b> ${hlEsc(prof.allergies)}</div>` : ''}`;

  if (notes) h += H2('Things I want to tell the doctor') + `<div style="white-space:pre-wrap;padding:7px 9px;border:1px solid #ddd;border-radius:4px">${hlEsc(notes)}</div>`;

  h += H2('Health conditions') + (conds.length ? `<ul style="margin:0;padding-left:18px">${conds.map(c => `<li>${hlEsc(c.name)}${c.note ? ` <span style="color:#666">(${hlEsc(c.note)})</span>` : ''}</li>`).join('')}</ul>` : '<div style="color:#666">None recorded.</div>');

  const medRow = m => [`<b>${hlEsc(m.name)}</b>`, hlEsc(m.dose), hlEsc(m.frequency) + (hlFriendlyFreq(m.frequency) ? ` <span style="color:#666">(${hlFriendlyFreq(m.frequency)})</span>` : ''), hlEsc(m.duration), hlEsc(m.notes)];
  const act = meds.filter(m => m.active), stp = meds.filter(m => !m.active);
  h += H2('Medicines I take now') + (act.length ? table(['Medicine', 'Dose', 'How often', 'Duration', 'Note'], act.map(medRow)) : '<div style="color:#666">None recorded.</div>');
  if (stp.length) h += H2('Medicines I have stopped') + table(['Medicine', 'Dose', 'How often', 'Duration', 'Note'], stp.map(medRow));

  // month-by-month averages (only when the readings span more than one month)
  const months = {};
  const slot = t => (months[new Date(t).toLocaleDateString('en-CA').slice(0, 7)] ||= { s: [], d: [], g: [] });
  bp.forEach(x => { const m = slot(x.t); m.s.push(x.s); m.d.push(x.d); });
  sg.forEach(x => slot(x.t).g.push(x.v));
  const mKeys = Object.keys(months).sort();
  if (mKeys.length > 1) {
    const avg = a => a.length ? Math.round(a.reduce((p, q) => p + q, 0) / a.length) : null;
    h += H2('Month by month (averages)') + table(['Month', 'BP average', 'Sugar average', 'Readings'], mKeys.map(k => {
      const m = months[k], label = new Date(k + '-15').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return [label, m.s.length ? `<b>${avg(m.s)}/${avg(m.d)}</b>` : '-', m.g.length ? `<b>${avg(m.g)}</b> mg/dL` : '-', `${m.s.length} BP, ${m.g.length} sugar`];
    }));
  }

  if (bp.length) {
    const c = capped(rev(bp));
    h += H2('Blood pressure') + stat('Upper (systolic)', hlStats(bp.map(x => x.s)), 'mmHg') + stat('Lower (diastolic)', hlStats(bp.map(x => x.d)), 'mmHg')
      + hlChart([{ name: 'Upper', color: '#c0392b', points: bp.map(x => ({ t: x.t, v: x.s })) }, { name: 'Lower', color: '#2c6fbb', points: bp.map(x => ({ t: x.t, v: x.d })) }])
      + `<div style="margin-top:6px">${table(['Date & time', 'BP (mmHg)'], c.rows.map(x => [hlDate(x.e.timestamp, true), `<b>${x.s}/${x.d}</b>`]))}</div>${c.note}`;
  }
  if (sg.length) {
    const c = capped(rev(sg));
    h += H2('Blood sugar') + stat('Sugar', hlStats(sg.map(x => x.v)), 'mg/dL')
      + hlChart([{ name: 'Sugar', color: '#2c6fbb', points: sg.map(x => ({ t: x.t, v: x.v })) }])
      + `<div style="margin-top:6px">${table(['Date & time', 'Sugar (mg/dL)', 'When'], c.rows.map(x => [hlDate(x.e.timestamp, true), `<b>${x.v}</b>`, hlEsc(x.e.note)]))}</div>${c.note}`;
  }
  if (sy.length) { const c = capped(rev(sy), 40); h += H2('How I felt') + table(['Date', 'What', 'How bad'], c.rows.map(e => [hlDate(e.timestamp, true), hlEsc(e.value), hlEsc(e.note)])) + c.note; }
  if (ot.length) { const c = capped(rev(ot), 40); h += H2('Other measurements') + table(['Date', 'What', 'Value'], c.rows.map(e => [hlDate(e.timestamp, true), hlEsc(e.type), hlEsc(e.value)])) + c.note; }
  if (!bp.length && !sg.length && !sy.length && !ot.length) h += H2('Readings') + `<div style="color:#666">No readings were logged in this period.</div>`;

  h += `<div style="margin-top:22px;padding-top:8px;border-top:1px solid #ccc;font-size:10.5px;color:#666">Recorded by the patient in the Smart Companion app. This is a self-kept log to help the conversation with the doctor. It is not a medical record and it is not a diagnosis.</div></div>`;
  const wrap = document.createElement('div'); wrap.innerHTML = h; return wrap.firstElementChild;
}

async function hlMakePdf(days) {
  await hlLoadPdfLib();
  const el = hlBuildReport(days);
  await html2pdf().set({
    margin: [10, 10, 12, 10],
    filename: `Health-Summary-${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'h2', 'svg'] },
  }).from(el).save();
}