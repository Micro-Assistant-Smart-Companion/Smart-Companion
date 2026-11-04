const CR_T = {
  en: {
    title: 'You are not alone',
    body: 'I am really sorry you are going through this. You matter, and you do not have to face it alone. If you are in immediate danger, please call 112 now. You can also talk to a trained counsellor right now, free, at any time of day: call 14416.',
    ask: 'Is there someone you trust who can be with you? You can call them below.',
    help: 'Call Tele-MANAS 14416 (free, 24 hours)', e112: 'Call 112 (immediate danger)', call: 'Call', msg: 'Message', add: 'Add someone I trust',
    safe: 'I am safe, close this', speakKeys: 'Press Enter to call the free helpline. Press Tab to hear other choices.',
    text: 'I am having a really hard time right now. Can you please call me or be with me?'
  },
  hi: {
    title: 'आप अकेले नहीं हैं',
    body: 'मुझे बहुत अफ़सोस है कि आप इससे गुज़र रहे हैं। आप मायने रखते हैं, और आपको इसे अकेले नहीं झेलना है। अगर आप अभी ख़तरे में हैं, तो कृपया तुरंत 112 पर कॉल करें। आप किसी प्रशिक्षित काउंसलर से अभी, मुफ़्त और दिन-रात बात भी कर सकते हैं: 14416 पर कॉल करें।',
    ask: 'क्या कोई भरोसेमंद व्यक्ति है जो आपके साथ रह सके? आप नीचे उन्हें कॉल कर सकते हैं।',
    help: 'टेली-मानस 14416 पर कॉल करें (मुफ़्त, 24 घंटे)', e112: '112 पर कॉल करें (तुरंत ख़तरा)', call: 'कॉल करें', msg: 'संदेश भेजें', add: 'किसी भरोसेमंद को जोड़ें',
    safe: 'मैं सुरक्षित हूँ, बंद करें', speakKeys: 'मुफ़्त हेल्पलाइन पर कॉल करने के लिए एंटर दबाइए। दूसरे विकल्प सुनने के लिए टैब दबाइए।',
    text: 'मेरे लिए अभी बहुत मुश्किल समय है। क्या आप मुझे कॉल कर सकते हैं या मेरे पास आ सकते हैं?'
  },
  bn: {
    title: 'আপনি একা নন',
    body: 'আপনি যে কষ্টের মধ্য দিয়ে যাচ্ছেন তার জন্য আমি সত্যিই দুঃখিত। আপনি গুরুত্বপূর্ণ, এবং আপনাকে একা এটা সইতে হবে না। আপনি এখন বিপদে থাকলে দয়া করে এখনই 112 নম্বরে ফোন করুন। আপনি এখনই একজন প্রশিক্ষিত কাউন্সেলরের সঙ্গে বিনামূল্যে, দিনরাত যেকোনো সময় কথা বলতে পারেন: 14416 নম্বরে ফোন করুন।',
    ask: 'এমন কেউ কি আছেন যাঁকে আপনি বিশ্বাস করেন এবং যিনি আপনার পাশে থাকতে পারেন? নিচে তাঁকে ফোন করতে পারেন।',
    help: 'টেলি-মানস 14416 নম্বরে ফোন করুন (বিনামূল্যে, ২৪ ঘণ্টা)', e112: '112 নম্বরে ফোন করুন (এখনই বিপদ)', call: 'ফোন করুন', msg: 'মেসেজ পাঠান', add: 'বিশ্বস্ত কাউকে যোগ করুন',
    safe: 'আমি নিরাপদ, বন্ধ করুন', speakKeys: 'বিনামূল্যের হেল্পলাইনে ফোন করতে এন্টার চাপুন। অন্য বিকল্প শুনতে ট্যাব চাপুন।',
    text: 'আমার এখন খুব কঠিন সময় যাচ্ছে। আপনি কি আমাকে ফোন করতে বা আমার পাশে থাকতে পারবেন?'
  }
};
const crT = () => CR_T[(typeof currentLangCode === 'function' && currentLangCode()) || 'en'] || CR_T.en;

const crNorm = t => String(t || '').normalize('NFC').replace(/़/g, '').replace(/[’‘`]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();
const CR_WORDS = [
  // English
  'suicid', 'kill myself', 'killing myself', 'end my life', 'end it all', 'want to die', 'wanna die', 'wish i was dead', 'wish i were dead',
  'better off dead', 'no reason to live', "don't want to live", 'do not want to live', 'dont want to live', "don't want to be alive",
  'do not want to be alive', 'hurt myself', 'harm myself', 'self harm', 'self-harm', 'cut myself', 'take my own life',
  // Hinglish
  'jeena nahi chahta', 'jeena nahi chahti', 'marna chahta', 'marna chahti', 'mar jana chahta', 'mar jana chahti', 'mar jaana chahta', 'mar jaana chahti',
  'khudkushi', 'khud kushi', 'atmahatya', 'jaan de dunga', 'jaan de dungi',
  // Hindi
  'आत्महत्या', 'खुदकुशी', 'मरना चाहता', 'मरना चाहती', 'मर जाना चाहता', 'मर जाना चाहती', 'जीना नहीं चाहता', 'जीना नहीं चाहती',
  'जीने का मन नहीं', 'जिंदगी खत्म', 'खुद को मार', 'खुद को नुकसान', 'खुद को खत्म',
  // Bengali
  'আত্মহত্যা', 'আত্মঘাতী', 'মরতে চাই', 'মরে যেতে চাই', 'বাঁচতে চাই না', 'বাঁচতে ইচ্ছা করে না', 'নিজেকে শেষ', 'নিজের ক্ষতি', 'জীবন শেষ'
].map(crNorm);

const CR_NEG = /(don't|dont|do not|never|not|no) (really |ever )?(want to die|feel suicidal|going to (kill|hurt|harm) myself|want to (kill|hurt|harm) myself|think about suicide)/;
function crCheck(text) {
  const t = crNorm(text);
  if (!t || t.length > 400) return false;
  if (CR_NEG.test(t)) return false;
  return CR_WORDS.some(w => t.includes(w));
}

let crOpen = false;
const crDigits = p => { let d = String(p || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; return d; };
function crClose(ret) {
  const o = document.getElementById('crisisOverlay'); if (o) o.remove();
  crOpen = false;
  try { if (ret && ret.focus) ret.focus(); } catch (e) {}
}
function showCrisisPanel() {
  if (crOpen) return;
  crOpen = true;
  const T = crT(), back = document.activeElement;
  let contacts = []; try { contacts = (loadEmergencyContacts() || []).filter(c => c && c.phone).slice(0, 3); } catch (e) {}
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const btn = 'class="pf-acc-hear" style="text-decoration:none;margin:0 0 8px"';
  const rows = contacts.map(c => {
    const d = crDigits(c.phone), nm = esc(c.name || '');
    return `<a ${btn} href="tel:${esc(c.phone).replace(/[^\d+]/g, '')}">📞 ${T.call} ${nm}</a>` +
           (d ? `<a ${btn} href="https://wa.me/${d}?text=${encodeURIComponent(T.text)}" target="_blank" rel="noopener noreferrer">💬 ${T.msg} ${nm}</a>` : '');
  }).join('');
  const o = document.createElement('div'); o.id = 'crisisOverlay'; o.className = 'pf-acc-overlay';
  o.setAttribute('role', 'alertdialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'crTitle'); o.setAttribute('aria-describedby', 'crBody');
  o.innerHTML = `<div class="pf-welcome-box" style="max-height:92vh;overflow:auto">
    <h2 class="pf-welcome-title" id="crTitle">${T.title}</h2>
    <p id="crBody" style="line-height:1.55;margin:0 0 12px">${T.body}</p>
    <a id="crHelp" ${btn} href="tel:14416">📞 ${T.help}</a>
    <p style="line-height:1.55;margin:10px 0">${T.ask}</p>
    ${rows || `<button type="button" ${btn} id="crAdd">➕ ${T.add}</button>`}
    <a ${btn} href="tel:112">🚨 ${T.e112}</a>
    <button type="button" ${btn} id="crSafe">${T.safe}</button></div>`;
  document.body.appendChild(o);
  const q = id => o.querySelector('#' + id);
  q('crSafe').onclick = () => crClose(back);
  if (q('crAdd')) q('crAdd').onclick = () => { crClose(); try { showEmergencyContactsModal(); } catch (e) {} };
  o.onkeydown = e => { if (e.key === 'Escape') crClose(back); };
  q('crHelp').focus();
  try { if (typeof vgSt !== 'undefined' && vgSt) vgCancel(); } catch (e) {}        // stop any open voice question, silently
  if (typeof vfOn !== 'undefined' && vfOn && typeof vfSay === 'function') vfSay(`${T.body} ${T.ask} ${T.speakKeys}`);
}

// outermost wrapper: the sentence never reaches the AI, the chat history or the server
const _crOrigSend = sendMessage;
sendMessage = function (text) {
  if (typeof text === 'string') {
    if (crOpen) return Promise.resolve();                 // the panel is open: ignore stray speech and keyboard noise
    if (crCheck(text)) { showCrisisPanel(); return Promise.resolve(); }
  }
  return _crOrigSend.apply(this, arguments);
};