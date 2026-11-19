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
  const isLab = /ref:|lab|report|p\.\d+/i.test(e.note || '') || /(haemo|wbc|rbc|platelet|hba1c|tsh|cholesterol|creatinine|bilirubin|sgpt|sgot|urea|lipid|electrolyte|calcium|vitamin|uric)/i.test(e.type || '');
  return { icon: isLab ? '🔬' : '📏', main: `${e.type}: ${e.value}`, sub: e.note };
}

// ---------- one-time CSS ----------
(function hlInjectStyles() {
  const st = document.createElement('style');
  st.textContent = `
  .hl2-box{max-width:560px;width:100%}
  .hl2-box.wide{max-width:820px;width:100%}
  .hl2-body{max-height:62vh;overflow-y:auto;padding:2px 2px 6px}
  .hl2-tabs{display:flex;gap:6px;margin:12px 0;flex-wrap:wrap}
  .hl2-tab{flex:1;min-width:84px;padding:10px 8px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;
    color:var(--text-secondary);font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit}
  .hl2-tab.on{background:var(--accent-purple-subtle,rgba(124,92,255,.14));color:var(--accent-purple,#7c5cff);border-color:var(--accent-purple,#7c5cff)}
  .hl2-upload-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
  @media(max-width:520px){
    .hl2-upload-grid{grid-template-columns:1fr !important}
    .hl2-box.wide{max-width:100% !important}
    .hl2-table-wrap{overflow-x:auto}
  }
  .hl2-upload{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;cursor:pointer;
    border:1.5px dashed var(--accent-purple,#7c5cff);background:var(--accent-purple-subtle,rgba(124,92,255,.08));color:var(--text-primary);font-size:14px;font-weight:600;min-height:56px}
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
  .hl2-badge-warn{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:999px;background:rgba(245,158,11,.15);color:#f59e0b;font-size:11px;font-weight:700;border:1px solid rgba(245,158,11,.3);white-space:nowrap}
  .hl2-badge-ok{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:999px;background:rgba(16,185,129,.15);color:var(--accent-mint,#10b981);font-size:11px;font-weight:700;border:1px solid rgba(16,185,129,.3);white-space:nowrap}
  .hl2-badge-reject{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:999px;background:rgba(244,63,94,.15);color:var(--coral,#f43f5e);font-size:11px;font-weight:700;border:1px solid rgba(244,63,94,.3);white-space:nowrap}
  .hl2-disclaimer{background:var(--bg-surface-elevated,var(--bg-subtle));border-left:3px solid var(--accent-purple,#7c5cff);padding:8px 12px;font-size:11.5px;color:var(--text-secondary);border-radius:4px;margin:8px 0;line-height:1.45}
  .hl2-med-card{border:1px solid var(--border-subtle);border-radius:10px;padding:12px;margin-bottom:10px;background:var(--bg-subtle);transition:opacity .2s,border-color .2s}
  .hl2-med-card.rejected{opacity:.55;border-color:rgba(244,63,94,.3)}
  .hl2-med-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px}
  .hl2-med-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .hl2-med-grid .full{grid-column:1/-1}
  .hl2-field-label{font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:2px;display:block}
  .hl2-table-wrap{max-height:55vh;overflow:auto;border:1px solid var(--border-subtle);border-radius:10px;margin:10px 0;background:var(--bg-subtle)}
  .hl2-table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}
  .hl2-table th{position:sticky;top:0;background:var(--bg-surface-elevated,#1e1e2d);color:var(--text-muted);font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;padding:9px 10px;border-bottom:1.5px solid var(--border-subtle);z-index:2}
  .hl2-table td{padding:8px 10px;border-bottom:1px solid var(--border-subtle);vertical-align:middle}
  .hl2-table tr:hover td{background:rgba(124,92,255,.04)}
  .hl2-table tr.rejected td{opacity:.5;background:rgba(244,63,94,.03)}
  .hl2-table input{padding:6px 9px;font-size:13px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--bg-surface-elevated,var(--bg-subtle));color:var(--text-primary);box-sizing:border-box}
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
      <div class="hl2-upload-grid">
        <label class="hl2-upload">
          <span style="font-size:24px">💊</span>
          <span id="hlUpText">Add from prescription
            <small>Find medicines & conditions</small></span>
          <input type="file" id="hlFile" accept="image/*,application/pdf" hidden>
        </label>
        <label class="hl2-upload">
          <span style="font-size:24px">🔬</span>
          <span id="hlRepUpText">Add from lab report
            <small>Extract test readings & ranges</small></span>
          <input type="file" id="hlReportFile" accept="image/*,application/pdf" hidden>
        </label>
      </div>
      <div class="hl2-hint" style="margin:6px 0 0">Documents are sent to the AI in memory only to extract text. Nothing is stored permanently on our server. Only your verified entries are kept on this device.</div>
      <div class="hl2-err" id="hlUpErr"></div>
      <div class="hl2-tabs">${TABS.map(([k, l]) => `<button type="button" class="hl2-tab ${k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="hl2-body" id="hlBody"></div>`;
    box.querySelector('#hlClose').onclick = close;
    box.querySelectorAll('.hl2-tab').forEach(b => b.onclick = () => { tab = b.dataset.tab; shell(); });
    box.querySelector('#hlFile').onchange = ev => {
      const f = ev.target.files[0];
      if (f) { hlUploadPrescription(f, box, shell); ev.target.value = ''; }
    };
    box.querySelector('#hlReportFile').onchange = ev => {
      const f = ev.target.files[0];
      if (f) { hlUploadMedicalReport(f, box, shell); ev.target.value = ''; }
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
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (await askConfirm({ title: 'Remove this condition?', message: 'It will be taken out of your Health Log and doctor report.', ok: 'Yes, remove', cancel: 'Keep it', danger: true })) { hlSet(HL.conds, list.filter(c => String(c.id) !== b.dataset.del)); refresh(); }
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
    <div class="hl2-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="hl2-card-title" style="margin-bottom:0">➕ Add a medicine</div>
        <label class="hl2-btn ghost small" style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;margin:0" title="Read brand name & strength from a photo of your medicine box or strip">
          <span>📷 Scan packaging photo</span>
          <input type="file" id="mdPhotoInput" accept="image/*" hidden>
        </label>
      </div>
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
  const photoInput = body.querySelector('#mdPhotoInput');
  if (photoInput) {
    photoInput.onchange = ev => {
      const f = ev.target.files[0];
      if (f) {
        hlScanMedicinePhoto(f, body);
        ev.target.value = '';
      }
    };
  }
  body.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
    const m = meds.find(x => String(x.id) === b.dataset.toggle); if (m) { m.active = !m.active; hlSet(HL.meds, meds); refresh(); }
  });
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (await askConfirm({ title: 'Delete this medicine?', message: 'It will be taken out of your medicine list.', ok: 'Yes, delete', cancel: 'Keep it', danger: true })) { hlSet(HL.meds, meds.filter(m => String(m.id) !== b.dataset.del)); refresh(); }
  });
}

// ---------- medicine packaging photo recognition ----------
async function hlScanMedicinePhoto(file, body) {
  const errEl = body.querySelector('#mdErr');
  if (errEl) errEl.innerHTML = '<span style="color:var(--accent-purple)">Scanning packaging photo… <small>(5–15s)</small></span>';

  try {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const res = await fetch(`${API}/recognize-medicine-photo`, { method: 'POST', body: fd });
    let data;
    try { data = await res.json(); } catch (_) { data = null; }

    if (!res.ok || !data || !data.ok) {
      const msg = (data && (data.message || data.detail)) || 'Could not recognize packaging text. Please ensure clear lighting.';
      if (errEl) errEl.textContent = msg;
      return;
    }
    if (errEl) errEl.textContent = '';
    hlReviewMedicinePhoto(data, body);
  } catch (e) {
    if (errEl) errEl.textContent = 'Could not reach server to scan medicine packaging. Please try again.';
  }
}

function hlReviewMedicinePhoto(data, body) {
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active';
  overlay.style.zIndex = '1002';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const box = document.createElement('div');
  box.className = 'settings-box hl2-box';
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const brand = data.brand_name || '';
  const generic = data.generic_name || '';
  const strength = data.strength || '';
  const formulation = data.formulation || '';
  const isUnc = Boolean(data.is_uncertain);
  const uncR = data.uncertainty_reason || '';

  box.innerHTML = `
    <div class="dialog-header">
      <div class="dialog-title-group">
        <div class="dialog-badge">PACKAGING IDENTIFICATION · UNCONFIRMED</div>
        <div class="dialog-title">Medicine Packaging Details</div>
      </div>
      <button type="button" class="dialog-close-btn" id="pkgClose" aria-label="Close">✕</button>
    </div>

    <div class="hl2-disclaimer">
      <b>Safety Notice:</b> ${hlEsc(data.disclaimer || 'Visual scan reads visible package text only. It does not establish authenticity or suitability. Never take medicines without consulting a doctor.')}
    </div>

    <p class="hl2-hint" style="margin:6px 0 10px">
      Compare with your physical medicine packaging. Check brand and active generic names carefully.
    </p>

    <div class="hl2-card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text-primary)">
            ${hlEsc(brand || '(Brand name unreadable)')}
          </div>
          ${generic ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:2px"><b>Composition:</b> ${hlEsc(generic)}</div>` : ''}
        </div>
        ${isUnc
          ? `<span class="hl2-badge-warn" title="${hlEsc(uncR || 'Uncertain')}">⚠️ Review</span>`
          : `<span class="hl2-badge-ok">✓ Readable</span>`}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12.5px;color:var(--text-secondary);margin-top:8px">
        <div><b>Strength:</b> ${hlEsc(strength || '-')}</div>
        <div><b>Form:</b> ${hlEsc(formulation || '-')}</div>
        <div><b>Manufacturer:</b> ${hlEsc(data.manufacturer || '-')}</div>
        <div><b>Expiry:</b> ${hlEsc(data.expiry_date || '-')}</div>
      </div>

      ${isUnc && uncR ? `<div style="font-size:11.5px;color:#f59e0b;margin-top:8px">⚠️ <b>Note:</b> ${hlEsc(uncR)}</div>` : ''}

      ${data.raw_visible_text ? `
        <details class="hl2-more" style="margin-top:10px">
          <summary>Show all text read on package</summary>
          <div style="font-size:11.5px;background:var(--bg-surface-elevated,rgba(0,0,0,.08));padding:8px;border-radius:6px;white-space:pre-wrap;margin-top:4px">${hlEsc(data.raw_visible_text)}</div>
        </details>` : ''}
    </div>

    <div class="hl2-row">
      <button class="hl2-btn ghost" id="pkgDismiss" type="button">Dismiss</button>
      <button class="hl2-btn" id="pkgUse" type="button">Use to fill form</button>
    </div>`;

  const closeDialog = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };
  const onKeyDown = e => { if (e.key === 'Escape') closeDialog(); };
  document.addEventListener('keydown', onKeyDown);
  overlay.onclick = e => { if (e.target === overlay) closeDialog(); };
  box.querySelector('#pkgClose').onclick = closeDialog;
  box.querySelector('#pkgDismiss').onclick = closeDialog;

  box.querySelector('#pkgUse').onclick = () => {
    const nameInput = body.querySelector('#mdName');
    const doseInput = body.querySelector('#mdDose');
    const noteInput = body.querySelector('#mdNote');

    if (nameInput) nameInput.value = brand || generic || '';
    if (doseInput) doseInput.value = strength || '';
    if (noteInput && generic && generic !== brand) {
      noteInput.value = `Generic: ${generic}`;
    }

    closeDialog();
    hlToast('Packaging details copied to form for your review');
    if (nameInput) nameInput.focus();
  };
}

// ---------- prescription upload + review ----------
async function hlUploadPrescription(file, box, refresh) {
  const errEl = box.querySelector('#hlUpErr'), txt = box.querySelector('#hlUpText');
  if (errEl) errEl.textContent = '';
  const origHtml = txt ? txt.innerHTML : '';
  if (txt) txt.innerHTML = 'Reading prescription… <small>Extracting medicines & conditions (10–25s)…</small>';
  try {
    const fd = new FormData(); fd.append('file', file, file.name);
    const res = await fetch(`${API}/extract-prescription`, { method: 'POST', body: fd });
    let data;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok) {
      const msg = (data && (data.message || data.detail)) || 'Could not process prescription document.';
      if (errEl) errEl.textContent = msg;
      if (txt) txt.innerHTML = origHtml;
      return;
    }
    if (!data || !data.ok) {
      if (errEl) errEl.textContent = (data && data.message) || 'I could not read any medicines or conditions from that prescription.';
      if (txt) txt.innerHTML = origHtml;
      return;
    }
    if (txt) txt.innerHTML = origHtml;
    hlReviewPrescription(data, refresh);
  } catch (e) {
    if (errEl) errEl.textContent = 'Could not reach the server. Check your connection and try again.';
    if (txt) txt.innerHTML = origHtml;
  }
}

// ---------- medical lab report upload + review ----------
async function hlUploadMedicalReport(file, box, refresh) {
  const errEl = box.querySelector('#hlUpErr'), txt = box.querySelector('#hlRepUpText');
  if (errEl) errEl.textContent = '';
  const origHtml = txt ? txt.innerHTML : '';
  if (txt) txt.innerHTML = 'Reading lab report… <small>Extracting test results (10–25s)…</small>';
  try {
    const fd = new FormData(); fd.append('file', file, file.name);
    const res = await fetch(`${API}/extract-medical-report`, { method: 'POST', body: fd });
    let data;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok) {
      const msg = (data && (data.message || data.detail)) || 'Could not process medical report.';
      if (errEl) errEl.textContent = msg;
      if (txt) txt.innerHTML = origHtml;
      return;
    }
    if (!data || !data.ok) {
      if (errEl) errEl.textContent = (data && data.message) || 'I could not read any laboratory results from that report.';
      if (txt) txt.innerHTML = origHtml;
      return;
    }
    if (txt) txt.innerHTML = origHtml;
    hlReviewMedicalReport(data, refresh);
  } catch (e) {
    if (errEl) errEl.textContent = 'Could not reach the server. Check your connection and try again.';
    if (txt) txt.innerHTML = origHtml;
  }
}

function hlReviewPrescription(data, refresh) {
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active'; overlay.style.zIndex = '1001';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  const box = document.createElement('div'); box.className = 'settings-box hl2-box wide';
  overlay.appendChild(box); document.body.appendChild(overlay);

  const meds = Array.isArray(data.medicines) ? [...data.medicines] : [];
  const conds = Array.isArray(data.conditions) ? [...data.conditions] : [];

  const metaParts = [];
  if (data.doctor) metaParts.push('👨‍⚕️ ' + data.doctor);
  if (data.date) metaParts.push('📅 ' + data.date);

  box.innerHTML = `
    <div class="dialog-header">
      <div class="dialog-title-group">
        <div class="dialog-badge">CHECK BEFORE SAVING · PRESCRIPTION</div>
        <div class="dialog-title">Review Extracted Prescription</div>
      </div>
      <button type="button" class="dialog-close-btn" id="rvClose" aria-label="Close">✕</button>
    </div>

    ${metaParts.length ? `<div class="meta" style="font-size:13px;margin:8px 0 4px"><b>${hlEsc(metaParts.join(' · '))}</b></div>` : ''}

    <p class="hl2-hint" style="margin-top:6px">
      Compare with your printed or written prescription. AI can make mistakes with handwriting.
      Untick anything wrong, correct spelling, or remove erroneous items. Only checked items will be saved to your Health Log.
    </p>

    <div class="hl2-body" id="rvBody">
      ${conds.length ? `
        <div class="hl2-sub">CONDITIONS WRITTEN ON PRESCRIPTION (${conds.length})</div>
        <div id="rvCondsList">
          ${conds.map((c, i) => `
            <div class="hl2-check" data-cond-row="${i}">
              <input type="checkbox" checked data-cond="${i}" id="chkCond_${i}" aria-label="Keep condition">
              <div style="display:flex;gap:8px;align-items:center;width:100%">
                <input value="${hlEsc(typeof c === 'string' ? c : (c.name || ''))}" data-cname="${i}" placeholder="Condition name" aria-label="Condition name">
                <button type="button" class="hl2-btn ghost small danger" data-del-cond="${i}" title="Remove condition" aria-label="Remove">✕</button>
              </div>
            </div>`).join('')}
        </div>` : ''}

      <div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 6px">
        <div class="hl2-sub" style="margin:0">MEDICINES DETECTED (${meds.length})</div>
        <div style="display:flex;gap:6px">
          <button type="button" class="hl2-btn ghost small" id="rvApproveAllMeds">Approve all</button>
          <button type="button" class="hl2-btn ghost small" id="rvRejectAllMeds">Reject all</button>
          <button type="button" class="hl2-btn ghost small" id="rvAddMedBtn">+ Add medicine</button>
        </div>
      </div>

      <div id="rvMedsList">
        ${meds.length ? meds.map((m, i) => {
          const isUnc = Boolean(m.is_uncertain);
          const uncR = m.uncertainty_reason || '';
          const brand = m.brand_name || '';
          const generic = m.generic_name || '';
          const strength = m.strength || '';
          const dosage = m.dosage || '';
          const freq = m.frequency || '';
          const dur = m.duration || '';
          const instr = m.instructions || m.notes || '';
          const page = m.page ? `Page ${m.page}` : '';

          return `
          <div class="hl2-med-card" data-med-card="${i}">
            <div class="hl2-med-header">
              <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;font-size:13.5px">
                <input type="checkbox" checked data-med="${i}" id="chkMed_${i}" style="width:18px;height:18px">
                <span class="rv-status-label" data-status-lbl="${i}">Approved</span>
              </label>
              <div style="display:flex;gap:6px;align-items:center">
                ${page ? `<span class="hl2-tag">${hlEsc(page)}</span>` : ''}
                ${isUnc ? `<span class="hl2-badge-warn" title="${hlEsc(uncR || 'Handwriting unclear')}">⚠️ Review</span>` : `<span class="hl2-badge-ok">✓ High confidence</span>`}
                <button type="button" class="hl2-btn ghost small danger" data-del-med="${i}" title="Remove entry" aria-label="Remove medicine">✕</button>
              </div>
            </div>

            ${isUnc && uncR ? `<div style="font-size:11.5px;color:#f59e0b;margin-bottom:8px">⚠️ <b>Handwriting note:</b> ${hlEsc(uncR)}</div>` : ''}

            <div class="hl2-med-grid">
              <div class="full">
                <label class="hl2-field-label">Medicine name *</label>
                <input value="${hlEsc(m.name || '')}" data-f="name" placeholder="e.g. Paracetamol" required aria-label="Medicine name">
              </div>
              <div>
                <label class="hl2-field-label">Brand name (if written)</label>
                <input value="${hlEsc(brand)}" data-f="brand" placeholder="e.g. Calpol" aria-label="Brand name">
              </div>
              <div>
                <label class="hl2-field-label">Generic name (if written)</label>
                <input value="${hlEsc(generic)}" data-f="generic" placeholder="e.g. Paracetamol" aria-label="Generic name">
              </div>
              <div>
                <label class="hl2-field-label">Strength</label>
                <input value="${hlEsc(strength)}" data-f="strength" placeholder="e.g. 500 mg" aria-label="Strength">
              </div>
              <div>
                <label class="hl2-field-label">Dosage</label>
                <input value="${hlEsc(dosage)}" data-f="dosage" placeholder="e.g. 1 tablet" aria-label="Dosage">
              </div>
              <div>
                <label class="hl2-field-label">Frequency (how often)</label>
                <input value="${hlEsc(freq)}" list="hl2freq" data-f="frequency" placeholder="e.g. 1-0-1 or Twice daily" aria-label="Frequency">
              </div>
              <div>
                <label class="hl2-field-label">Duration</label>
                <input value="${hlEsc(dur)}" data-f="duration" placeholder="e.g. 5 days" aria-label="Duration">
              </div>
              <div class="full">
                <label class="hl2-field-label">Instructions / Notes</label>
                <input value="${hlEsc(instr)}" data-f="instructions" placeholder="e.g. After food with water" aria-label="Instructions">
              </div>
            </div>
          </div>`;
        }).join('') : '<div class="hl2-hint">No medicines were detected on this prescription. You can add one manually using the button above.</div>'}
      </div>
    </div>

    <div class="hl2-row" style="margin-top:14px">
      <button class="hl2-btn ghost" id="rvCancel" type="button">Cancel</button>
      <button class="hl2-btn" id="rvSave" type="button">Save Approved to Health Log</button>
    </div>`;

  const closeDialog = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };
  const onKeyDown = e => { if (e.key === 'Escape') closeDialog(); };
  document.addEventListener('keydown', onKeyDown);
  overlay.onclick = e => { if (e.target === overlay) closeDialog(); };
  box.querySelector('#rvClose').onclick = closeDialog;
  box.querySelector('#rvCancel').onclick = closeDialog;

  // Approve all / reject all
  box.querySelector('#rvApproveAllMeds').onclick = () => {
    box.querySelectorAll('[data-med-card]').forEach(card => {
      const chk = card.querySelector('input[type="checkbox"][data-med]');
      if (chk) chk.checked = true;
      card.classList.remove('rejected');
      const lbl = card.querySelector('.rv-status-label');
      if (lbl) lbl.textContent = 'Approved';
    });
  };
  box.querySelector('#rvRejectAllMeds').onclick = () => {
    box.querySelectorAll('[data-med-card]').forEach(card => {
      const chk = card.querySelector('input[type="checkbox"][data-med]');
      if (chk) chk.checked = false;
      card.classList.add('rejected');
      const lbl = card.querySelector('.rv-status-label');
      if (lbl) lbl.textContent = 'Rejected';
    });
  };

  // Wire per-medicine card events
  box.querySelectorAll('[data-med-card]').forEach(card => {
    const chk = card.querySelector('input[type="checkbox"][data-med]');
    const i = chk ? chk.dataset.med : '';
    if (chk) {
      chk.onchange = () => {
        const lbl = card.querySelector(`[data-status-lbl="${i}"]`);
        if (chk.checked) {
          card.classList.remove('rejected');
          if (lbl) lbl.textContent = 'Approved';
        } else {
          card.classList.add('rejected');
          if (lbl) lbl.textContent = 'Rejected';
        }
      };
    }
    const delBtn = card.querySelector(`[data-del-med="${i}"]`);
    if (delBtn) delBtn.onclick = () => card.remove();
  });

  // Wire condition delete buttons
  box.querySelectorAll('[data-del-cond]').forEach(btn => {
    btn.onclick = () => {
      const row = box.querySelector(`[data-cond-row="${btn.dataset.delCond}"]`);
      if (row) row.remove();
    };
  });

  // Add custom medicine button
  box.querySelector('#rvAddMedBtn').onclick = () => {
    const list = box.querySelector('#rvMedsList');
    const hint = list.querySelector('.hl2-hint');
    if (hint) hint.remove();

    const idx = Date.now();
    const card = document.createElement('div');
    card.className = 'hl2-med-card';
    card.setAttribute('data-med-card', String(idx));
    card.innerHTML = `
      <div class="hl2-med-header">
        <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;font-size:13.5px">
          <input type="checkbox" checked data-med="${idx}" id="chkMed_${idx}" style="width:18px;height:18px">
          <span class="rv-status-label" data-status-lbl="${idx}">Approved</span>
        </label>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="hl2-badge-ok">Manual entry</span>
          <button type="button" class="hl2-btn ghost small danger" data-del-med="${idx}" title="Remove entry" aria-label="Remove medicine">✕</button>
        </div>
      </div>
      <div class="hl2-med-grid">
        <div class="full">
          <label class="hl2-field-label">Medicine name *</label>
          <input value="" data-f="name" placeholder="e.g. Metformin" required aria-label="Medicine name">
        </div>
        <div>
          <label class="hl2-field-label">Brand name</label>
          <input value="" data-f="brand" placeholder="e.g. Glycomet" aria-label="Brand name">
        </div>
        <div>
          <label class="hl2-field-label">Generic name</label>
          <input value="" data-f="generic" placeholder="e.g. Metformin" aria-label="Generic name">
        </div>
        <div>
          <label class="hl2-field-label">Strength</label>
          <input value="" data-f="strength" placeholder="e.g. 500 mg" aria-label="Strength">
        </div>
        <div>
          <label class="hl2-field-label">Dosage</label>
          <input value="" data-f="dosage" placeholder="e.g. 1 tablet" aria-label="Dosage">
        </div>
        <div>
          <label class="hl2-field-label">Frequency (how often)</label>
          <input value="" list="hl2freq" data-f="frequency" placeholder="e.g. 1-0-1 or Twice daily" aria-label="Frequency">
        </div>
        <div>
          <label class="hl2-field-label">Duration</label>
          <input value="" data-f="duration" placeholder="e.g. 1 month" aria-label="Duration">
        </div>
        <div class="full">
          <label class="hl2-field-label">Instructions / Notes</label>
          <input value="" data-f="instructions" placeholder="e.g. After food" aria-label="Instructions">
        </div>
      </div>`;
    list.appendChild(card);

    card.querySelector(`[data-del-med="${idx}"]`).onclick = () => card.remove();
    const chk = card.querySelector(`[data-med="${idx}"]`);
    chk.onchange = () => {
      const lbl = card.querySelector(`[data-status-lbl="${idx}"]`);
      if (chk.checked) {
        card.classList.remove('rejected');
        if (lbl) lbl.textContent = 'Approved';
      } else {
        card.classList.add('rejected');
        if (lbl) lbl.textContent = 'Rejected';
      }
    };
    card.querySelector('input[data-f="name"]').focus();
  };

  // Save approved entries
  box.querySelector('#rvSave').onclick = () => {
    const now = new Date().toISOString();
    const conds = hlGet(HL.conds, []);
    const meds = hlMeds();
    let addedC = 0, skippedC = 0;
    let addedM = 0, skippedM = 0;

    // Conditions
    box.querySelectorAll('[data-cond-row]').forEach(row => {
      const cb = row.querySelector('[data-cond]');
      if (!cb || !cb.checked) return;
      const input = row.querySelector('[data-cname]');
      const name = input ? input.value.trim() : '';
      if (!name) return;
      if (conds.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        skippedC++;
        return;
      }
      conds.unshift({
        id: Date.now() + addedC,
        name,
        note: data.date ? `Prescription ${data.date}` : '',
        source: 'prescription',
        addedAt: now
      });
      addedC++;
    });

    // Medicines
    box.querySelectorAll('[data-med-card]').forEach(card => {
      const cb = card.querySelector('[data-med]');
      if (!cb || !cb.checked) return;

      const getVal = f => (card.querySelector(`[data-f="${f}"]`)?.value || '').trim();
      const name = getVal('name');
      if (!name) return;

      const brand = getVal('brand');
      const generic = getVal('generic');
      const strength = getVal('strength');
      const dosage = getVal('dosage');
      const frequency = getVal('frequency');
      const duration = getVal('duration');
      const instructions = getVal('instructions');

      const dose = [strength, dosage].filter(Boolean).join(' - ') || strength || dosage || '';

      const isDuplicate = meds.some(m =>
        m.name.trim().toLowerCase() === name.toLowerCase() &&
        (m.dose || '').trim().toLowerCase() === dose.toLowerCase()
      );

      if (isDuplicate) {
        skippedM++;
        return;
      }

      meds.unshift({
        id: Date.now() + 100 + addedM,
        name,
        brand_name: brand,
        generic_name: generic,
        strength,
        dosage,
        dose,
        frequency,
        duration,
        notes: instructions,
        instructions,
        active: true,
        source: 'prescription',
        doctor: data.doctor || '',
        prescribed: data.date || '',
        addedAt: now
      });
      addedM++;
    });

    if (addedC > 0) hlSet(HL.conds, conds);
    if (addedM > 0) hlSet(HL.meds, meds);

    closeDialog();

    const parts = [];
    if (addedM > 0) parts.push(`${addedM} medicine${addedM === 1 ? '' : 's'}`);
    if (addedC > 0) parts.push(`${addedC} condition${addedC === 1 ? '' : 's'}`);
    const dupParts = [];
    if (skippedM > 0) dupParts.push(`${skippedM} duplicate med`);
    if (skippedC > 0) dupParts.push(`${skippedC} duplicate cond`);
    const dupStr = dupParts.length ? ` (${dupParts.join(', ')} skipped)` : '';

    if (parts.length > 0) {
      hlToast(`Saved ${parts.join(' and ')}${dupStr} to Health Log ✓`);
    } else if (dupParts.length > 0) {
      hlToast(`All selected items already exist in your Health Log.`);
    } else {
      hlToast(`No medicines or conditions were selected to save.`);
    }
    refresh();
  };
}

function hlReviewMedicalReport(data, refresh) {
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active'; overlay.style.zIndex = '1001';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  const box = document.createElement('div'); box.className = 'settings-box hl2-box wide';
  overlay.appendChild(box); document.body.appendChild(overlay);

  const tests = Array.isArray(data.test_results) ? [...data.test_results] : [];
  const metaParts = [];
  if (data.lab_name) metaParts.push('🏥 ' + data.lab_name);
  if (data.report_date) metaParts.push('📅 ' + data.report_date);
  if (data.patient_name) metaParts.push('👤 ' + data.patient_name);
  if (data.total_pages) metaParts.push(`📄 ${data.total_pages} page(s) (${data.pages_digital || 0} digital, ${data.pages_scanned || 0} scanned)`);

  box.innerHTML = `
    <div class="dialog-header">
      <div class="dialog-title-group">
        <div class="dialog-badge">LABORATORY REPORT REVIEW · PRIVATE</div>
        <div class="dialog-title">Review Extracted Test Results</div>
      </div>
      <button type="button" class="dialog-close-btn" id="rvRepClose" aria-label="Close">✕</button>
    </div>

    <div class="hl2-disclaimer">
      <b>Medical Notice:</b> ${hlEsc(data.disclaimer || 'This information was extracted by an automated vision/language tool for reference purposes only. It is not a clinical diagnosis or medical evaluation. Please review and verify all readings before saving.')}
    </div>

    ${metaParts.length ? `<div class="meta" style="font-size:12.5px;margin:4px 0 8px"><b>${hlEsc(metaParts.join(' · '))}</b></div>` : ''}

    <p class="hl2-hint" style="margin:4px 0 10px">
      Compare each value with your printed laboratory report. AI can make mistakes with formatting or numbers.
      Untick any test you do not want to record, fix any readings, and remove unwanted lines. Only checked tests will be saved to your Health Log.
    </p>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 6px;flex-wrap:wrap;gap:6px">
      <div class="hl2-sub" style="margin:0">TEST RESULTS (${tests.length})</div>
      <div style="display:flex;gap:6px">
        <button type="button" class="hl2-btn ghost small" id="rvRepApproveAll">Approve all</button>
        <button type="button" class="hl2-btn ghost small" id="rvRepRejectAll">Reject all</button>
        <button type="button" class="hl2-btn ghost small" id="rvRepAddRow">+ Add test</button>
      </div>
    </div>

    <div class="hl2-table-wrap">
      <table class="hl2-table" id="rvRepTable" role="table" aria-label="Extracted laboratory test results">
        <thead>
          <tr>
            <th style="width:40px;text-align:center" scope="col">Keep</th>
            <th style="min-width:140px" scope="col">Test Name</th>
            <th style="min-width:90px" scope="col">Observed Reading</th>
            <th style="min-width:70px" scope="col">Unit</th>
            <th style="min-width:100px" scope="col">Reference Range</th>
            <th style="width:55px;text-align:center" scope="col">Page</th>
            <th style="width:80px" scope="col">Status</th>
            <th style="width:40px;text-align:center" scope="col"></th>
          </tr>
        </thead>
        <tbody id="rvRepTbody">
          ${tests.length ? tests.map((t, i) => {
            const isUnc = Boolean(t.is_uncertain);
            const uncR = t.uncertainty_reason || '';
            const readingVal = t.observed_reading != null ? String(t.observed_reading) : '';
            return `
            <tr data-rep-row="${i}">
              <td style="text-align:center">
                <input type="checkbox" checked data-rep-chk="${i}" id="chkRep_${i}" aria-label="Keep test ${hlEsc(t.test_name || '')}">
              </td>
              <td>
                <input value="${hlEsc(t.test_name || '')}" data-f="name" placeholder="e.g. Haemoglobin" style="width:100%" required aria-label="Test name">
              </td>
              <td>
                <input value="${hlEsc(readingVal)}" data-f="val" placeholder="e.g. 13.5" style="width:100%" required aria-label="Observed reading">
              </td>
              <td>
                <input value="${hlEsc(t.unit || '')}" data-f="unit" placeholder="e.g. g/dL" style="width:100%" aria-label="Unit">
              </td>
              <td>
                <input value="${hlEsc(t.reference_range || '')}" data-f="range" placeholder="e.g. 12.0 - 15.0" style="width:100%" aria-label="Reference range">
              </td>
              <td style="font-size:12px;color:var(--text-muted);text-align:center">
                ${t.page_number ? `<span class="hl2-tag">P.${t.page_number}</span>` : '-'}
              </td>
              <td>
                ${isUnc ? `<span class="hl2-badge-warn" title="${hlEsc(uncR || 'Uncertain')}">⚠️ Check</span>` : `<span class="hl2-badge-ok">✓ Ready</span>`}
              </td>
              <td style="text-align:center">
                <button type="button" class="hl2-btn ghost small danger" data-del-rep="${i}" title="Remove row" aria-label="Remove">✕</button>
              </td>
            </tr>`;
          }).join('') : `
            <tr>
              <td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">
                No laboratory tests were detected. Click "+ Add test" to enter readings manually.
              </td>
            </tr>`}
        </tbody>
      </table>
    </div>

    <div class="hl2-row" style="margin-top:14px">
      <button class="hl2-btn ghost" id="rvRepCancel" type="button">Cancel</button>
      <button class="hl2-btn" id="rvRepSave" type="button">Save Approved to Health Log</button>
    </div>`;

  const closeDialog = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };
  const onKeyDown = e => { if (e.key === 'Escape') closeDialog(); };
  document.addEventListener('keydown', onKeyDown);
  overlay.onclick = e => { if (e.target === overlay) closeDialog(); };
  box.querySelector('#rvRepClose').onclick = closeDialog;
  box.querySelector('#rvRepCancel').onclick = closeDialog;

  // Approve all / Reject all
  box.querySelector('#rvRepApproveAll').onclick = () => {
    box.querySelectorAll('#rvRepTbody tr[data-rep-row]').forEach(tr => {
      const chk = tr.querySelector('[data-rep-chk]');
      if (chk) { chk.checked = true; tr.classList.remove('rejected'); }
    });
  };
  box.querySelector('#rvRepRejectAll').onclick = () => {
    box.querySelectorAll('#rvRepTbody tr[data-rep-row]').forEach(tr => {
      const chk = tr.querySelector('[data-rep-chk]');
      if (chk) { chk.checked = false; tr.classList.add('rejected'); }
    });
  };

  // Wire row checkbox and delete
  box.querySelectorAll('#rvRepTbody tr[data-rep-row]').forEach(tr => {
    const chk = tr.querySelector('[data-rep-chk]');
    if (chk) {
      chk.onchange = () => {
        if (chk.checked) tr.classList.remove('rejected');
        else tr.classList.add('rejected');
      };
    }
    const del = tr.querySelector('[data-del-rep]');
    if (del) del.onclick = () => tr.remove();
  });

  // Add custom test row
  box.querySelector('#rvRepAddRow').onclick = () => {
    const tbody = box.querySelector('#rvRepTbody');
    const emptyRow = tbody.querySelector('td[colspan]');
    if (emptyRow) emptyRow.parentElement.remove();

    const idx = Date.now();
    const tr = document.createElement('tr');
    tr.setAttribute('data-rep-row', String(idx));
    tr.innerHTML = `
      <td style="text-align:center">
        <input type="checkbox" checked data-rep-chk="${idx}" aria-label="Keep test result">
      </td>
      <td>
        <input value="" data-f="name" placeholder="e.g. Haemoglobin" style="width:100%" required aria-label="Test name">
      </td>
      <td>
        <input value="" data-f="val" placeholder="e.g. 13.5" style="width:100%" required aria-label="Observed reading">
      </td>
      <td>
        <input value="" data-f="unit" placeholder="e.g. g/dL" style="width:100%" aria-label="Unit">
      </td>
      <td>
        <input value="" data-f="range" placeholder="e.g. 12.0 - 15.0" style="width:100%" aria-label="Reference range">
      </td>
      <td style="font-size:12px;color:var(--text-muted);text-align:center">Manual</td>
      <td><span class="hl2-badge-ok">Manual</span></td>
      <td style="text-align:center">
        <button type="button" class="hl2-btn ghost small danger" data-del-rep="${idx}" title="Remove row" aria-label="Remove">✕</button>
      </td>`;
    tbody.appendChild(tr);

    tr.querySelector('[data-del-rep]').onclick = () => tr.remove();
    const chk = tr.querySelector('[data-rep-chk]');
    chk.onchange = () => {
      if (chk.checked) tr.classList.remove('rejected');
      else tr.classList.add('rejected');
    };
    tr.querySelector('input[data-f="name"]').focus();
  };

  // Save approved tests to companion_health_log
  box.querySelector('#rvRepSave').onclick = () => {
    const rows = box.querySelectorAll('#rvRepTbody tr[data-rep-row]');
    const vitals = hlGet(HL.vitals, []);
    let addedCount = 0;
    let skippedCount = 0;
    const now = new Date().toISOString();

    rows.forEach(tr => {
      const chk = tr.querySelector('[data-rep-chk]');
      if (!chk || !chk.checked) return;

      const name = (tr.querySelector('[data-f="name"]')?.value || '').trim();
      const val = (tr.querySelector('[data-f="val"]')?.value || '').trim();
      const unit = (tr.querySelector('[data-f="unit"]')?.value || '').trim();
      const range = (tr.querySelector('[data-f="range"]')?.value || '').trim();

      if (!name || val === '') return;

      let valueToSave;
      if (HL_IS_SUGAR(name) && unit.toLowerCase() === 'mg/dl') {
        valueToSave = val;
      } else if (unit && !val.toLowerCase().includes(unit.toLowerCase())) {
        valueToSave = `${val} ${unit}`;
      } else {
        valueToSave = val;
      }

      const noteParts = [];
      if (range) noteParts.push('Ref: ' + range);
      if (data.lab_name) noteParts.push(data.lab_name);
      if (data.report_date) noteParts.push('Report date: ' + data.report_date);
      const noteToSave = noteParts.join(' · ');

      const isDuplicate = vitals.some(v =>
        v.type.toLowerCase() === name.toLowerCase() &&
        String(v.value).toLowerCase() === String(valueToSave).toLowerCase() &&
        (noteToSave ? (v.note || '').toLowerCase() === noteToSave.toLowerCase() : true)
      );

      if (isDuplicate) {
        skippedCount++;
        return;
      }

      vitals.unshift({
        id: Date.now() + addedCount,
        type: name,
        value: String(valueToSave),
        note: noteToSave,
        timestamp: now
      });
      addedCount++;
    });

    if (addedCount > 0) {
      hlSet(HL.vitals, vitals);
    }

    closeDialog();

    const msg = addedCount > 0
      ? `Saved ${addedCount} test reading${addedCount === 1 ? '' : 's'}${skippedCount ? ` (${skippedCount} duplicate skipped)` : ''} to Health Log ✓`
      : (skippedCount > 0 ? `${skippedCount} duplicate reading${skippedCount === 1 ? '' : 's'} already in Health Log.` : 'No test results were selected to save.');
    hlToast(msg);
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
  if (ot.length) { const c = capped(rev(ot), 40); h += H2('Other measurements & lab tests') + table(['Date', 'Test / Measurement', 'Value', 'Reference / Note'], c.rows.map(e => [hlDate(e.timestamp, true), hlEsc(e.type), hlEsc(e.value), hlEsc(e.note || '-')])) + c.note; }
  if (!bp.length && !sg.length && !sy.length && !ot.length) h += H2('Readings') + `<div style="color:#666">No readings were logged in this period.</div>`;

  h += `<div style="margin-top:22px;padding-top:8px;border-top:1px solid #ccc;font-size:10.5px;color:#666">Recorded by the patient in the Smart Companion app. This is a self-kept log to help the conversation with the doctor. Medicine names were entered or confirmed by the patient, so please check them against the prescription. It is not a medical record and it is not a diagnosis.</div></div>`;
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
 