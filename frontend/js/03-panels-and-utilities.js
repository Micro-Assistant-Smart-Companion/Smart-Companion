// [03/19] side panel, small helper functions, input box behaviour
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
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
