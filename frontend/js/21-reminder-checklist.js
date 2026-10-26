// [21/21] medicine reminders, the daily check-in, and gentle patterns in the person's own entries
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
//
// Everything stays on this device. Nothing here talks to the server.
// Safety rule: this file never says what to take, never explains a medicine, and never calls a reading
// "dangerous". It only repeats the schedule the person already has and describes their own numbers.

const RM_LOG = 'companion_dose_log';              // [{id, medId, date, slot, status: 'taken'|'skipped', at}]
const RM_PREFS = 'companion_reminder_prefs';      // {times:{morning:'08:00',...}, checkin:true, notify:false}
const RM_LAST = 'companion_checkin_last';         // this device only (not backed up or synced)
const RM_SLOTS = ['morning', 'afternoon', 'evening', 'night'];
const RM_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };
const RM_TIMES = { morning: '08:00', afternoon: '13:00', evening: '18:00', night: '21:00' };
const RM_DAY_MS = 86400000;

const rmPad = n => String(n).padStart(2, '0');
function rmDay(d) { d = d || new Date(); return `${d.getFullYear()}-${rmPad(d.getMonth() + 1)}-${rmPad(d.getDate())}`; }
function rmPrefs() {
  const p = hlGet(RM_PREFS, {}) || {};
  return { times: Object.assign({}, RM_TIMES, p.times || {}), checkin: p.checkin !== false, notify: !!p.notify };
}
function rmSavePrefs(p) { hlSet(RM_PREFS, p); }
function rmFirstName() { const n = String((hlGet(HL.profile, {}) || {}).name || '').trim().split(/\s+/)[0]; return n; }

// ---------- when does each medicine need to be taken? (read from the "How often" text) ----------
function rmSlotsFor(freq, notes) {
  const f = String(freq || '').trim().toLowerCase(), both = (f + ' ' + String(notes || '').toLowerCase());
  let m = f.match(/^(\d)\s*[-–]\s*(\d)\s*[-–]\s*(\d)(?:\s*[-–]\s*(\d))?$/);
  if (m) {
    const names = m[4] !== undefined ? ['morning', 'afternoon', 'evening', 'night'] : ['morning', 'afternoon', 'night'];
    return names.filter((_, i) => Number(m[i + 1]) > 0);
  }
  m = f.match(/^(\d)\s*[-–]\s*(\d)$/);
  if (m) return ['morning', 'night'].filter((_, i) => Number(m[i + 1]) > 0);
  if (/\b(sos|prn|as needed|when needed|if needed|weekly|alternate|once a week|monthly)\b/.test(f)) return [];
  if (/\b(four times|4 times|qid)\b/.test(f)) return ['morning', 'afternoon', 'evening', 'night'];
  if (/\b(thrice|three times|3 times|tds|tid)\b/.test(f)) return ['morning', 'afternoon', 'night'];
  if (/\b(twice|two times|2 times|bd|bid)\b/.test(f)) return ['morning', 'night'];
  if (/\b(night|bedtime|hs|before sleep)\b/.test(both)) return ['night'];
  if (/\bevening\b/.test(both)) return ['evening'];
  if (/\b(afternoon|lunch)\b/.test(both)) return ['afternoon'];
  if (/\b(morning|breakfast)\b/.test(both)) return ['morning'];
  if (/\b(once|daily|od|1 time|one time|every day|each day|per day)\b/.test(f)) return ['morning'];
  return [];       // unknown wording: do not nag
}
function rmEnded(m) {   // "5 days" from the day it was added
  const d = String(m.duration || '').toLowerCase().match(/(\d+)\s*(day|week|month)/);
  if (!d || !m.addedAt) return false;
  const days = Number(d[1]) * (d[2] === 'week' ? 7 : d[2] === 'month' ? 30 : 1);
  return Date.now() > new Date(m.addedAt).getTime() + days * RM_DAY_MS;
}
function rmScheduled() {
  return hlMeds().filter(m => m.active && !rmEnded(m)).map(m => ({ med: m, slots: rmSlotsFor(m.frequency, m.notes) })).filter(x => x.slots.length);
}

// ---------- the dose log ----------
function rmStatus(medId, slot, day) {
  const l = hlGet(RM_LOG, []).find(x => String(x.medId) === String(medId) && x.slot === slot && x.date === (day || rmDay()));
  return l ? l.status : null;
}
function rmMark(medId, slot, status) {         // status null = undo
  const day = rmDay();
  let log = hlGet(RM_LOG, []).filter(x => !(String(x.medId) === String(medId) && x.slot === slot && x.date === day));
  if (status) log.push({ id: `${medId}|${day}|${slot}`, medId, date: day, slot, status, at: new Date().toISOString() });
  const cut = rmDay(new Date(Date.now() - 120 * RM_DAY_MS));
  hlSet(RM_LOG, log.filter(x => x.date >= cut));
}
function rmDueMs(slot) {
  const [h, mi] = rmPrefs().times[slot].split(':').map(Number);
  const d = new Date(); d.setHours(h, mi, 0, 0); return d.getTime();
}
// today's doses: [{med, slot, dueMs, status}]
function rmToday() {
  const out = [];
  rmScheduled().forEach(({ med, slots }) => slots.forEach(slot => out.push({ med, slot, dueMs: rmDueMs(slot), status: rmStatus(med.id, slot) })));
  return out.sort((a, b) => a.dueMs - b.dueMs);
}
const rmPending = () => rmToday().filter(x => !x.status && x.dueMs <= Date.now());
const rmMedLabel = m => m.name + (m.dose ? ' ' + m.dose : '');

// ---------- readings ----------
function rmSeries(kind) {      // newest first
  return hlGet(HL.vitals, []).filter(e => kind === 'bp' ? HL_IS_BP(e.type) : HL_IS_SUGAR(e.type)).map(e => {
    const t = new Date(e.timestamp); if (isNaN(t)) return null;
    if (kind === 'bp') { const m = String(e.value).match(/(\d{2,3})\s*[\/\-]\s*(\d{2,3})/); return m ? { t, a: +m[1], b: +m[2] } : null; }
    const v = parseFloat(e.value); return isFinite(v) ? { t, a: v } : null;
  }).filter(Boolean).sort((x, y) => y.t - x.t);
}
function rmHabit(kind) {       // has the person been logging this regularly, but not yet today?
  const s = rmSeries(kind), today = rmDay(), since = Date.now() - 14 * RM_DAY_MS;
  const days = new Set(s.filter(x => x.t.getTime() >= since).map(x => rmDay(x.t)));
  return days.size >= 3 && !days.has(today);
}
const rmAvg = arr => arr.reduce((p, c) => p + c, 0) / arr.length;
const rmDayName = d => d.toLocaleDateString('en-IN', { weekday: 'short' });
const rmShow = (kind, x) => kind === 'bp' ? `${x.a}/${x.b}` : `${Math.round(x.a)} mg/dL`;

// ---------- patterns in the person's own entries (plain description only) ----------
function rmInsights() {
  const out = [];
  const now = Date.now();
  ['bp', 'glucose'].forEach(kind => {
    const s = rmSeries(kind), name = kind === 'bp' ? 'blood pressure' : 'glucose';
    if (!s.length) return;
    // 1. latest reading compared with the person's own usual
    const latest = s[0], base = s.slice(1).filter(x => now - x.t.getTime() <= 30 * RM_DAY_MS).slice(0, 14);
    if (now - latest.t.getTime() <= 3 * RM_DAY_MS && base.length >= 4) {
      const ma = rmAvg(base.map(x => x.a)), mb = kind === 'bp' ? rmAvg(base.map(x => x.b)) : 0;
      const diffA = latest.a - ma, diffB = kind === 'bp' ? latest.b - mb : 0;
      const off = kind === 'bp' ? (Math.abs(diffA) >= 12 || Math.abs(diffB) >= 8) : (Math.abs(diffA) / ma >= 0.2);
      if (off) {
        const lower = kind === 'bp' ? (diffA + diffB < 0) : diffA < 0;
        const usual = kind === 'bp' ? `${Math.round(ma)}/${Math.round(mb)}` : `${Math.round(ma)} mg/dL`;
        out.push({ k: 'off', text: `Your last ${name} reading (${rmShow(kind, latest)}, ${rmDayName(latest.t)}) was ${lower ? 'lower' : 'higher'} than your usual, which is about ${usual}.` });
      }
    }
    // 2. this week: lowest and highest day
    const wk = s.filter(x => now - x.t.getTime() <= 7 * RM_DAY_MS);
    if (wk.length >= 3) {
      const lo = wk.reduce((p, c) => c.a < p.a ? c : p), hi = wk.reduce((p, c) => c.a > p.a ? c : p);
      if (lo !== hi && rmDay(lo.t) !== rmDay(hi.t)) out.push({ k: 'range', text: `This week your ${name} was lowest on ${rmDayName(lo.t)} (${rmShow(kind, lo)}) and highest on ${rmDayName(hi.t)} (${rmShow(kind, hi)}).` });
    }
    // 3. days all medicines were marked as taken, compared with other days
    const sched = rmScheduled(); if (!sched.length) return;
    const expected = sched.reduce((n, x) => n + x.slots.length, 0), log = hlGet(RM_LOG, []);
    const byDay = {}; log.forEach(l => { (byDay[l.date] = byDay[l.date] || []).push(l); });
    const good = [], other = [];
    const perDay = {}; s.filter(x => now - x.t.getTime() <= 30 * RM_DAY_MS).forEach(x => { (perDay[rmDay(x.t)] = perDay[rmDay(x.t)] || []).push(x); });
    Object.keys(perDay).forEach(day => {
      const l = byDay[day]; if (!l) return;
      const taken = l.filter(x => x.status === 'taken').length, avg = { a: rmAvg(perDay[day].map(x => x.a)), b: kind === 'bp' ? rmAvg(perDay[day].map(x => x.b)) : 0 };
      (taken >= expected ? good : other).push(avg);
    });
    if (good.length >= 3 && other.length >= 3) {
      const ga = rmAvg(good.map(x => x.a)), oa = rmAvg(other.map(x => x.a));
      const big = kind === 'bp' ? Math.abs(ga - oa) >= 8 : Math.abs(ga - oa) / oa >= 0.15;
      if (big) {
        const f = (arr) => kind === 'bp' ? `${Math.round(rmAvg(arr.map(x => x.a)))}/${Math.round(rmAvg(arr.map(x => x.b)))}` : `${Math.round(rmAvg(arr.map(x => x.a)))} mg/dL`;
        out.push({ k: 'link', text: `On days you marked all your medicines as taken, your ${name} averaged ${f(good)}. On days when some were not marked as taken, it averaged ${f(other)}.` });
      }
    }
  });
  // 4. doses marked this week
  const days7 = []; for (let i = 0; i < 7; i++) days7.push(rmDay(new Date(now - i * RM_DAY_MS)));
  const log7 = hlGet(RM_LOG, []).filter(l => days7.includes(l.date));
  const exp = rmScheduled().reduce((n, x) => n + x.slots.length, 0);
  if (exp && log7.length) {
    const first = log7.map(l => l.date).sort()[0], span = Math.min(7, Math.round((now - new Date(first + 'T00:00:00').getTime()) / RM_DAY_MS) + 1);
    const taken = log7.filter(l => l.status === 'taken').length;
    out.push({ k: 'week', text: `You marked ${taken} of ${exp * span} doses as taken in the last ${span} day${span === 1 ? '' : 's'}.` });
  }
  const order = ['off', 'link', 'week', 'range'];
  return out.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k)).slice(0, 3);
}

// =====================================================================
//  The pieces of the screen
// =====================================================================
function rmDoseRow(item, onChange) {
  const row = document.createElement('div'); row.className = 'pf-dose';
  const render = () => {
    const st = rmStatus(item.med.id, item.slot);
    row.className = 'pf-dose' + (st ? ' done ' + st : '');
    row.innerHTML = `<div class="pf-dose-name"><span class="pf-dose-ic">💊</span><span><b>${hlEsc(rmMedLabel(item.med))}</b><small>${RM_LABEL[item.slot]} dose</small></span></div>` +
      (st ? `<div class="pf-dose-state">${st === 'taken' ? '✓ Taken' : 'Skipped'} <button type="button" class="pf-link" data-s="">Undo</button></div>`
        : `<div class="pf-dose-btns"><button type="button" class="pf-btn pf-btn-main" data-s="taken">Taken</button><button type="button" class="pf-btn pf-btn-ghost" data-s="skipped">Skip</button></div>`);
    row.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { rmMark(item.med.id, item.slot, b.dataset.s || null); render(); onChange && onChange(); });
  };
  render(); return row;
}

function rmQuickLog(kind, onSave) {
  const box = document.createElement('div'); box.className = 'pf-quick';
  if (kind === 'glucose') {
    box.innerHTML = `<label for="ckGlu">What is your glucose today?</label><div class="pf-quick-row"><input id="ckGlu" type="number" inputmode="decimal" placeholder="mg/dL, for example 110"><button type="button" class="pf-btn pf-btn-main" id="ckGluSave">Save</button></div><div class="pf-quick-msg" role="status"></div>`;
    box.querySelector('#ckGluSave').onclick = () => {
      const v = parseFloat(box.querySelector('#ckGlu').value), msg = box.querySelector('.pf-quick-msg');
      if (!(v >= 20 && v <= 600)) { msg.className = 'pf-quick-msg err'; msg.textContent = 'Please type a number between 20 and 600.'; return; }
      hlAddVital('Glucose', v, ''); msg.className = 'pf-quick-msg ok'; msg.textContent = 'Saved'; box.querySelector('#ckGluSave').disabled = true; onSave && onSave();
    };
  } else {
    box.innerHTML = `<label for="ckSys">What is your blood pressure today?</label><div class="pf-quick-row"><input id="ckSys" type="number" inputmode="numeric" placeholder="Upper, e.g. 120"><span class="pf-slash">/</span><input id="ckDia" type="number" inputmode="numeric" placeholder="Lower, e.g. 80"><button type="button" class="pf-btn pf-btn-main" id="ckBpSave">Save</button></div><div class="pf-quick-msg" role="status"></div>`;
    box.querySelector('#ckBpSave').onclick = () => {
      const s = parseFloat(box.querySelector('#ckSys').value), d = parseFloat(box.querySelector('#ckDia').value), msg = box.querySelector('.pf-quick-msg');
      if (!(s >= 60 && s <= 260 && d >= 30 && d <= 160 && s > d)) { msg.className = 'pf-quick-msg err'; msg.textContent = 'Please check the two numbers (upper first, then lower).'; return; }
      hlAddVital('BP', `${Math.round(s)}/${Math.round(d)}`, ''); msg.className = 'pf-quick-msg ok'; msg.textContent = 'Saved'; box.querySelector('#ckBpSave').disabled = true; onSave && onSave();
    };
  }
  return box;
}

// =====================================================================
//  The check-in that appears when the app opens
// =====================================================================
function rmCheckin(force) {
  if (document.getElementById('rmCheckin') || document.getElementById('wcOverlay') || document.getElementById('accOverlay')) return false;
  const pending = rmPending(), askGlu = rmHabit('glucose'), askBp = rmHabit('bp'), insights = rmInsights();
  if (!force && !pending.length && !askGlu && !askBp && !insights.length) return false;

  const h = new Date().getHours(), hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening', nm = rmFirstName();
  const ov = document.createElement('div'); ov.className = 'pf-ci-overlay'; ov.id = 'rmCheckin';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'ckT');
  ov.innerHTML = `<div class="pf-checkin">
    <div class="pf-ci-head"><div class="pf-ci-ic">🩺</div><div class="pf-ci-hd"><h2 id="ckT">${hello}${nm ? ', ' + hlEsc(nm) : ''}</h2><p>A quick check-in</p></div>
      <button type="button" class="dialog-close-btn" id="ckX" aria-label="Close">✕</button></div>
    <div class="pf-ci-body" id="ckBody"></div>
    <div class="pf-ci-foot"><button type="button" class="pf-btn pf-btn-ghost" id="ckLater">Remind me later</button><button type="button" class="pf-btn pf-btn-main" id="ckDone">Done</button></div></div>`;
  const body = ov.querySelector('#ckBody');

  if (pending.length) {
    const sec = document.createElement('section'); sec.innerHTML = `<h3>Have you taken your medicines?</h3>`;
    pending.forEach(it => sec.appendChild(rmDoseRow(it)));
    body.appendChild(sec);
  }
  if (askGlu || askBp) {
    const sec = document.createElement('section'); sec.innerHTML = `<h3>Today's readings</h3>`;
    if (askBp) sec.appendChild(rmQuickLog('bp'));
    if (askGlu) sec.appendChild(rmQuickLog('glucose'));
    body.appendChild(sec);
  }
  if (insights.length) {
    const sec = document.createElement('section'); sec.className = 'pf-insights';
    sec.innerHTML = `<h3>Patterns in your own entries</h3>` + insights.map(i => `<div class="pf-insight"><span class="pf-ins-ic">📏</span><p>${hlEsc(i.text)}</p></div>`).join('') +
      `<p class="pf-ci-note">These are only patterns in what you entered, not medical advice. If you feel unwell, or a change worries you, please tell your doctor${insights.some(i => i.k === 'off') ? ' or someone near you' : ''}.</p>`;
    body.appendChild(sec);
  }
  if (!body.children.length) body.innerHTML = `<section><p class="pf-ci-note" style="font-size:16px">Nothing needs your attention right now. You are all caught up.</p></section>`;

  const close = (laterHours) => {
    document.removeEventListener('keydown', onKey, true);
    try { localStorage.setItem(RM_LAST, String(Date.now() - (laterHours ? (3 - laterHours) * 3600000 : 0))); } catch (e) {}
    ov.remove();
  };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  ov.querySelector('#ckX').onclick = () => close(); ov.querySelector('#ckDone').onclick = () => close();
  ov.querySelector('#ckLater').onclick = () => close(1);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.body.appendChild(ov);
  const first = ov.querySelector('.pf-dose .pf-btn-main, .pf-quick input, #ckDone'); first && first.focus();
  return true;
}
function rmAutoCheckin() {
  if (!rmPrefs().checkin || document.getElementById('pfSplash')) return;
  let last = 0; try { last = Number(localStorage.getItem(RM_LAST)) || 0; } catch (e) {}
  if (Date.now() - last < 3 * 3600000) return;           // at most once every 3 hours
  rmCheckin(false);
}

// =====================================================================
//  Reminders while the app is open: a banner (and a notification if allowed and the tab is hidden)
// =====================================================================
function rmSS(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; }
function rmBanner(slot, items) {
  const old = document.getElementById('rmBanner'); if (old) old.remove();
  const b = document.createElement('div'); b.id = 'rmBanner'; b.className = 'pf-remind'; b.setAttribute('role', 'alert');
  b.innerHTML = `<div class="pf-remind-ic">⏰</div><div class="pf-remind-tx"><b>Time for your ${RM_LABEL[slot].toLowerCase()} medicines</b><span>${hlEsc(items.map(x => rmMedLabel(x.med)).join(', '))}</span></div>
    <div class="pf-remind-btns"><button type="button" class="pf-btn pf-btn-main" data-a="all">Taken</button><button type="button" class="pf-btn pf-btn-ghost" data-a="later">Later</button></div>`;
  b.querySelector('[data-a=all]').onclick = () => { items.forEach(x => rmMark(x.med.id, slot, 'taken')); b.remove(); if (typeof showToast === 'function') showToast('Marked as taken', true); };
  b.querySelector('[data-a=later]').onclick = () => { rmSS('rm-snooze-' + rmDay() + slot, String(Date.now() + 15 * 60000)); b.remove(); };
  document.body.appendChild(b);
}
function rmNotify(slot, items) {
  try {
    const n = new Notification(`Time for your ${RM_LABEL[slot].toLowerCase()} medicines`, { body: items.map(x => rmMedLabel(x.med)).join(', ') + '. Open Smart Companion to mark them as taken.', tag: 'rm-' + slot, icon: 'logo.png' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (e) {}
}
function rmTick() {
  if (document.getElementById('rmCheckin') || document.getElementById('pfSplash') || document.getElementById('wcOverlay') || document.getElementById('accOverlay')) return;
  const now = Date.now(), p = rmPrefs();
  RM_SLOTS.forEach(slot => {
    const items = rmToday().filter(x => x.slot === slot && !x.status && x.dueMs <= now && now < x.dueMs + 120 * 60000);
    if (!items.length) return;
    const key = 'rm-n-' + rmDay() + slot, count = Number(rmSS(key) || 0), snooze = Number(rmSS('rm-snooze-' + rmDay() + slot) || 0);
    if (now < snooze || count >= 4) return;
    rmSS(key, String(count + 1)); rmSS('rm-snooze-' + rmDay() + slot, String(now + 15 * 60000));    // next nudge in 15 minutes
    if (document.hidden && p.notify && window.Notification && Notification.permission === 'granted') rmNotify(slot, items);
    else if (!document.hidden) rmBanner(slot, items);
  });
}

// =====================================================================
//  Phone calendar file (.ics): the phone itself rings, even when the app is closed
// =====================================================================
function rmIcsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function rmIcs() {
  const sched = rmScheduled(), p = rmPrefs(), now = new Date();
  const stamp = d => `${d.getFullYear()}${rmPad(d.getMonth() + 1)}${rmPad(d.getDate())}T${rmPad(d.getHours())}${rmPad(d.getMinutes())}00`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Smart Companion//Medicine reminders//EN', 'CALSCALE:GREGORIAN'];
  let events = 0;
  RM_SLOTS.forEach(slot => {
    const meds = sched.filter(x => x.slots.includes(slot)).map(x => x.med); if (!meds.length) return;
    const [h, mi] = p.times[slot].split(':').map(Number);
    const start = new Date(); start.setHours(h, mi, 0, 0); if (start < now) start.setDate(start.getDate() + 1);
    const end = new Date(start.getTime() + 10 * 60000);
    // how many days: the longest course, or 90 days when no end date is known
    const left = meds.map(m => { const d = String(m.duration || '').toLowerCase().match(/(\d+)\s*(day|week|month)/); if (!d || !m.addedAt) return 90; const days = Number(d[1]) * (d[2] === 'week' ? 7 : d[2] === 'month' ? 30 : 1); return Math.max(1, Math.ceil((new Date(m.addedAt).getTime() + days * RM_DAY_MS - start.getTime()) / RM_DAY_MS)); });
    const count = Math.min(365, Math.max(...left));
    lines.push('BEGIN:VEVENT', `UID:sc-${slot}-${Date.now()}@smart-companion`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      `RRULE:FREQ=DAILY;COUNT=${count}`, `SUMMARY:${rmIcsEscape('Medicines: ' + meds.map(rmMedLabel).join(', '))}`,
      `DESCRIPTION:${rmIcsEscape('Time for your ' + RM_LABEL[slot].toLowerCase() + ' medicines. Open Smart Companion to mark them as taken.')}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Medicine time', 'END:VALARM', 'END:VEVENT'); events++;
  });
  lines.push('END:VCALENDAR');
  return events ? lines.join('\r\n') + '\r\n' : '';
}

// =====================================================================
//  Cards added to the Health Log: "Today" shows today's doses, "Medicines" holds the reminder settings
// =====================================================================
function rmTodayCard(body, refresh) {
  const items = rmToday(); if (!items.length) return;
  const card = document.createElement('div'); card.className = 'hl2-card';
  card.innerHTML = `<div class="hl2-card-title">💊 Today's medicines</div>`;
  RM_SLOTS.forEach(slot => {
    const g = items.filter(x => x.slot === slot); if (!g.length) return;
    const t = document.createElement('div'); t.className = 'pf-slot-head'; t.textContent = `${RM_LABEL[slot]} · ${rmPrefs().times[slot]}`; card.appendChild(t);
    g.forEach(it => card.appendChild(rmDoseRow(it)));
  });
  body.insertBefore(card, body.firstChild);
}
function rmSettingsCard(body) {
  const p = rmPrefs(), sched = rmScheduled();
  const card = document.createElement('div'); card.className = 'hl2-card'; card.id = 'rmSettings';
  const notifOk = !!window.Notification, perm = notifOk ? Notification.permission : 'denied';
  card.innerHTML = `<div class="hl2-card-title">⏰ Reminders</div>
    <p class="hl2-hint">${sched.length ? 'I read the times from "How often" (for example 1-0-1 or twice a day). Change the clock times below if they do not suit you.' : 'Add a medicine with "How often" (for example 1-0-1) and reminders will appear here.'}</p>
    <div class="pf-times">${RM_SLOTS.map(s => `<label>${RM_LABEL[s]}<input type="time" data-slot="${s}" value="${hlEsc(p.times[s])}"></label>`).join('')}</div>
    <label class="pf-check"><input type="checkbox" id="rmCheckinOn" ${p.checkin ? 'checked' : ''}><span>Show a quick check-in when I open the app</span></label>
    <div class="hl2-sub">WHEN THE APP IS CLOSED</div>
    <p class="hl2-hint">A website cannot ring by itself when it is closed. The most reliable way is your phone's own calendar. This adds a repeating alarm for each medicine time. The file stays on your phone.</p>
    <button type="button" class="hl2-btn wide" id="rmIcs" ${sched.length ? '' : 'disabled'}>📅 Add to my phone calendar</button>
    <p class="hl2-hint" style="margin-top:10px">${notifOk ? (perm === 'granted' ? 'Notifications are on. They show while the app is open in a tab or installed on your phone.' : perm === 'denied' ? 'Notifications are blocked in this browser. You can allow them in the browser settings.' : 'Notifications can also remind you while the app is open in a tab or installed on your phone.') : 'This browser cannot show notifications.'}</p>
    ${notifOk && perm === 'default' ? '<button type="button" class="hl2-btn ghost wide" id="rmNotif">🔔 Turn on notifications</button>' : ''}
    <div class="hl2-err" id="rmMsg" role="status"></div>`;
  body.appendChild(card);
  card.querySelectorAll('input[type=time]').forEach(i => i.onchange = () => { const q = rmPrefs(); if (i.value) q.times[i.dataset.slot] = i.value; rmSavePrefs(q); });
  card.querySelector('#rmCheckinOn').onchange = e => { const q = rmPrefs(); q.checkin = e.target.checked; rmSavePrefs(q); };
  card.querySelector('#rmIcs').onclick = () => {
    const ics = rmIcs(), msg = card.querySelector('#rmMsg');
    if (!ics) { msg.className = 'hl2-err'; msg.textContent = 'No medicine times found yet.'; return; }
    bkDownload(new Blob([ics], { type: 'text/calendar' }), 'smart-companion-medicine-reminders.ics');
    msg.className = 'hl2-ok'; msg.textContent = '✓ Downloaded. Open the file on your phone and choose to add it to your calendar. It repeats for the length of your course, or 90 days.';
  };
  const nb = card.querySelector('#rmNotif');
  if (nb) nb.onclick = async () => { try { const r = await Notification.requestPermission(); const q = rmPrefs(); q.notify = r === 'granted'; rmSavePrefs(q); } catch (e) {} const par = card.parentNode; card.remove(); rmSettingsCard(par); };
}

// wrap the two Health Log tabs (they are looked up by name each time a tab opens)
(function rmHook() {
  if (typeof hlTabToday === 'function') {
    const orig = hlTabToday;
    hlTabToday = function (body, refresh) { orig(body, refresh); rmTodayCard(body, refresh); };
  }
  if (typeof hlTabMeds === 'function') {
    const orig = hlTabMeds;
    hlTabMeds = function (body, refresh) { orig(body, refresh); rmSettingsCard(body); };
  }
})();

// start: a gentle check-in once the app (and the loading screen) is ready, then watch the clock
(function rmStart() {
  const go = () => { setTimeout(rmAutoCheckin, 900); setInterval(rmTick, 30000); setTimeout(rmTick, 2500); };
  if (window.__pfPending) window.addEventListener('pf:backend-ready', () => setTimeout(go, 900), { once: true });
  else go();
})();