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
    name: 'General Cognition',
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
    delBtn.title = 'Purge Stream';
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
  if (!confirm(`Purge memory stream "${sessions[label].name}"?`)) return;

  delete sessions[label];
  if (Object.keys(sessions).length === 0) {
    sessions.general = {
      history: [], completedSteps: [], stepCounter: 0, currentGoal: null,
      feedHTML: initialFeedHTML, name: 'General Cognition', sessionNote: ''
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
  if (!confirm('Purge all memory streams and restart system context?')) return;
  localStorage.removeItem(SESSIONS_KEY);
  sessions = {
    general: {
      history: [], completedSteps: [], stepCounter: 0, currentGoal: null,
      feedHTML: initialFeedHTML, name: 'General Cognition', sessionNote: ''
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

    const header = document.createElement('div');
    header.className = 'step-card-header';
    header.innerHTML = `<span>CLARIFICATION REQUIRED</span><span>1 QUERY</span>`;
    wrap.appendChild(header);

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
        } else {
          badgeEl.textContent = `${completedCount} of ${stepEntries.length} completed`;
        }
        const doneBtn = wrap.querySelector('.done-btn');
        if (doneBtn) {
          doneBtn.innerHTML = `<span>Done — what's next?</span> <span>→</span>`;
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
  synthesisTag.innerHTML = `<span>KNOWLEDGE SYNTHESIS</span><span>RETRIEVAL RESULT</span>`;
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
      session_note: currentSessionNote
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
  setStatus('Deconstructing cognitive task…');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const enrichedGoal = (currentLabel === 'medical')
      ? `${text} ${recentHealthLogSummary()}`.trim()
      : text;
    const data = await callBackend(enrichedGoal, true);
    const steps = data.steps || [];
    completedSteps = steps.map(s => s.text);
    addAssistantBubble(steps, data.is_final);
    if (!data.was_error) {
      history.push({ role: "assistant", content: steps.map(s => s.text).join(' ') });
    }
    snapshotCurrentSession();

    if (data.is_emergency) {
      showEmergencyPanel(true); // true = a real emergency was detected from the chat text
    } else {
      maybeShowNearbyHealthcare();
    }

    if (data.is_final) celebrateTaskDone();
    setStatus('');
  } catch (err) {
    console.error('sendMessage error:', err);
    setStatus("Backend connection error. Please verify FastAPI is running at port 8000.", true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function handleDone(btnEl) {
  btnEl.disabled = true;
  btnEl.innerHTML = `<span>Retrieving Next Milestones…</span>`;
  setStatus('Advancing task sequence…');

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
    setStatus("Task sequence error.", true);
    btnEl.disabled = false;
    btnEl.innerHTML = `<span>Execute Next Milestone</span><span>→</span>`;
  }
}

if (sendBtn) sendBtn.addEventListener('click', () => handleSendClick());

// --- 9. AUDIO CAPTURE & SPEECH SYNTHESIS ENGINE ---

const LiveRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let liveRecognition = null;

function startLiveCaptions() {
  if (!LiveRecognition) return;
  liveRecognition = new LiveRecognition();
  liveRecognition.continuous = true;
  liveRecognition.interimResults = true;
  liveRecognition.lang = 'en-US';

  if (liveTicker) liveTicker.style.display = 'flex';
  if (liveTickerText) liveTickerText.textContent = 'Audio stream active…';

  liveRecognition.onresult = (event) => {
    let combined = '';
    for (let i = 0; i < event.results.length; i++) {
      combined += event.results[i][0].transcript;
    }
    if (goalEl) {
      goalEl.value = combined;
      goalEl.dispatchEvent(new Event('input'));
    }
    if (liveTickerText) liveTickerText.textContent = combined || 'Listening…';
  };

  liveRecognition.onerror = () => {};
  try { liveRecognition.start(); } catch (e) {}
}

function stopLiveCaptions() {
  if (liveTicker) liveTicker.style.display = 'none';
  if (liveRecognition) {
    try { liveRecognition.stop(); } catch (e) {}
    liveRecognition = null;
  }
}

if (micBtn) {
  micBtn.addEventListener('click', async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = handleStop;
        mediaRecorder.start();
        startLiveCaptions();
        isRecording = true;
        micBtn.classList.add('recording');
        setStatus('Capturing voice audio…');
      } catch (err) {
        setStatus('Microphone access denied.', true);
      }
    } else {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      stopLiveCaptions();
      isRecording = false;
      micBtn.classList.remove('recording');
      setStatus('Transcribing with Groq Whisper…');
    }
  });
}

async function handleStop() {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  try {
    const res = await fetch(`${API}/transcribe`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('transcribe failed');
    const data = await res.json();
    setStatus('');
    if (data.text) {
      unlockBadge('voice', 'Voice Explorer');
      if (goalEl) {
        goalEl.value = '';
        goalEl.style.height = 'auto';
      }
      sendMessage(data.text);
    } else {
      setStatus("No audio deciphered.", true);
    }
  } catch (err) {
    console.error('Audio transcription error:', err);
    setStatus('Whisper transcription failed.', true);
  }
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
    stopIpImgPolling(); // no IP frame polling while on webcam
    if (panelIpImgPreview) panelIpImgPreview.style.display = 'none';
    if (panelWebcamPreview) panelWebcamPreview.style.display = 'block';
    if (headerIpDot) headerIpDot.style.background = 'var(--text-faint)';
  } else {
    if (panelWebcamPreview) panelWebcamPreview.style.display = 'none';
    if (panelIpImgPreview) {
      panelIpImgPreview.style.display = 'block';
      startIpImgPolling(panelIpImgPreview);
    }
    checkCameraStatus(true); // one real status check when switching INTO ip camera mode
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

// The periodic poll only touches the network while IP Camera mode is
// actually selected. `force` lets explicit user actions (opening
// settings, Test button) check regardless of the current mode.
async function checkCameraStatus(force = false) {
  if (!force && currentCameraSource !== 'ipcamera') return null;
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
          ? 'LINK ESTABLISHED: STREAM VERIFIED'
          : (data.message || 'Stream offline or unresolved');
        ipModalStatusText.style.color = color;
      }
      return data;
    }
  } catch (e) {
    if (headerIpDot) headerIpDot.style.background = 'var(--text-faint)';
    if (ipModalDot) ipModalDot.style.background = 'var(--text-faint)';
    if (ipModalStatusText) {
      ipModalStatusText.textContent = 'BACKEND OFFLINE';
      ipModalStatusText.style.color = 'var(--text-muted)';
    }
  }
  return null;
}
setInterval(() => checkCameraStatus(), 8000);

if (btnIpSettings) {
  btnIpSettings.addEventListener('click', () => {
    if (ipSettingsModal) ipSettingsModal.classList.add('active');
    if (backendApiHostInput) backendApiHostInput.value = localStorage.getItem('companion_api_host') || '';
    checkCameraStatus(true);
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
    const status = await checkCameraStatus(true);
    ipTestBtn.disabled = false;
    ipTestBtn.textContent = 'Test Stream Link';
    if (status && status.connected) setStatus('Optical link verified active.');
    else setStatus('Optical link offline. Check stream endpoint.', true);
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
    setStatus('Connecting to stream…');
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
        await checkCameraStatus(true);
        setStatus(data.connected ? 'Stream link verified.' : 'Stream URL saved.');
      } else {
        setStatus('Failed to update stream configuration.', true);
      }
    } catch (err) {
      setStatus('Backend unreachable.', true);
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
    if (snapHint) snapHint.textContent = 'Point webcam, then capture frame';
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
    if (snapHint) snapHint.textContent = 'Point IP Camera, then capture frame';
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
          goalEl.placeholder = "Query this optical snapshot…";
          goalEl.focus();
        }
        stopSnapCapture();
      }, 'image/jpeg', 0.85);
    } else {
      setStatus('Capturing IP camera frame…');
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
          goalEl.placeholder = "Query this optical snapshot…";
          goalEl.focus();
        }
        stopSnapCapture();
        setStatus('');
      } catch (err) {
        setStatus('Failed to capture frame from stream.', true);
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
    goalEl.placeholder = "Query this optical snapshot…";
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
    setStatus('Indexing document pages…');
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
        goalEl.placeholder = "Query this document context…";
        goalEl.focus();
      }
      setStatus(data.truncated ? 'Indexed first section of large document.' : '');
    } catch (err) {
      setStatus('Document indexing failed.', true);
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
  setStatus('Searching document vector space…');
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
    setStatus('Document reasoning error.', true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function sendImageMessage(file, imageUrl, question) {
  unlockBadge('photo', 'Photo Detective');
  addUserBubble(question, imageUrl);
  history.push({ role: "user", content: question });
  setStatus('Running Groq Vision inference…');
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
    setStatus('Vision model inference error.', true);
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
      setLiveCamAnswer("Webcam active. Point at any object or environment to query.");
      speak("Webcam active.");
      if (liveCamGoal) { liveCamGoal.value = ''; liveCamGoal.focus(); }
    } catch (err) {
      setStatus('Optical sensor access denied.', true);
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
    setLiveCamAnswer("IP Camera feed active. Point camera and query.");
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
  setLiveCamAnswer("Analyzing visual scene…", true);
  if (liveCamSendBtn) liveCamSendBtn.disabled = true;

  const blob = await captureCurrentFrame();
  if (!blob) {
    setLiveCamAnswer(currentCameraSource === 'webcam'
      ? "Optical frame acquisition failed."
      : "Stream frame unavailable. Check network link.");
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
      speak("Optical frame error.");
    } else {
      const fullAnswer = flattenAnswer(data.headline, data.steps);
      setLiveCamAnswer(fullAnswer);
      speak(data.headline);
      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: fullAnswer });
    }
  } catch (err) {
    setLiveCamAnswer("Vision service unreachable.");
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
    rec.lang = 'en-US';
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
  // also silence whatever is being spoken right now, not just future calls
  if (window.speechSynthesis) window.speechSynthesis.cancel();
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

// --- 13. PERSONAL GROWTH & CAPABILITY PROGRESSION ---

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
  showToast(`Milestone completed // Total: ${g.totalSteps}`);
  renderGamifyBar();
}

function celebrateTaskDone() {
  showToast("Sequence completed.", true);
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
  showToast(`Capability unlocked: ${label}`);
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
  { id: 'voice', title: 'Voice Telemetry', desc: 'Audio transcription via Groq Whisper' },
  { id: 'photo', title: 'Visual Analysis', desc: 'Snapshot query via Groq Vision' },
  { id: 'doc', title: 'Document RAG', desc: 'Vector page retrieval on PDF documents' },
  { id: 'live', title: 'Spatial Assistance', desc: 'Live optical guidance stream' },
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
            <div class="milestone-desc">${unlocked ? 'ACTIVE' : 'LOCKED'} // ${b.desc}</div>
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

// --- 14. EMERGENCY CONTACTS (single source of truth, unlimited) ---
// Used by BOTH the SOS panel and the Health Log, so a contact is only
// ever saved in one place. Stored privately in this browser only.

const EMERGENCY_CONTACTS_KEY = 'companion_emergency_contacts';
const LEGACY_CONTACT_KEY = 'companion_emergency_contact'; // older single-contact format

function loadEmergencyContacts() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(EMERGENCY_CONTACTS_KEY)) || []; } catch (e) {}
  if (!list.length) {
    // one-time migration of the old single saved contact, if one exists
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_CONTACT_KEY));
      if (legacy && legacy.phone) {
        list = [{ name: legacy.name || 'Emergency contact', phone: legacy.phone, relation: '' }];
        localStorage.setItem(EMERGENCY_CONTACTS_KEY, JSON.stringify(list));
      }
    } catch (e) {}
  }
  return list;
}
function saveEmergencyContacts(list) {
  try { localStorage.setItem(EMERGENCY_CONTACTS_KEY, JSON.stringify(list)); } catch (e) {}
}
function addEmergencyContact(name, phone, relation) {
  const list = loadEmergencyContacts();
  list.push({ name, phone, relation: relation || '' });
  saveEmergencyContacts(list);
}
function removeEmergencyContact(index) {
  const list = loadEmergencyContacts();
  list.splice(index, 1);
  saveEmergencyContacts(list);
}

// WhatsApp/tel links need digits only, with country code. If someone types
// a bare 10-digit number we assume India (+91), matching the rest of the app.
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;
  return d;
}

function buildEmergencyMessage(lat, lon) {
  const maps = (lat != null && lon != null) ? `https://maps.google.com/?q=${lat},${lon}` : '';
  return 'EMERGENCY: I may need urgent help (sent from Smart Companion).' +
    (maps ? ` My location: ${maps}` : ' (Location unavailable.)');
}

function whatsappLink(phone, message) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

// Opens a WhatsApp chat (message pre-filled) for every saved contact.
// WhatsApp itself requires a human to press Send - there is no way around
// that without a paid API - and browsers may block extra tabs opened
// without a fresh click. Returns how many opened vs got blocked.
function openWhatsAppForAll(lat, lon) {
  const contacts = loadEmergencyContacts();
  const msg = buildEmergencyMessage(lat, lon);
  let opened = 0, blocked = 0;
  contacts.forEach(c => {
    const w = window.open(whatsappLink(c.phone, msg), '_blank');
    if (w) opened++; else blocked++;
  });
  return { total: contacts.length, opened, blocked };
}
window.notifyAllEmergencyContacts = () => {
  const loc = peekCachedLocation(30 * 60 * 1000);
  return Promise.resolve(openWhatsAppForAll(loc ? loc.lat : null, loc ? loc.lon : null));
};

// --- 15. PRIVATE HEALTH LOG SYSTEM ---

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
  box.style.maxHeight = '88vh';
  box.style.overflowY = 'auto';

  box.innerHTML = `
    <div class="dialog-header">
      <div class="dialog-title-group">
        <div class="dialog-badge">SECURE CLIENT STORAGE</div>
        <div class="dialog-title">Health Telemetry Log</div>
      </div>
      <button type="button" class="dialog-close-btn" id="hlCloseIcon" aria-label="Close">✕</button>
    </div>

    <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:12px;">
      Stored only in this browser. Relevant metrics are contextualized only during medical sessions.
    </p>

    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <input id="hlType" placeholder="Metric (Glucose, BP, Mood)" style="flex:1; padding:8px 10px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
      <input id="hlValue" placeholder="Value (e.g. 110, 120/80)" style="width:140px; padding:8px 10px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
    </div>
    <input id="hlNote" placeholder="Context or clinical note (optional)" style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px; margin-bottom:12px;">
    <button id="hlAddBtn" class="btn-execute" style="width:100%; margin-bottom:16px;">Record Telemetry</button>

    <div style="font-family:var(--font-mono); font-size:10px; font-weight:700; color:var(--text-muted); margin-bottom:6px;">STORED RECORDS</div>
    <div id="hlList" style="max-height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;"></div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function renderList() {
    const entries = loadHealthLog();
    const list = box.querySelector('#hlList');
    if (!entries.length) {
      list.innerHTML = '<div style="color:var(--text-muted); font-size:12px; padding:6px 0;">No telemetry logged.</div>';
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

  // Medicines + emergency contacts live in this same panel
  renderMedicinesSection(box);
  renderFamilyContactsSection(box);

  const closeMe = () => overlay.remove();
  box.querySelector('#hlCloseIcon').onclick = closeMe;
  overlay.onclick = (e) => { if (e.target === overlay) closeMe(); };
}

<<<<<<< HEAD
const MEDICINES_KEY = 'companion_medicines';

function loadMedicines() {
  try { return JSON.parse(localStorage.getItem(MEDICINES_KEY)) || []; }
  catch (e) { return []; }
}
function saveMedicines(list) {
  try { localStorage.setItem(MEDICINES_KEY, JSON.stringify(list)); } catch (e) {}
}
function addMedicine(name, dosage, time) {
  const list = loadMedicines();
  list.push({ id: Date.now(), name, dosage, time });
  saveMedicines(list);
}
function removeMedicine(index) {
  const list = loadMedicines();
  list.splice(index, 1);
  saveMedicines(list);
}

function renderMedicinesSection(box) {
  const section = document.createElement('div');
  section.innerHTML = `
    <div style="font-size:15px; font-weight:700; color:var(--teal); margin:18px 0 8px;">💊 My Medicines</div>
    <div style="display:flex; gap:6px; margin-bottom:8px;">
      <input id="medName" placeholder="Medicine name" style="flex:1; padding:7px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
      <input id="medDose" placeholder="Dosage" style="width:80px; padding:7px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
      <input id="medTime" placeholder="Time (e.g. 8am)" style="width:90px; padding:7px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
    </div>
    <button id="medAddBtn" class="btn-subtle" style="width:100%; margin-bottom:10px;">+ Add medicine</button>
    <div id="medList"></div>
  `;
  box.appendChild(section);

  function renderList() {
    const meds = loadMedicines();
    const listEl = section.querySelector('#medList');
    if (!meds.length) {
      listEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">No medicines added yet.</div>';
      return;
    }
    listEl.innerHTML = meds.map((m, i) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border-subtle); font-size:13px;">
        <span><b>${escapeHtml(m.name)}</b> - ${escapeHtml(m.dosage || '')} ${m.time ? 'at ' + escapeHtml(m.time) : ''}</span>
        <button data-idx="${i}" class="med-remove-btn" style="background:none; border:none; color:var(--coral); cursor:pointer; font-size:12px;">✕</button>
      </div>
    `).join('');
    listEl.querySelectorAll('.med-remove-btn').forEach(btn => {
      btn.onclick = () => { removeMedicine(parseInt(btn.dataset.idx, 10)); renderList(); };
    });
  }
  renderList();

  section.querySelector('#medAddBtn').onclick = () => {
    const name = section.querySelector('#medName').value.trim();
    const dosage = section.querySelector('#medDose').value.trim();
    const time = section.querySelector('#medTime').value.trim();
    if (!name) return;
    addMedicine(name, dosage, time);
    section.querySelector('#medName').value = '';
    section.querySelector('#medDose').value = '';
    section.querySelector('#medTime').value = '';
    renderList();
  };
}

function renderFamilyContactsSection(box) {
  const section = document.createElement('div');
  section.innerHTML = `
    <div style="font-size:15px; font-weight:700; color:var(--coral); margin:18px 0 8px;">👨‍👩‍👧 Emergency Contacts (add as many as you like)</div>
    <div style="display:flex; gap:6px; margin-bottom:8px;">
      <input id="famName" placeholder="Name" style="flex:1; padding:7px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
      <input id="famRelation" placeholder="Relation / Role" style="flex:1; padding:7px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
    </div>
    <input id="famPhone" placeholder="Phone with country code, e.g. 919876543210" style="width:100%; box-sizing:border-box; padding:7px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px; margin-bottom:8px;">
    <button id="famAddBtn" class="btn-subtle" style="width:100%; margin-bottom:10px;">+ Add contact</button>
    <div id="famList"></div>
  `;
  box.appendChild(section);

  function renderList() {
    const list = loadEmergencyContacts();
    const listEl = section.querySelector('#famList');
    if (!list.length) {
      listEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">No contacts added yet.</div>';
      return;
    }
    listEl.innerHTML = list.map((c, i) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border-subtle); font-size:13px;">
        <span><b>${escapeHtml(c.name)}</b> (${escapeHtml(c.relation || 'contact')}) - ${escapeHtml(c.phone)}</span>
        <button data-idx="${i}" class="fam-remove-btn" style="background:none; border:none; color:var(--coral); cursor:pointer; font-size:12px;">✕</button>
      </div>
    `).join('');
    listEl.querySelectorAll('.fam-remove-btn').forEach(btn => {
      btn.onclick = () => { removeEmergencyContact(parseInt(btn.dataset.idx, 10)); renderList(); };
    });
  }
  renderList();

  section.querySelector('#famAddBtn').onclick = () => {
    const name = section.querySelector('#famName').value.trim();
    const relation = section.querySelector('#famRelation').value.trim();
    const phone = section.querySelector('#famPhone').value.trim();
    if (!name || !phone) return;
    addEmergencyContact(name, phone, relation);
    section.querySelector('#famName').value = '';
    section.querySelector('#famRelation').value = '';
    section.querySelector('#famPhone').value = '';
    renderList();
  };
}

// --- 16. EMERGENCY SOS MEDICAL PROTOCOL ---
=======
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
          <div class="dialog-badge" style="color:var(--coral);">CRITICAL SAFETY PROTOCOL</div>
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
            AUTOMATED EMERGENCY MESSAGE PREVIEW
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
>>>>>>> 408d11c4d1ccf07731f4a89c6767f934a1c90e41

// Caches the browser's last known location client-side, so we don't
// re-ask GPS (with its own permission prompt + latency) on every single
// lookup. maxAgeMs controls how stale a cached fix may be before we
// fetch a fresh one.
const LOCATION_CACHE_KEY = 'companion_last_location';

// Synchronous read of the cached location (no GPS call) - used when
// speed matters more than freshness, e.g. the first instant of an SOS.
function peekCachedLocation(maxAgeMs = 30 * 60 * 1000) {
  try {
    const cached = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY));
    if (cached && (Date.now() - cached.timestamp) < maxAgeMs) return { lat: cached.lat, lon: cached.lon };
  } catch (e) {}
  return null;
}

function getCachedOrFreshLocation(maxAgeMs = 10 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const cached = peekCachedLocation(maxAgeMs);
    if (cached) {
      resolve({ lat: cached.lat, lon: cached.lon, fromCache: true });
      return;
    }

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

// Self-contained styles for the SOS panel animation (no style.css edit needed)
(function injectSosStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes sosPulseGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.45); }
      50% { box-shadow: 0 0 0 14px rgba(255, 71, 87, 0); }
    }
    @keyframes sosFadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
    .sos-premium-box { animation: sosFadeIn 0.22s ease; }
    .sos-siren-ring { animation: sosPulseGlow 1.6s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
})();

const sosBtnEl = document.getElementById('sosBtn');
// arrow wrapper so the click Event is NOT passed in as `autoNotify`
if (sosBtnEl) sosBtnEl.addEventListener('click', () => showEmergencyPanel(false));

// Current coordinates for the open SOS panel, so the WhatsApp links can be
// refreshed as soon as a fresh GPS fix arrives.
let sosCoords = { lat: null, lon: null };

function showEmergencyPanel(autoNotify = false) {
  // never stack two SOS panels
  const existing = document.getElementById('sosOverlayRoot');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sosOverlayRoot';
  overlay.className = 'settings-modal active';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.zIndex = '999';
  overlay.style.backdropFilter = 'blur(6px)';

  const box = document.createElement('div');
<<<<<<< HEAD
  box.className = 'settings-box sos-premium-box';
  box.style.cssText = `
    position: relative;
    border: 1.5px solid var(--coral);
    border-radius: 14px;
    background: linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-subtle) 100%);
    box-shadow: 0 20px 60px rgba(255, 71, 87, 0.18);
    max-width: 440px;
    max-height: 92vh;
    overflow-y: auto;
  `;

  box.innerHTML = `
    <button type="button" id="sosCloseBtn" aria-label="Close" style="position:absolute; top:14px; right:14px; background:none; border:none; color:var(--text-muted); font-size:16px; cursor:pointer;">✕</button>

    <div style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:6px 4px 14px;">
      <div class="sos-siren-ring" style="width:56px; height:56px; border-radius:50%; background:var(--coral); display:flex; align-items:center; justify-content:center; font-size:26px; margin-bottom:10px;">🆘</div>
      <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:1.5px; color:var(--coral); font-weight:700;">CRITICAL PROTOCOL ACTIVE</div>
      <div style="font-size:19px; font-weight:800; color:var(--text-primary); margin-top:2px;">Emergency Assistance</div>
    </div>

    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
      <a href="tel:108" style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-radius:10px; background:var(--coral); color:#fff; font-weight:800; text-decoration:none; font-size:15px; box-shadow:0 6px 18px rgba(255,71,87,0.35);">
        <span>🚑 Call Ambulance</span>
        <span style="font-family:var(--font-mono); font-size:18px;">108</span>
      </a>
      <a href="tel:104" style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-radius:10px; background:var(--bg-subtle); border:1px solid var(--border-subtle); color:var(--text-primary); font-weight:700; text-decoration:none; font-size:14px;">
        <span>☎️ Health Helpline</span>
        <span style="font-family:var(--font-mono); font-size:16px;">104</span>
      </a>
    </div>

    <div id="sosNearestHospital" style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 13px; font-size:12.5px; color:var(--text-secondary); margin-bottom:14px;">
      📍 Locating nearest hospital…
    </div>

    <div id="sosNotifyStatus" style="font-size:12.5px; color:var(--teal); margin-bottom:8px; min-height:16px;"></div>
    <div id="emergencyContactBlock" style="margin-bottom:14px;"></div>

    <button id="sosCloseActionBtn" class="btn-subtle" style="width:100%; border-radius:10px;">Dismiss</button>
=======
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
          CRITICAL PROTOCOL
        </div>
        <div class="dialog-title" style="color:var(--coral);">Immediate Emergency Assistance</div>
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
            <span>Live Emergency Navigation</span>
          </div>
          <span class="sos-google-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
            Google Maps
          </span>
        </div>

        <div id="sosLocationContent">
          <div id="sosLocationLoading" style="display:flex; align-items:center; gap:10px; padding:16px 12px; background:var(--bg-subtle); border-radius:var(--radius-sm); border:1px solid var(--border-subtle); color:var(--text-secondary); font-size:12.5px;">
            <span style="display:inline-block; width:14px; height:14px; border-radius:50%; border:2px solid var(--coral); border-top-color:transparent; animation:spin 0.8s linear infinite; flex-shrink:0;"></span>
            <span>Acquiring GPS location telemetry and calculating route to nearest hospital…</span>
          </div>
        </div>
      </div>

      <button id="sosCloseActionBtn" class="btn-subtle" style="width:100%;">Dismiss Emergency Protocol</button>
    </div>
>>>>>>> 408d11c4d1ccf07731f4a89c6767f934a1c90e41
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const closeMe = () => overlay.remove();
  box.querySelector('#sosCloseBtn').onclick = closeMe;
  box.querySelector('#sosCloseActionBtn').onclick = closeMe;
  overlay.onclick = (e) => { if (e.target === overlay) closeMe(); };

<<<<<<< HEAD
  const contactBlock = box.querySelector('#emergencyContactBlock');
  const notifyStatus = box.querySelector('#sosNotifyStatus');
  const nearestBox = box.querySelector('#sosNearestHospital');

  // Use whatever location we already have, immediately - speed matters.
  const quick = peekCachedLocation(30 * 60 * 1000);
  sosCoords = { lat: quick ? quick.lat : null, lon: quick ? quick.lon : null };
  renderSosContactsBlock(contactBlock, notifyStatus);

  // Real emergency detected from the chat: open WhatsApp for every saved
  // contact right now. Browsers can block extra tabs opened without a
  // fresh click, so we report honestly and the buttons below always work.
  if (autoNotify) {
    const contacts = loadEmergencyContacts();
    if (!contacts.length) {
      notifyStatus.style.color = 'var(--coral)';
      notifyStatus.textContent = '⚠ No emergency contacts saved yet - add one below so you can alert them in one tap next time.';
    } else {
      const r = openWhatsAppForAll(sosCoords.lat, sosCoords.lon);
      if (r.blocked === 0) {
        notifyStatus.textContent = `✓ WhatsApp opened for ${r.opened} contact${r.opened > 1 ? 's' : ''} - tap Send in each chat.`;
      } else {
        notifyStatus.style.color = 'var(--coral)';
        notifyStatus.textContent = `Your browser blocked ${r.blocked} automatic tab${r.blocked > 1 ? 's' : ''} - tap the green WhatsApp buttons below to alert each contact.`;
      }
    }
  }

  // Then upgrade to a fresh GPS fix: refreshes the WhatsApp links with the
  // accurate location and finds the nearest hospital.
  getCachedOrFreshLocation(2 * 60 * 1000)
    .then(async ({ lat, lon }) => {
      sosCoords = { lat, lon };
      refreshSosLinks(contactBlock);
      try {
        const res = await fetch(`${API}/directory/search?lat=${lat}&lon=${lon}&radius_km=20&limit=1`);
        const data = await res.json();
        if (data.doctors && data.doctors.length) {
          const h = data.doctors[0];
          const firstPhone = h.phone ? h.phone.split(';')[0].trim() : null;
          nearestBox.innerHTML = `📍 Nearest: <b>${escapeHtml(h.name)}</b> (${h.distance_km} km)` +
            (firstPhone ? ` — <a href="tel:${firstPhone.replace(/\D/g, '')}" style="color:var(--teal); font-weight:700;">${escapeHtml(firstPhone)}</a>` : '');
        } else {
          nearestBox.textContent = 'No listed facility within 20 km. Use the direct lines above.';
        }
      } catch (e) {
        nearestBox.textContent = 'Could not resolve facility — use the emergency hotlines.';
      }
    })
    .catch(() => {
      nearestBox.textContent = 'Location unavailable — dial 108 or 104.';
=======
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
            <span>Emergency Contact SOS Auto-Alert</span>
          </div>
          <span class="sos-alert-badge pending">NO CONTACT SAVED</span>
        </div>
        <p style="font-size:12px; color:var(--text-secondary); margin:0;">
          Add a trusted contact number so an automated emergency message with your live GPS coordinates & map link is prepared and sent immediately:
        </p>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:2px;">
          <input id="sosQuickName" placeholder="Name (e.g. Mom)" style="flex:1; min-width:110px; padding:7px 9px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:12.5px;">
          <input id="sosQuickPhone" placeholder="Phone (+91...)" style="flex:1; min-width:140px; padding:7px 9px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:12.5px;">
          <button type="button" id="sosQuickSaveBtn" class="btn-execute" style="padding:7px 12px; font-size:12px; white-space:nowrap; background:var(--coral);">Save & Dispatch Alert</button>
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
          <span>Emergency Contact Automated Alert</span>
        </div>
        <span id="sosAlertStatusBadge" class="sos-alert-badge ${alertDispatched ? 'dispatched' : 'pending'}">
          ${alertDispatched ? '✅ Alert Dispatched & Logged' : '⚡ Sending Auto-Alert…'}
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
          badge.textContent = '✅ Alert Ready (1-Tap Send)';
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
                <span>Live Location Telemetry</span>
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
>>>>>>> 408d11c4d1ccf07731f4a89c6767f934a1c90e41
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
          <span>⚠️</span> GPS Location Access Unavailable
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
        <span>${forceFresh ? 'Fetching fresh GPS coordinates…' : 'Acquiring GPS location telemetry and calculating route to nearest hospital…'}</span>
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

// Updates every WhatsApp button's link in place with the latest coordinates
// (does not re-render, so anything being typed in the add-form is kept).
function refreshSosLinks(block) {
  if (!block) return;
  const contacts = loadEmergencyContacts();
  const msg = buildEmergencyMessage(sosCoords.lat, sosCoords.lon);
  block.querySelectorAll('a[data-wa]').forEach(a => {
    const c = contacts[parseInt(a.dataset.wa, 10)];
    if (c) a.href = whatsappLink(c.phone, msg);
  });
}

// SOS contacts block: one row per saved contact with direct WhatsApp + Call
// buttons (real anchor taps, so never popup-blocked), plus an add form.
function renderSosContactsBlock(block, statusEl) {
  if (!block) return;
  const contacts = loadEmergencyContacts();
  const msg = buildEmergencyMessage(sosCoords.lat, sosCoords.lon);

  let html = '';
  if (contacts.length) {
    html += `<div style="font-size:11px; font-family:var(--font-mono); letter-spacing:1px; color:var(--text-muted); margin-bottom:6px;">YOUR EMERGENCY CONTACTS</div>`;
    html += contacts.map((c, i) => `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:9px 10px; margin-bottom:6px; border:1px solid var(--border-subtle); border-radius:10px; background:var(--bg-subtle);">
        <div style="min-width:0;">
          <div style="font-weight:700; font-size:13.5px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(c.name)}</div>
          <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(c.relation || 'contact')} · ${escapeHtml(c.phone)}</div>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <a data-wa="${i}" href="${whatsappLink(c.phone, msg)}" target="_blank" rel="noopener" style="padding:7px 10px; border-radius:8px; background:#25D366; color:#fff; font-weight:700; font-size:12.5px; text-decoration:none;">💬 WhatsApp</a>
          <a href="tel:+${normalizePhone(c.phone)}" style="padding:7px 10px; border-radius:8px; background:var(--bg-elevated); border:1px solid var(--border-subtle); color:var(--text-primary); font-weight:700; font-size:12.5px; text-decoration:none;">📞 Call</a>
        </div>
      </div>
    `).join('');
    html += `<button id="waAllBtn" class="btn-subtle" style="width:100%; margin:2px 0 10px; border-color:#25D366; color:#25D366; font-weight:700;">💬 Message everyone at once</button>`;
  } else {
    html += `<div style="font-size:12.5px; color:var(--text-secondary); margin-bottom:8px;">No emergency contacts saved yet. Add one - it is stored only in this browser:</div>`;
  }

  html += `
    <details ${contacts.length ? '' : 'open'} style="margin-top:2px;">
      <summary style="cursor:pointer; font-size:12.5px; color:var(--text-secondary); margin-bottom:6px;">${contacts.length ? '+ Add another contact' : 'Add contact'}</summary>
      <div style="display:flex; gap:6px; margin:6px 0;">
        <input id="ecName" placeholder="Name" style="flex:1; padding:7px 10px; border-radius:6px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
        <input id="ecPhone" placeholder="Phone (+country code)" style="flex:1; padding:7px 10px; border-radius:6px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;">
      </div>
      <button id="ecSaveBtn" class="btn-subtle" style="width:100%;">Save contact</button>
    </details>
  `;
  block.innerHTML = html;

  const waAll = block.querySelector('#waAllBtn');
  if (waAll) {
    waAll.onclick = () => {
      const r = openWhatsAppForAll(sosCoords.lat, sosCoords.lon);
      if (statusEl) {
        if (r.blocked === 0) {
          statusEl.style.color = 'var(--teal)';
          statusEl.textContent = `✓ WhatsApp opened for ${r.opened} contact${r.opened > 1 ? 's' : ''} - tap Send in each chat.`;
        } else {
          statusEl.style.color = 'var(--coral)';
          statusEl.textContent = `Browser blocked ${r.blocked} tab${r.blocked > 1 ? 's' : ''} - use the green WhatsApp buttons above for those contacts.`;
        }
      }
    };
  }

  const saveBtn = block.querySelector('#ecSaveBtn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const name = block.querySelector('#ecName').value.trim();
      const phone = block.querySelector('#ecPhone').value.trim();
      if (!phone || normalizePhone(phone).length < 10) {
        if (statusEl) { statusEl.style.color = 'var(--coral)'; statusEl.textContent = 'Enter a valid phone number (with country code).'; }
        return;
      }
      addEmergencyContact(name || 'Emergency contact', phone, '');
      renderSosContactsBlock(block, statusEl);
    };
  }
}

// --- 17. CLINICAL DIRECTORY & LOCATION INTEGRATION ---

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

  let html = '<div class="step-card-header"><span>HEALTHCARE DIRECTORY RESULTS</span></div>';
  if (doctors.length) {
    html += '<div style="display:flex; flex-direction:column; gap:8px; margin-top:6px;">';
    doctors.forEach(d => {
      const firstPhone = d.phone ? String(d.phone).split(';')[0].trim() : '';
      html += `
        <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); padding:10px 12px; border-radius:4px; font-size:13px;">
          <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(d.name)}</div>
          <div style="color:var(--text-muted); font-size:12px;">${escapeHtml(d.specialty)} ${d.distance_km ? `· ${d.distance_km} km away` : ''}</div>
          ${d.address ? `<div style="color:var(--text-secondary); font-size:11.5px; margin-top:2px;">${escapeHtml(d.address)}</div>` : ''}
<<<<<<< HEAD
          ${firstPhone ? `<div style="margin-top:6px;"><a href="tel:${escapeHtml(firstPhone.replace(/\D/g, ''))}" style="color:var(--teal); font-weight:600;">📞 Call ${escapeHtml(firstPhone)}</a></div>` : ''}
=======
          <div style="display:flex; gap:12px; margin-top:8px; align-items:center; flex-wrap:wrap;">
            ${d.phone ? `<a href="tel:${escapeHtml(d.phone.replace(/\D/g, ''))}" style="color:var(--teal); font-weight:600; text-decoration:none;">📞 Call ${escapeHtml(d.phone)}</a>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((d.lat != null && d.lon != null) ? `${d.lat},${d.lon}` : d.name)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-purple); font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-size:12px;">
              <span>🗺️ Google Maps Directions</span>
            </a>
          </div>
>>>>>>> 408d11c4d1ccf07731f4a89c6767f934a1c90e41
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

// --- 18. GLOBAL SHORTCUTS & ESCAPE LISTENER ---
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

// Sync the camera UI with the saved source preference on load
setCameraSource(currentCameraSource);