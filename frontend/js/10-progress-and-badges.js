// [10/19] streaks, badges, growth panel
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
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
