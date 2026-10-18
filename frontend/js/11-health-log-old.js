// [11/19] OLD health log (kept only for its helper functions; the new panel is file 18)
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
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
