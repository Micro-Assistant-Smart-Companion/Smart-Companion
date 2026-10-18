// [18/19] NEW health log: tabs, prescription upload, doctor PDF
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
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
  .hl2-tab{flex:1;min-width:84px;padding:10px 8px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;
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
function hlOpenPanel(startTab) {
  if (typeof toggleSidebar === 'function') toggleSidebar(false);
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  const box = document.createElement('div');
  box.className = 'settings-box hl2-box';
  overlay.appendChild(box); document.body.appendChild(overlay);

  let tab = typeof startTab === 'string' ? startTab : 'today';
  const TABS = [['today', '📝 Today'], ['conds', '🩺 Conditions'], ['meds', '💊 Medicines'], ['report', '📄 Doctor report'], ['card', '🆘 Emergency card'], ['backup', '💾 Backup']];
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
    ({ today: hlTabToday, conds: hlTabConds, meds: hlTabMeds, report: hlTabReport, card: hlTabCard, backup: hlTabBackup })[tab](body, () => { const y = body.scrollTop; shell(); box.querySelector('#hlBody').scrollTop = y; });
  }
  shell();
}

// the old Health Log button -> new panel (cloning removes the old click handler without editing old code)
(function hlRebindButton() {
  const old = document.getElementById('healthLogBtn');
  if (!old) return;
  const fresh = old.cloneNode(true);
  old.replaceWith(fresh);
  fresh.addEventListener('click', () => hlOpenPanel());
})();

// ---------- tab: today ----------
function hlTabToday(body, refresh) {
  body.innerHTML = `
    ${typeof bkNudgeHtml === 'function' ? bkNudgeHtml() : ''}
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

  const nudge = body.querySelector('#bkNudgeGo');
  if (nudge) nudge.onclick = () => { const t = document.querySelector('.hl2-tab[data-tab="backup"]'); if (t) t.click(); };
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
