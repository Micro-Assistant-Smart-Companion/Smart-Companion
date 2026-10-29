// Guided voice setup: medicines, conditions, how I feel, emergency card, doctor report (English / Hindi / Bengali)

const VG_T = {
  en: {
    again: 'I did not hear you.', timeout: 'Okay, I will stop here. Nothing was saved. Say the command again whenever you like.',
    cancelled: 'Okay, cancelled. Nothing was saved.', yn: 'Please say yes or no.', right: 'Is that right? Say yes or no.', heard: 'I heard',
    skipHint: 'Or say skip.', no: 'no', skip: 'skip',
    medName: 'Which medicine do you want to add? Say its name.', medDose: 'What is the dose, for example 500 milligram? Or say skip.',
    medFreq: 'How often do you take it? For example once a day in the morning, once a day at night, twice a day, three times a day, or only when needed.',
    medDur: 'For how many days? For example 5 days, or say always.', medDup: 'is already in your list.',
    medSave: 'Add this medicine?', medSaved: 'Saved. Reminders will follow the times in your settings.', always: 'ongoing', for: 'for',
    cdName: 'Which health condition do you want to add? For example migraine or diabetes.', cdNote: 'Any note, for example since when? Or say skip.',
    cdSaved: 'Saved the condition', cdDup: 'is already in your list.',
    fl: 'How are you feeling today? Say good, okay, or not well. Or describe it in your own words.',
    flIssue: 'Do you have any problem today, like a headache or pain? Say it, or say no.',
    flSaved: 'Saved. You feel', flIssueSaved: 'Saved the problem', flUnwell: 'If you feel very unwell, call 108 now.',
    good: 'Good', okay: 'Okay', unwell: 'Not well',
    ecIntro: 'Let us fill your emergency card. Say skip for anything you want to leave out.',
    ecName: 'What is your full name?', ecAge: 'How old are you?', ecBlood: 'What is your blood group? For example O positive.',
    ecAllergy: 'Do you have any allergies? Say them, or say skip.', ecNotes: 'Is there anything a helper must know, for example you have diabetes? Say it, or say skip.',
    ecContact: 'Do you want to add an emergency contact? Say yes or no.', ecCName: 'What is the contact person\'s name?',
    ecPhone: 'Say their phone number, digit by digit.', ecPhoneBad: 'I could not get a phone number from that.', digits: 'I heard the number',
    ecSaved: 'Your emergency card is saved. Your conditions and medicines are added from your lists.', ecContactSaved: 'Contact saved',
    repName: 'Your card is for', age: 'years old', blood: 'blood group',
    sumNone: 'Your health summary is empty so far.', conds: 'Conditions', meds: 'Medicines', allergies: 'Allergies', bp: 'Latest blood pressure', sugar: 'Latest sugar',
    feeling: 'Latest feeling', noMeds: 'You have no medicines saved.', medsAre: 'Your medicines are', oneDay: 'once a day', night: 'at night', morning: 'in the morning',
    pdfWait: 'Making your report. It will be saved in your Downloads folder.', pdfDone: 'Your report is downloaded. Say read my summary to hear it.', pdfFail: 'I could not make the report. Please check the internet connection once and try again.',
    help: 'You can say: add medicine. Add condition. How I feel. Emergency card. Read my summary. Read my medicines. Download my report. Or a reading like BP 120 over 80, sugar 110, or I took my medicine. Say undo to remove the last thing saved. Say stop to cancel.'
  },
  hi: {
    again: 'मैंने सुना नहीं।', timeout: 'ठीक है, मैं यहीं रुकता हूँ। कुछ सेव नहीं हुआ। जब चाहें दोबारा कमांड बोलिए।',
    cancelled: 'ठीक है, रद्द किया। कुछ सेव नहीं हुआ।', yn: 'कृपया हाँ या नहीं बोलिए।', right: 'क्या यह सही है? हाँ या नहीं बोलिए।', heard: 'मैंने सुना',
    skipHint: 'या छोड़ो बोलिए।', no: 'नहीं', skip: 'छोड़ो',
    medName: 'कौन सी दवा जोड़नी है? उसका नाम बोलिए।', medDose: 'खुराक कितनी है, जैसे 500 मिलीग्राम? या छोड़ो बोलिए।',
    medFreq: 'यह कितनी बार लेनी है? जैसे सुबह एक बार, रात को एक बार, दिन में दो बार, दिन में तीन बार, या ज़रूरत पड़ने पर।',
    medDur: 'कितने दिनों के लिए? जैसे 5 दिन, या हमेशा बोलिए।', medDup: 'पहले से आपकी सूची में है।',
    medSave: 'क्या यह दवा जोड़ दूँ?', medSaved: 'सेव हो गया। रिमाइंडर आपकी सेटिंग के समय पर आएँगे।', always: 'लगातार', for: 'के लिए', forAfter: true,
    cdName: 'कौन सी बीमारी जोड़नी है? जैसे माइग्रेन या डायबिटीज़।', cdNote: 'कोई नोट, जैसे कब से? या छोड़ो बोलिए।',
    cdSaved: 'बीमारी सेव हो गई', cdDup: 'पहले से आपकी सूची में है।',
    fl: 'आज आप कैसा महसूस कर रहे हैं? अच्छा, ठीक, या तबीयत ठीक नहीं बोलिए। या अपने शब्दों में बताइए।',
    flIssue: 'क्या आज कोई परेशानी है, जैसे सिरदर्द या दर्द? बताइए, या नहीं बोलिए।',
    flSaved: 'सेव हो गया। आप महसूस कर रहे हैं', flIssueSaved: 'परेशानी सेव हो गई', flUnwell: 'अगर आपको बहुत ख़राब लगे, तो अभी 108 पर कॉल करें।',
    good: 'अच्छा', okay: 'ठीक', unwell: 'तबीयत ठीक नहीं',
    ecIntro: 'चलिए आपका इमरजेंसी कार्ड भरते हैं। जो नहीं बताना हो उसके लिए छोड़ो बोलिए।',
    ecName: 'आपका पूरा नाम क्या है?', ecAge: 'आपकी उम्र कितनी है?', ecBlood: 'आपका ब्लड ग्रुप क्या है? जैसे ओ पॉज़िटिव।',
    ecAllergy: 'क्या आपको कोई एलर्जी है? बताइए, या छोड़ो बोलिए।', ecNotes: 'क्या कोई बात है जो मदद करने वाले को पता होनी चाहिए, जैसे आपको डायबिटीज़ है? बताइए, या छोड़ो बोलिए।',
    ecContact: 'क्या आप कोई इमरजेंसी संपर्क जोड़ना चाहते हैं? हाँ या नहीं बोलिए।', ecCName: 'उस व्यक्ति का नाम क्या है?',
    ecPhone: 'उनका फ़ोन नंबर एक-एक अंक बोलकर बताइए।', ecPhoneBad: 'मुझे इससे फ़ोन नंबर नहीं मिला।', digits: 'मैंने नंबर सुना',
    ecSaved: 'आपका इमरजेंसी कार्ड सेव हो गया। आपकी बीमारियाँ और दवाएँ आपकी सूचियों से जुड़ गई हैं।', ecContactSaved: 'संपर्क सेव हो गया',
    repName: 'यह कार्ड', age: 'साल', blood: 'ब्लड ग्रुप',
    sumNone: 'आपका स्वास्थ्य सारांश अभी खाली है।', conds: 'बीमारियाँ', meds: 'दवाएँ', allergies: 'एलर्जी', bp: 'ताज़ा ब्लड प्रेशर', sugar: 'ताज़ा शुगर',
    feeling: 'ताज़ा एहसास', noMeds: 'आपकी कोई दवा सेव नहीं है।', medsAre: 'आपकी दवाएँ हैं', oneDay: 'दिन में एक बार', night: 'रात को', morning: 'सुबह',
    pdfWait: 'आपकी रिपोर्ट बन रही है। वह डाउनलोड फ़ोल्डर में सेव होगी।', pdfDone: 'आपकी रिपोर्ट डाउनलोड हो गई। सुनने के लिए मेरा सारांश पढ़ो बोलिए।', pdfFail: 'रिपोर्ट नहीं बन सकी। कृपया इंटरनेट देखकर दोबारा कोशिश करें।',
    help: 'आप बोल सकते हैं: दवा जोड़ो। बीमारी जोड़ो। आज कैसा लग रहा है। इमरजेंसी कार्ड। मेरा सारांश सुनाओ। मेरी दवाइयाँ सुनाओ। रिपोर्ट डाउनलोड करो। या रीडिंग, जैसे बीपी 120 बटा 80, शुगर 110, या मैंने दवा ले ली। आख़िरी सेव हटाने के लिए वापस बोलिए। रद्द करने के लिए रुको बोलिए।'
  },
  bn: {
    again: 'আমি শুনতে পাইনি।', timeout: 'ঠিক আছে, এখানেই থামছি। কিছু সেভ হয়নি। যখন ইচ্ছা আবার কমান্ড বলুন।',
    cancelled: 'ঠিক আছে, বাতিল করলাম। কিছু সেভ হয়নি।', yn: 'অনুগ্রহ করে হ্যাঁ বা না বলুন।', right: 'এটা কি ঠিক? হ্যাঁ বা না বলুন।', heard: 'আমি শুনেছি',
    skipHint: 'অথবা বাদ দিন বলুন।', no: 'না', skip: 'বাদ দিন',
    medName: 'কোন ওষুধটি যোগ করবেন? তার নাম বলুন।', medDose: 'ডোজ কত, যেমন ৫০০ মিলিগ্রাম? অথবা বাদ দিন বলুন।',
    medFreq: 'কতবার খেতে হবে? যেমন সকালে একবার, রাতে একবার, দিনে দুইবার, দিনে তিনবার, বা দরকার হলে।',
    medDur: 'কত দিনের জন্য? যেমন ৫ দিন, বা সবসময় বলুন।', medDup: 'আগে থেকেই আপনার তালিকায় আছে।',
    medSave: 'এই ওষুধটি কি যোগ করব?', medSaved: 'সেভ হয়েছে। রিমাইন্ডার আপনার সেটিংসের সময়ে আসবে।', always: 'চলমান', for: 'জন্য', forAfter: true,
    cdName: 'কোন রোগ বা সমস্যা যোগ করবেন? যেমন মাইগ্রেন বা ডায়াবেটিস।', cdNote: 'কোনো নোট, যেমন কবে থেকে? অথবা বাদ দিন বলুন।',
    cdSaved: 'রোগটি সেভ হয়েছে', cdDup: 'আগে থেকেই আপনার তালিকায় আছে।',
    fl: 'আজ আপনার কেমন লাগছে? ভালো, ঠিক আছে, বা শরীর ভালো না বলুন। অথবা নিজের ভাষায় বলুন।',
    flIssue: 'আজ কি কোনো সমস্যা আছে, যেমন মাথাব্যথা বা ব্যথা? বলুন, অথবা না বলুন।',
    flSaved: 'সেভ হয়েছে। আপনার লাগছে', flIssueSaved: 'সমস্যাটি সেভ হয়েছে', flUnwell: 'খুব খারাপ লাগলে এখনই 108 নম্বরে ফোন করুন।',
    good: 'ভালো', okay: 'ঠিক আছে', unwell: 'শরীর ভালো না',
    ecIntro: 'চলুন আপনার ইমার্জেন্সি কার্ড ভরি। যা বলতে চান না তার জন্য বাদ দিন বলুন।',
    ecName: 'আপনার পুরো নাম কী?', ecAge: 'আপনার বয়স কত?', ecBlood: 'আপনার রক্তের গ্রুপ কী? যেমন ও পজিটিভ।',
    ecAllergy: 'আপনার কি কোনো অ্যালার্জি আছে? বলুন, অথবা বাদ দিন বলুন।', ecNotes: 'এমন কিছু কি আছে যা সাহায্যকারীর জানা দরকার, যেমন আপনার ডায়াবেটিস আছে? বলুন, অথবা বাদ দিন বলুন।',
    ecContact: 'আপনি কি একজন জরুরি যোগাযোগ যোগ করতে চান? হ্যাঁ বা না বলুন।', ecCName: 'তাঁর নাম কী?',
    ecPhone: 'তাঁর ফোন নম্বর এক এক করে অঙ্ক বলুন।', ecPhoneBad: 'আমি এ থেকে ফোন নম্বর পাইনি।', digits: 'আমি নম্বরটি শুনেছি',
    ecSaved: 'আপনার ইমার্জেন্সি কার্ড সেভ হয়েছে। আপনার রোগ ও ওষুধ আপনার তালিকা থেকে যোগ হয়েছে।', ecContactSaved: 'যোগাযোগ সেভ হয়েছে',
    repName: 'এই কার্ডটি', age: 'বছর বয়স', blood: 'রক্তের গ্রুপ',
    sumNone: 'আপনার স্বাস্থ্য সারাংশ এখনো খালি।', conds: 'রোগ', meds: 'ওষুধ', allergies: 'অ্যালার্জি', bp: 'সর্বশেষ ব্লাড প্রেশার', sugar: 'সর্বশেষ সুগার',
    feeling: 'সর্বশেষ অনুভূতি', noMeds: 'আপনার কোনো ওষুধ সেভ নেই।', medsAre: 'আপনার ওষুধগুলো হলো', oneDay: 'দিনে একবার', night: 'রাতে', morning: 'সকালে',
    pdfWait: 'আপনার রিপোর্ট তৈরি হচ্ছে। এটি ডাউনলোড ফোল্ডারে সেভ হবে।', pdfDone: 'আপনার রিপোর্ট ডাউনলোড হয়েছে। শুনতে আমার সারাংশ পড়ো বলুন।', pdfFail: 'রিপোর্ট তৈরি করা যায়নি। অনুগ্রহ করে ইন্টারনেট দেখে আবার চেষ্টা করুন।',
    help: 'আপনি বলতে পারেন: ওষুধ যোগ করো। রোগ যোগ করো। আজ কেমন লাগছে। ইমার্জেন্সি কার্ড। আমার সারাংশ পড়ো। আমার ওষুধ পড়ো। রিপোর্ট ডাউনলোড করো। অথবা রিডিং, যেমন বিপি 120 বাই 80, সুগার 110, বা আমি ওষুধ খেয়েছি। শেষ সেভ সরাতে মুছে ফেলো বলুন। বাতিল করতে থামো বলুন।'
  }
};
const vgT = () => VG_T[(typeof currentLangCode === 'function' && currentLangCode()) || 'en'] || VG_T.en;

const VG_YES = ['yes', 'yeah', 'yep', 'correct', 'right', 'ok', 'okay', 'sure', 'haan', 'han', 'हाँ', 'हां', 'जी', 'जी हाँ', 'ठीक', 'सही', 'হ্যাঁ', 'হ্যা', 'হাঁ', 'ঠিক'];
const VG_NO = ['no', 'nope', 'wrong', 'not right', 'nahi', 'नहीं', 'नही', 'ग़लत', 'गलत', 'না', 'নাহ', 'ভুল'];
const VG_SKIP = ['skip', 'none', 'nothing', 'no', 'pass', 'छोड़ो', 'छोड़ दो', 'छोड़िए', 'कुछ नहीं', 'नहीं', 'বাদ দিন', 'বাদ', 'কিছু না', 'না'];
const vgIs = (list, t) => list.some(w => vfNorm(w) === t);
const vgYesNo = (t) => { const n = vfNorm(t); return vgIs(VG_YES, n) ? true : vgIs(VG_NO, n) ? false : null; };


let vgSt = null, vgBusy = false;

function vgPrompt(again) {
  const st = vgSt; if (!st) return;
  clearTimeout(st.timer);
  vfSay((again ? vgT().again + ' ' : '') + st.prompt, () => {
    if (vgSt !== st) return;
    vfListen();
    st.timer = setTimeout(() => {
      if (vgSt !== st) return;
      if (++st.tries >= 2) vgCancel(vgT().timeout); else vgPrompt(true);
    }, 16000);
  });
}
function vgAsk(prompt) {
  return new Promise(res => { vgSt = { res, prompt, tries: 0, timer: null }; vgPrompt(false); });
}
function vgCancel(msg) {
  const st = vgSt; if (!st) return;
  clearTimeout(st.timer); vgSt = null; st.res(null);
  if (msg) vfSay(msg);
}
function vgFeed(text) {
  const st = vgSt; if (!st) return;
  const n = vfNorm(text);
  if (VF_CMDS.stop.some(w => vfNorm(w) === n) || /^(cancel|never mind)$/.test(n)) return vgCancel(vgT().cancelled);
  clearTimeout(st.timer); vgSt = null; st.res(String(text).trim());
}
// free text; returns '' when skipped, null when cancelled
async function vgText(prompt, optional) {
  const v = await vgAsk(optional ? `${prompt}` : prompt);
  if (v === null) return null;
  if (optional && vgIs(VG_SKIP, vfNorm(v))) return '';
  return v.replace(/[.।]+$/, '').slice(0, 80);
}
async function vgConfirm(prompt) {
  for (let i = 0; i < 2; i++) {
    const v = await vgAsk(i ? vgT().yn : prompt);
    if (v === null) return null;
    const yn = vgYesNo(v); if (yn !== null) return yn;
  }
  vgCancel(vgT().cancelled); return null;
}
// a name that must be right: ask, repeat it back, ask again if wrong
async function vgName(prompt) {
  const T = vgT();
  for (let i = 0; i < 3; i++) {
    const v = await vgText(prompt, false); if (v === null) return null;
    const ok = await vgConfirm(`${T.heard} ${v}. ${T.right}`); if (ok === null) return null;
    if (ok) return v;
  }
  vgCancel(T.cancelled); return null;
}

const VG_NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fourteen: 14,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10, 'चौदह': 14,
  'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5, 'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9, 'দশ': 10, 'চৌদ্দ': 14 };
function vgFreq(t) {
  const s = vhDigits(String(t)).toLowerCase();
  if (/\b1\s*[-–]\s*1\s*[-–]\s*1\b/.test(s)) return '1-1-1';
  if (/\b1\s*[-–]?\s*0\s*[-–]?\s*1\b/.test(s)) return '1-0-1';
  if (/when needed|as needed|only when|\bsos\b|जरूरत|जरूरत|দরকার হলে|প্রয়োজন হলে/.test(s)) return 'Only when needed';
  if (/three|thrice|3 times|तीन|তিন/.test(s)) return 'Three times a day';
  if (/twice|two times|2 times|morning and night|दो बार|सुबह और रात|दिन में दो|দুই|দুইবার|সকাল ও রাত|সকাল আর রাত/.test(s)) return 'Twice a day';
  if (/night|bedtime|रात|রাত/.test(s)) return 'Once a day, night';
  if (/morning|once|daily|every day|सुबह|एक बार|रोज|সকাল|একবার|প্রতিদিন/.test(s)) return 'Once a day, morning';
  return null;
}
function vgDuration(t) {            // '' = ongoing, null = not understood
  const s = vhDigits(String(t)).toLowerCase();
  if (/ongoing|always|long term|lifelong|forever|continue|no end|हमेशा|लगातार|लंबे समय|সবসময়|চলবে|চলমান/.test(s)) return '';
  let n = (s.match(/\d+/) || [])[0];
  if (!n) { const w = s.split(/\s+/).find(x => VG_NUMW[vfNorm(x)] || VG_NUMW[x]); if (w && !VG_NUMW[w]) { n = VG_NUMW[vfNorm(w)]; } else n = w ? VG_NUMW[w] : null; }
  if (!n) return null;
  if (/week|हफ्ते|हफ्ते|सप्ताह|সপ্তাহ/.test(s)) return `${n} weeks`;
  if (/month|महीने|महीना|মাস/.test(s)) return `${n} months`;
  if (/day|दिन|দিন/.test(s)) return `${n} days`;
  return null;
}
function vgBlood(t) {
  const s = ' ' + vhDigits(String(t)).toLowerCase().replace(/[.,]/g, ' ').replace(/([+\-])/g, ' $1 ').replace(/\s+/g, ' ') + ' ';
  const sign = /negative|minus|-|नेगेटिव|মাইনাস|নেগেটিভ/.test(s) ? '-' : /positive|plus|\+|पॉजिटिव|पोजिटिव|পজিটিভ|প্লাস/.test(s) ? '+' : null;
  if (!sign) return null;
  const has = w => s.includes(' ' + w + ' ');          // whole words (\b does not work for Hindi or Bengali letters)
  let g = null;
  if (has('ab') || has('a b') || has('ए बी') || has('এ বি')) g = 'AB';
  else if (has('a') || has('ए') || has('এ')) g = 'A';
  else if (has('b') || has('बी') || has('বি')) g = 'B';
  else if (has('o') || has('ओ') || has('ও') || has('zero')) g = 'O';
  return g ? g + sign : null;
}
const vgAge = t => { const n = parseInt(vhDigits(String(t)).replace(/\D+/g, ' ').trim().split(' ')[0], 10); return n >= 1 && n <= 120 ? String(n) : null; };
const vgPhone = t => { const d = vhDigits(String(t)).replace(/\D/g, ''); return d.length >= 8 && d.length <= 13 ? d : null; };


const VG_FQ = {
  hi: { 'Once a day, morning': 'दिन में एक बार, सुबह', 'Once a day, night': 'दिन में एक बार, रात को', 'Twice a day': 'दिन में दो बार', 'Three times a day': 'दिन में तीन बार', 'Only when needed': 'ज़रूरत पड़ने पर', '1-0-1': 'सुबह और रात', '1-1-1': 'सुबह, दोपहर और रात', unit: { day: 'दिन', week: 'हफ़्ते', month: 'महीने' } },
  bn: { 'Once a day, morning': 'দিনে একবার, সকালে', 'Once a day, night': 'দিনে একবার, রাতে', 'Twice a day': 'দিনে দুইবার', 'Three times a day': 'দিনে তিনবার', 'Only when needed': 'দরকার হলে', '1-0-1': 'সকাল ও রাত', '1-1-1': 'সকাল, দুপুর ও রাত', unit: { day: 'দিন', week: 'সপ্তাহ', month: 'মাস' } }
};
function vgSayFreq(f) { const m = VG_FQ[currentLangCode()]; return (m && m[f]) || f; }
function vgSayDur(d) {
  const m = VG_FQ[currentLangCode()], x = String(d || '').match(/^(\d+) (day|week|month)s$/);
  return m && x ? `${x[1]} ${m.unit[x[2]]}` : d;
}

// --
async function vgAddMed() {
  const T = vgT();
  const name = await vgName(T.medName); if (name === null) return;
  if (hlMeds().some(m => m.name.toLowerCase() === name.toLowerCase())) return vfSay(`${name} ${T.medDup}`, vfListen);
  const dose = await vgText(T.medDose, true); if (dose === null) return;
  let freq = null;
  for (let i = 0; i < 2 && freq === null; i++) { const v = await vgAsk(T.medFreq); if (v === null) return; freq = vgFreq(v); if (freq === null && i) freq = String(v).slice(0, 60); }
  let dur = null;
  for (let i = 0; i < 2 && dur === null; i++) { const v = await vgAsk(T.medDur); if (v === null) return; dur = vgDuration(v); if (dur === null && i) dur = ''; }
  const line = [name, dose, vgSayFreq(freq), dur ? (T.forAfter ? `${vgSayDur(dur)} ${T.for}` : `${T.for} ${vgSayDur(dur)}`) : T.always].filter(x => x !== '' && x != null).join(', ');
  const ok = await vgConfirm(`${line}. ${T.medSave}`); if (!ok) { if (ok === false) vfSay(T.cancelled, vfListen); return; }
  const meds = hlMeds();
  meds.unshift({ id: Date.now(), name, dose, frequency: freq, duration: dur, notes: '', active: true, source: 'me', addedAt: new Date().toISOString() });
  hlSet(HL.meds, meds);
  vhLastSaved = null;
  vfSay(`${T.medSaved} ${line}.`, vfListen);
}

async function vgAddCond() {
  const T = vgT();
  const name = await vgName(T.cdName); if (name === null) return;
  const list = hlGet(HL.conds, []);
  if (list.some(c => c.name.toLowerCase() === name.toLowerCase())) return vfSay(`${name} ${T.cdDup}`, vfListen);
  const note = await vgText(T.cdNote, true); if (note === null) return;
  list.unshift({ id: Date.now(), name, note, source: 'me', addedAt: new Date().toISOString() });
  hlSet(HL.conds, list);
  vfSay(`${T.cdSaved}: ${name}.`, vfListen);
}

// ---------- flow: how I feel today ----------
function vgFeelWord(t) {
  const s = vhDigits(String(t)).toLowerCase(), T = vgT();
  if (/not well|unwell|sick|bad|terrible|awful|tired|low|weak|खराब|खराब|थका|कमजोर|कमजोर|ठीक नहीं|খারাপ|অসুস্থ|ক্লান্ত|দুর্বল|ভালো না|ভাল না/.test(s)) return T.unwell;
  if (/\bgood\b|great|fine|well|happy|better|अच्छा|बढिया|अच्छी|ভালো|ভাল|ভালো আছি/.test(s)) return T.good;
  if (/okay|ok\b|so-?so|alright|normal|ठीक|চলে যাচ্ছে|ঠিক আছে|মোটামুটি/.test(s)) return T.okay;
  return null;
}
async function vgFeel(preset) {
  const T = vgT();
  let raw = preset;
  if (!raw) { raw = await vgAsk(T.fl); if (raw === null) return; }
  const word = vgFeelWord(raw);
  const value = word || String(raw).replace(/[.।]+$/, '').slice(0, 80);
  hlAddVital('Feeling', value, '');
  const issue = await vgText(T.flIssue, true); if (issue === null) return vfSay(`${T.flSaved} ${value}.`, vfListen);
  if (issue && !vgIs(VG_NO, vfNorm(issue)) && !vgIs(VG_SKIP, vfNorm(issue))) {
    hlAddVital('Symptom', issue, '');
    vfSay(`${T.flSaved} ${value}. ${T.flIssueSaved}: ${issue}. ${word === T.unwell ? T.flUnwell : ''}`, vfListen);
  } else vfSay(`${T.flSaved} ${value}. ${word === T.unwell ? T.flUnwell : ''}`, vfListen);
}

async function vgCard() {
  const T = vgT();
  vfSay(T.ecIntro);
  const prof = Object.assign({ name: '', age: '', allergies: '' }, hlGet(HL.profile, {}));
  const name = await vgName(T.ecName); if (name === null) return;
  let age = null;
  for (let i = 0; i < 2 && age === null; i++) { const v = await vgAsk(T.ecAge); if (v === null) return; age = vgAge(v); if (age === null && i) age = ''; }
  let blood = null;
  for (let i = 0; i < 2 && blood === null; i++) {
    const v = await vgAsk(T.ecBlood); if (v === null) return;
    if (vgIs(VG_SKIP, vfNorm(v))) { blood = ''; break; }
    blood = vgBlood(v); if (blood === null && i) blood = '';
  }
  const allergies = await vgText(T.ecAllergy, true); if (allergies === null) return;
  const notes = await vgText(T.ecNotes, true); if (notes === null) return;
  hlSet(HL.profile, Object.assign(prof, { name, age, allergies }));
  ecSet({ blood: blood || '', notes });
  const spoken = [`${T.repName} ${name}`, age && `${age} ${T.age}`, blood && `${T.blood} ${blood.replace('+', ' plus').replace('-', ' minus')}`, allergies && `${T.allergies}: ${allergies}`].filter(Boolean).join(', ');
  // one emergency contact
  const want = await vgConfirm(T.ecContact); if (want === null) return;
  if (want) {
    const cname = await vgName(T.ecCName); if (cname === null) return;
    let phone = null;
    for (let i = 0; i < 3 && phone === null; i++) {
      const v = await vgAsk(i ? `${T.ecPhoneBad} ${T.ecPhone}` : T.ecPhone); if (v === null) return;
      const p = vgPhone(v); if (!p) continue;
      const ok = await vgConfirm(`${T.digits}: ${p.split('').join(' ')}. ${T.right}`); if (ok === null) return;
      if (ok) phone = p;
    }
    if (!phone) return vgCancel(T.cancelled);
    const list = loadEmergencyContacts();
    list.push({ id: 'ec-' + Date.now(), name: cname, phone, relationship: '' });
    saveEmergencyContacts(list);
    vfSay(`${T.ecContactSaved}: ${cname}. ${spoken}. ${T.ecSaved}`, vfListen);
  } else vfSay(`${spoken}. ${T.ecSaved}`, vfListen);
}

const vgFreqSay = f => vgSayFreq(f || '');
function vgReadMeds() {
  const T = vgT(), act = hlMeds().filter(m => m.active);
  if (!act.length) return vfSay(T.noMeds, vfListen);
  vfSay(`${T.medsAre}: ` + act.map(m => [m.name, m.dose, vgFreqSay(m.frequency)].filter(Boolean).join(' ')).join('. ') + '.', vfListen);
}
function vgReadSummary() {
  const T = vgT(), p = hlGet(HL.profile, {}), parts = [];
  const conds = hlGet(HL.conds, []).map(c => c.name), act = hlMeds().filter(m => m.active);
  const bp = rmSeries('bp')[0], su = rmSeries('sugar')[0], fe = hlGet(HL.vitals, []).find(e => e.type === 'Feeling');
  if (p.name) parts.push(p.name + (p.age ? `, ${p.age} ${T.age}` : ''));
  const ec = ecGet(); if (ec.blood) parts.push(`${T.blood} ${ec.blood}`);
  if (p.allergies) parts.push(`${T.allergies}: ${p.allergies}`);
  if (conds.length) parts.push(`${T.conds}: ${conds.join(', ')}`);
  if (act.length) parts.push(`${T.meds}: ` + act.map(m => [m.name, m.dose].filter(Boolean).join(' ')).join(', '));
  if (bp) parts.push(`${T.bp}: ${bp.a} / ${bp.b}`);
  if (su) parts.push(`${T.sugar}: ${Math.round(su.a)}`);
  if (fe) parts.push(`${T.feeling}: ${fe.value}`);
  vfSay(parts.length ? parts.join('. ') + '.' : T.sumNone, vfListen);
}
async function vgDownloadReport() {
  const T = vgT();
  vfSay(T.pdfWait);
  try { await hlMakePdf(90); vfSay(T.pdfDone, vfListen); }
  catch (e) { console.error(e); vfSay(T.pdfFail, vfListen); }
}

const VG_TRIG = [
  ['help', /what can i say|voice help|list of commands|मैं क्या बोल सकत|আমি কী বলতে পারি/],
  ['med', /add (a |new |my )?(medicine|medication|tablet)s?\b|new medicine|दवा जोड|दवाई जोड|नई दवा|ওষুধ যোগ|নতুন ওষুধ/],
  ['cond', /add (a |new |my )?(condition|health problem|disease)|बीमारी जोड|कंडीशन जोड|রোগ যোগ|সমস্যা যোগ|কন্ডিশন যোগ/],
  ['card', /emergency card|इमरजेंसी कार्ड|आपातकालीन कार्ड|ইমার্জেন্সি কার্ড|জরুরি কার্ড/],
  ['pdf', /(download|make|create|generate).*(report|pdf)|रिपोर्ट (डाउनलोड|बना)|রিপোর্ট (ডাউনলোড|বানাও)/],
  ['sum', /read.*(summary|report)|my health summary|सारांश (सुनाओ|पढो)|मेरा सारांश|সারাংশ পড়ো|আমার সারাংশ/],
  ['rmeds', /(read|tell|list).*(my )?medicines|^my medicines$|मेरी दवाइयाँ|मेरी दवाइयां|मेरी दवाएँ|আমার ওষুধ/],
  ['feel', /(log|record|check).*(how i feel|my feeling|my mood)|^how i feel$|आज कैसा लग|मेरी तबीयत|मुझे कैसा लग|আজ কেমন|আমার শরীর/]
];
function vgFeelInline(low) {            
  const m = low.match(/^i(?:'m| am)? ?(?:feel|feeling|felt)\s+(.{2,60})$/);
  return m ? m[1] : null;
}
function vgStart(text) {
  const low = vfNorm(vhDigits(text));
  if (!low || low.split(' ').length > 9) return null;
  const inline = vgFeelInline(low);
  if (inline) return () => vgFeel(inline);
  const hit = VG_TRIG.find(([, re]) => re.test(low));
  if (!hit) return null;
  return ({
    help: () => vfSay(vgT().help, vfListen), med: vgAddMed, cond: vgAddCond, card: vgCard, pdf: vgDownloadReport,
    sum: vgReadSummary, rmeds: vgReadMeds, feel: () => vgFeel(null)
  })[hit[0]];
}

const _vgOrigSend = sendMessage;
sendMessage = function (text) {
  if (typeof text === 'string' && vgSt) { vgFeed(text); return Promise.resolve(); }
  if (vfOn && typeof text === 'string' && !vgBusy) {
    const flow = vgStart(text);
    if (flow) {
      vgBusy = true;
      Promise.resolve().then(flow).catch(e => console.error(e)).finally(() => { vgBusy = false; });
      return Promise.resolve();
    }
  }
  return _vgOrigSend.apply(this, arguments);
};