// Dictate health readings by voice (English / Hindi / Bengali)

const VH_T = {
  en: {
    saved: 'Saved', undoHint: 'Say undo to remove it.', undone: 'Removed.', nothingUndo: 'There is nothing to undo.',
    bp: 'blood pressure', sugar: 'sugar', temp: 'temperature', weight: 'weight', pulse: 'pulse', spo2: 'oxygen', symptom: 'symptom',
    over: 'over', notCaught: 'I did not catch the numbers. Please say it again, for example: BP 120 over 80.',
    notSensible: 'That number does not look right. Please say it again.',
    urgent: 'That number is in a range where you should get medical help. If you feel unwell, call 108 now.',
    taken: 'Marked as taken', noDue: 'No medicine is waiting to be marked right now.', dose: 'dose',
    slot: { morning: 'morning', afternoon: 'afternoon', evening: 'evening', night: 'night' },
    none: 'nothing saved yet', last: 'Your latest', today: 'Medicines today', of: 'of', marked: 'marked as taken', empty: 'You have no readings saved yet.'
  },
  hi: {
    saved: 'सेव हो गया', undoHint: 'हटाने के लिए "वापस" बोलिए।', undone: 'हटा दिया।', nothingUndo: 'वापस करने के लिए कुछ नहीं है।',
    bp: 'ब्लड प्रेशर', sugar: 'शुगर', temp: 'तापमान', weight: 'वज़न', pulse: 'नाड़ी', spo2: 'ऑक्सीजन', symptom: 'लक्षण',
    over: 'बटा', notCaught: 'मुझे संख्याएँ समझ नहीं आईं। कृपया फिर से बोलिए, जैसे: बीपी 120 बटा 80।',
    notSensible: 'यह संख्या ठीक नहीं लग रही। कृपया फिर से बोलिए।',
    urgent: 'यह संख्या ऐसी है जिसमें आपको चिकित्सा मदद लेनी चाहिए। तबीयत ठीक न लगे तो अभी 108 पर कॉल करें।',
    taken: 'ले ली गई दवा दर्ज की', noDue: 'अभी कोई दवा दर्ज करने के लिए बाकी नहीं है।', dose: 'खुराक',
    slot: { morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम', night: 'रात' },
    none: 'अभी कुछ सेव नहीं है', last: 'आपकी ताज़ा', today: 'आज की दवाएँ', of: 'में से', marked: 'ली गई दर्ज', empty: 'अभी कोई रीडिंग सेव नहीं है।'
  },
  bn: {
    saved: 'সেভ হয়েছে', undoHint: 'সরাতে "মুছে ফেলো" বলুন।', undone: 'সরিয়ে দিয়েছি।', nothingUndo: 'ফিরিয়ে নেওয়ার মতো কিছু নেই।',
    bp: 'ব্লাড প্রেশার', sugar: 'সুগার', temp: 'তাপমাত্রা', weight: 'ওজন', pulse: 'নাড়ির গতি', spo2: 'অক্সিজেন', symptom: 'উপসর্গ',
    over: 'বাই', notCaught: 'আমি সংখ্যাগুলো বুঝতে পারিনি। আবার বলুন, যেমন: বিপি 120 বাই 80।',
    notSensible: 'এই সংখ্যাটি ঠিক মনে হচ্ছে না। আবার বলুন।',
    urgent: 'এই সংখ্যাটি এমন পরিসরে যেখানে চিকিৎসার সাহায্য নেওয়া উচিত। অসুস্থ লাগলে এখনই 108 নম্বরে ফোন করুন।',
    taken: 'খাওয়া ওষুধ নথিভুক্ত হয়েছে', noDue: 'এখন নথিভুক্ত করার মতো কোনো ওষুধ বাকি নেই।', dose: 'ডোজ',
    slot: { morning: 'সকাল', afternoon: 'দুপুর', evening: 'সন্ধ্যা', night: 'রাত' },
    none: 'এখনো কিছু সেভ নেই', last: 'আপনার সর্বশেষ', today: 'আজকের ওষুধ', of: 'এর মধ্যে', marked: 'খাওয়া হয়েছে', empty: 'এখনো কোনো রিডিং সেভ নেই।'
  }
};
const vhT = () => VH_T[(typeof currentLangCode === 'function' && currentLangCode()) || 'en'] || VH_T.en;

// ---------- reading the sentence ----------
function vhDigits(s) {          // Hindi and Bengali digits to 0-9
  return String(s).normalize('NFC').replace(/\u093C/g, '').replace(/[०-९]/g, d => '०१२३४५६७८९'.indexOf(d)).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
}
const VH_QUESTION = /\?|^(what|why|how|when|should|can|could|is|are|do|does|will)\b|^(क्या|क्यों|कैसे|कब|কি|কী|কেন|কীভাবে|কখন)(\s|$)/i;
const VH_KEY = {
  bp:     /\b(bp|blood pressure)\b|बीपी|ब्लड प्रेशर|रक्तचाप|বিপি|ব্লাড প্রেশার|প্রেশার/i,
  sugar:  /\b(sugar|glucose)\b|शुगर|ग्लूकोज|ग्लूकोस|সুগার|গ্লুকোজ/i,
  temp:   /\b(temperature|temp|fever)\b|तापमान|बुखार|তাপমাত্রা|জ্বর/i,
  weight: /\bweight\b|वजन|वजन|ওজন/i,
  pulse:  /\b(pulse|heart rate|heartbeat)\b|नाडी|पल्स|दिल की धडकन|পালস|নাড়ি|হার্টবিট/i,
  spo2:   /\b(oxygen|spo2|saturation)\b|ऑक्सीजन|অক্সিজেন/i
};
const VH_SYMPTOM = /^(symptom|symptoms|note)\b[\s:,-]*(.+)$|^(लक्षण|नोट)\b[\s:,-]*(.+)$|^(উপসর্গ|নোট)\b[\s:,-]*(.+)$/i;
const VH_TOOK = /\b(took|taken|had|ate|swallowed)\b.*\b(medicine|medicines|medication|tablet|tablets|pill|pills|dose|dosage)\b|\b(took|taken)\b\s+(my\s+)?\w+|(दवा|दवाई|गोली).*(ले ली|खा ली|खा लिया|ले लिया)|(ওষুধ).*(খেয়েছি|খেয়ে নিয়েছি|খেয়ে নিলাম)/i;
const VH_NOT = /\b(not|didn't|did not|haven't|have not|forgot|missed)\b|नहीं|ভুলে|খাইনি|নাই/i;
const VH_UNDO = /^(undo|remove that|delete that|cancel that|वापस|हटाओ|हटा दो|पूर्ववत|মুছে ফেলো|মুছে দাও|বাতিল)$/i;
const VH_READ = /(read|tell).*(my )?(readings?|health log|log)|my (last|latest) (reading|readings|bp|sugar)|मेरी (ताजा |आखिरी )?रीडिंग|आखिरी रीडिंग|আমার (সর্বশেষ |শেষ )?রিডিং|শেষ রিডিং/i;

function vhNums(s) { return (vhDigits(s).match(/\d+(?:\.\d+)?/g) || []).map(Number); }
const vhIn = (v, a, b) => v >= a && v <= b;

let vhLastSaved = null;     // what "undo" removes

// ---------- saving ----------
function vhSaveVital(type, value) {
  hlAddVital(type, value, '');
  const list = hlGet(HL.vitals, []);
  vhLastSaved = { kind: 'vital', id: list[0] && list[0].id };
}
function vhUndo() {
  const T = vhT();
  if (!vhLastSaved) return vfSay(T.nothingUndo, vfListen);
  if (vhLastSaved.kind === 'vital') hlSet(HL.vitals, hlGet(HL.vitals, []).filter(e => e.id !== vhLastSaved.id));
  else if (vhLastSaved.kind === 'dose') vhLastSaved.items.forEach(x => rmMark(x.medId, x.slot, null));
  vhLastSaved = null;
  setStatus(T.undone); setTimeout(() => setStatus(''), 3000);
  vfSay(T.undone, vfListen);
}
function vhConfirm(spoken, urgent) {
  const T = vhT();
  setStatus(`${T.saved}: ${spoken}`); setTimeout(() => setStatus(''), 5000);
  vfSay(`${T.saved}. ${spoken}. ${urgent ? T.urgent + ' ' : ''}${T.undoHint}`, vfListen);
}

// returns true when the sentence was handled here (so it is NOT sent to the assistant)
function vhTry(raw) {
  const T = vhT();
  const text = vhDigits(String(raw || '')).trim();
  if (!text || text.length > 140) return false;
  const low = text.toLowerCase().replace(/[.!।]+$/g, '').trim();
  if (VH_UNDO.test(low)) { vhUndo(); return true; }
  if (VH_READ.test(low)) { vhReadBack(); return true; }
  if (VH_QUESTION.test(low)) return false;

  const sym = low.match(VH_SYMPTOM);
  if (sym) {
    const body = (sym[2] || sym[4] || sym[6] || '').trim();
    if (body) { vhSaveVital('Symptom', body); vhConfirm(`${T.symptom}: ${body}`); return true; }
  }

  const n = vhNums(low);
  if (VH_KEY.bp.test(low)) {
    if (n.length < 2) { vfSay(T.notCaught, vfListen); return true; }
    const [s, d] = n;
    if (!(vhIn(s, 60, 260) && vhIn(d, 30, 160) && s > d)) { vfSay(T.notSensible, vfListen); return true; }
    vhSaveVital('BP', `${Math.round(s)}/${Math.round(d)}`);
    vhConfirm(`${T.bp} ${Math.round(s)} ${T.over} ${Math.round(d)}`, s >= 180 || d >= 120 || s < 80);
    return true;
  }
  const one = (key, label, lo, hi, type, unit, urgentFn) => {
    if (!VH_KEY[key].test(low)) return false;
    const v = n[0];
    if (v === undefined) { vfSay(T.notCaught, vfListen); return true; }
    if (!vhIn(v, lo, hi)) { vfSay(T.notSensible, vfListen); return true; }
    vhSaveVital(type, `${v}${unit}`);
    vhConfirm(`${label} ${v}`, urgentFn && urgentFn(v));
    return true;
  };
  if (one('sugar', T.sugar, 20, 600, 'Glucose', '', v => v < 54 || v > 400)) return true;
  if (VH_KEY.temp.test(low)) {
    const v = n[0];
    if (v === undefined) { vfSay(T.notCaught, vfListen); return true; }
    const f = vhIn(v, 90, 110), c = vhIn(v, 32, 43);
    if (!f && !c) { vfSay(T.notSensible, vfListen); return true; }
    const hot = f ? v >= 103 : v >= 39.5;
    vhSaveVital('Temperature', `${v} ${f ? '°F' : '°C'}`); vhConfirm(`${T.temp} ${v}`, hot); return true;
  }
  if (one('weight', T.weight, 20, 300, 'Weight', ' kg')) return true;
  if (one('pulse', T.pulse, 30, 220, 'Pulse', ' bpm', v => v < 40 || v > 150)) return true;
  if (one('spo2', T.spo2, 70, 100, 'SpO2', ' %', v => v < 90)) return true;

  if (VH_TOOK.test(low) && !VH_NOT.test(low)) return vhDoses(low);
  return false;
}

// "I took my medicine" or "I took metformin"
function vhDoses(low) {
  const T = vhT();
  if (typeof rmToday !== 'function') return false;
  const all = rmToday();
  const named = all.filter(x => low.includes(String(x.med.name).toLowerCase()));
  let items;
  if (named.length) { const open = named.filter(x => !x.status); items = open.length ? [open[0]] : []; }
  else {
    if (!/(medicine|medication|tablet|pill|dose|दवा|दवाई|गोली|ওষুধ)/i.test(low)) return false;   // "took a walk" is not a dose
    items = rmPending();
  }
  if (!items.length) { vfSay(T.noDue, vfListen); return true; }
  items.forEach(x => rmMark(x.med.id, x.slot, 'taken'));
  vhLastSaved = { kind: 'dose', items: items.map(x => ({ medId: x.med.id, slot: x.slot })) };
  const names = items.map(x => `${rmMedLabel(x.med)}, ${T.slot[x.slot]} ${T.dose}`).join('; ');
  vhConfirm(`${T.taken}: ${names}`);
  return true;
}

// "read my readings"
function vhReadBack() {
  const T = vhT(), parts = [];
  const bp = rmSeries('bp')[0], su = rmSeries('sugar')[0];
  const day = d => d.toLocaleDateString(({ en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN' })[currentLangCode()] || 'en-IN', { day: 'numeric', month: 'long' });
  if (bp) parts.push(`${T.last} ${T.bp}: ${bp.a} ${T.over} ${bp.b}, ${day(bp.t)}.`);
  if (su) parts.push(`${T.last} ${T.sugar}: ${Math.round(su.a)}, ${day(su.t)}.`);
  if (typeof rmToday === 'function') {
    const t = rmToday();
    if (t.length) parts.push(`${T.today}: ${t.filter(x => x.status === 'taken').length} ${T.of} ${t.length} ${T.marked}.`);
  }
  vfSay(parts.length ? parts.join(' ') : T.empty, vfListen);
}

// ---------- hook: in voice mode, every message passes here before the assistant ----------
const _vhOrigSend = sendMessage;
sendMessage = function (text) {
  if (vfOn && typeof text === 'string') {
    let handled = false;
    try { handled = vhTry(text); } catch (e) { console.error(e); }
    if (handled) return Promise.resolve();
  }
  return _vhOrigSend.apply(this, arguments);
};