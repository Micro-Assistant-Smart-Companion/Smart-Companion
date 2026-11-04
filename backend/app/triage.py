import re
import unicodedata

EMERGENCY_PATTERNS = [
    # --- English ---
    "chest pain", "can't breathe", "cannot breathe", "difficulty breathing",
    "severe bleeding", "heavy bleeding", "unconscious", "unresponsive",
    "overdose",
    "seizure", "having a stroke", "heart attack", "severe allergic reaction",
    "anaphylaxis", "numbness on one side", "can't wake up", "not breathing",
    # --- Hindi (Devanagari) ---
    "सीने में दर्द", "छाती में दर्द", "सांस नहीं", "साँस नहीं",
    "सांस लेने में तकलीफ", "साँस लेने में तकलीफ", "सांस लेने में दिक्कत", "साँस लेने में दिक्कत",
    "दम घुट", "बेहोश", "होश नहीं", "बहुत खून", "खून बह",
    "दौरा पड़", "मिर्गी", "लकवा",
    "हार्ट अटैक", "दिल का दौरा", "जहर खा", "ज़हर खा", "ओवरडोज", "एक तरफ सुन्न",
    # --- Hinglish (Hindi in English letters) ---
    "seene mein dard", "seene me dard", "chhati mein dard", "saans nahi", "sans nahi",
    "dil ka daura", "behosh",
    # --- Bengali ---
    "বুকে ব্যথা", "বুকে ব্যাথা", "বুকে চাপ", "শ্বাস নিতে পারছি না", "শ্বাস নিতে কষ্ট",
    "শ্বাসকষ্ট", "দম বন্ধ", "অজ্ঞান", "জ্ঞান নেই", "প্রচুর রক্ত", "রক্তপাত",
    "খিঁচুনি", "স্ট্রোক", "হার্ট অ্যাটাক", "হার্ট এটাক", "বিষ খে", "ওভারডোজ", "একপাশ অবশ",
]

# Thoughts of suicide or self-harm are NOT an ambulance case: they get calm words, the free helpline and the
# person's own trusted contact (see js/27-crisis-support.js). Kept separate on purpose. Words below are drafted by
CRISIS_PATTERNS = [
    "suicid", "kill myself", "killing myself", "end my life", "end it all", "want to die", "wanna die",
    "wish i was dead", "wish i were dead", "better off dead", "no reason to live", "don't want to live",
    "do not want to live", "dont want to live", "don't want to be alive", "hurt myself", "harm myself",
    "self harm", "self-harm", "cut myself", "take my own life",
    "jeena nahi chahta", "jeena nahi chahti", "marna chahta", "marna chahti", "mar jana chahta", "mar jana chahti",
    "khudkushi", "khud kushi", "atmahatya",
    "आत्महत्या", "खुदकुशी", "मरना चाहता", "मरना चाहती", "मर जाना चाहता", "मर जाना चाहती", "जीना नहीं चाहता",
    "जीना नहीं चाहती", "जीने का मन नहीं", "जिंदगी खत्म", "खुद को मार", "खुद को नुकसान", "खुद को खत्म",
    "আত্মহত্যা", "আত্মঘাতী", "মরতে চাই", "মরে যেতে চাই", "বাঁচতে চাই না", "বাঁচতে ইচ্ছা করে না",
    "নিজেকে শেষ", "নিজের ক্ষতি", "জীবন শেষ",
]

CRISIS_TEXT = {
    "en": "I am really sorry you are going through this. You matter, and you do not have to face it alone. If you are in immediate danger, please call 112 now. You can also talk to a trained counsellor right now, free, at any time of day: call 14416.",
    "hi": "मुझे बहुत अफ़सोस है कि आप इससे गुज़र रहे हैं। आप मायने रखते हैं, और आपको इसे अकेले नहीं झेलना है। अगर आप अभी ख़तरे में हैं, तो कृपया तुरंत 112 पर कॉल करें। आप किसी प्रशिक्षित काउंसलर से अभी, मुफ़्त और दिन-रात बात भी कर सकते हैं: 14416 पर कॉल करें।",
    "bn": "আপনি যে কষ্টের মধ্য দিয়ে যাচ্ছেন তার জন্য আমি সত্যিই দুঃখিত। আপনি গুরুত্বপূর্ণ, এবং আপনাকে একা এটা সইতে হবে না। আপনি এখন বিপদে থাকলে দয়া করে এখনই 112 নম্বরে ফোন করুন। আপনি এখনই একজন প্রশিক্ষিত কাউন্সেলরের সঙ্গে বিনামূল্যে, দিনরাত যেকোনো সময় কথা বলতে পারেন: 14416 নম্বরে ফোন করুন।",
}

# Same message the English version always showed, now in all three languages.
EMERGENCY_TEXT = {
    "en": "This sounds like it could be a medical emergency. Please call 108 (ambulance) or 104 (health helpline) right now, or go to the nearest hospital immediately.",
    "hi": "यह आपातकाल जैसा लग रहा है। कृपया अभी 108 (एम्बुलेंस) या 104 (स्वास्थ्य हेल्पलाइन) पर कॉल करें, या तुरंत नज़दीकी अस्पताल जाएँ।",
    "bn": "এটি জরুরি অবস্থা হতে পারে। দয়া করে এখনই 108 (অ্যাম্বুলেন্স) বা 104 (স্বাস্থ্য হেল্পলাইন) নম্বরে ফোন করুন, অথবা এখনই নিকটতম হাসপাতালে যান।",
}


def _norm(s: str) -> str:
    return unicodedata.normalize("NFC", s).lower()


_PATTERNS = [_norm(p) for p in EMERGENCY_PATTERNS]
_CRISIS = [_norm(p.replace("\u093c", "")) for p in CRISIS_PATTERNS]
_NEGATED = re.compile(r"(don't|dont|do not|never|not|no) (really |ever )?(want to die|feel suicidal|going to (kill|hurt|harm) myself|want to (kill|hurt|harm) myself|think about suicide)")


def check_emergency(text: str) -> bool:
    lowered = _norm(text)
    return any(p in lowered for p in _PATTERNS)


def check_crisis(text: str) -> bool:
    """Suicide / self-harm words in what the person just said (never in stored Health Log text)."""
    lowered = _norm(text).replace("\u093c", "").replace("\u2019", "'")
    if len(lowered) > 400 or _NEGATED.search(lowered):
        return False
    return any(p in lowered for p in _CRISIS)