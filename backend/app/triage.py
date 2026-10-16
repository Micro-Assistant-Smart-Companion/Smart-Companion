import unicodedata

EMERGENCY_PATTERNS = [
    # --- English ---
    "chest pain", "can't breathe", "cannot breathe", "difficulty breathing",
    "severe bleeding", "heavy bleeding", "unconscious", "unresponsive",
    "suicidal", "want to die", "kill myself", "self harm", "overdose",
    "seizure", "having a stroke", "heart attack", "severe allergic reaction",
    "anaphylaxis", "numbness on one side", "can't wake up", "not breathing",
    # --- Hindi (Devanagari) ---
    "सीने में दर्द", "छाती में दर्द", "सांस नहीं", "साँस नहीं",
    "सांस लेने में तकलीफ", "साँस लेने में तकलीफ", "सांस लेने में दिक्कत", "साँस लेने में दिक्कत",
    "दम घुट", "बेहोश", "होश नहीं", "बहुत खून", "खून बह", "आत्महत्या",
    "मरना चाहता", "मरना चाहती", "जीना नहीं चाहता", "जीना नहीं चाहती",
    "खुद को मार", "खुद को नुकसान", "दौरा पड़", "मिर्गी", "लकवा",
    "हार्ट अटैक", "दिल का दौरा", "जहर खा", "ज़हर खा", "ओवरडोज", "एक तरफ सुन्न",
    # --- Hinglish (Hindi in English letters) ---
    "seene mein dard", "seene me dard", "chhati mein dard", "saans nahi", "sans nahi",
    "dil ka daura", "behosh", "marna chahta", "marna chahti", "atmahatya",
    # --- Bengali ---
    "বুকে ব্যথা", "বুকে ব্যাথা", "বুকে চাপ", "শ্বাস নিতে পারছি না", "শ্বাস নিতে কষ্ট",
    "শ্বাসকষ্ট", "দম বন্ধ", "অজ্ঞান", "জ্ঞান নেই", "প্রচুর রক্ত", "রক্তপাত",
    "আত্মহত্যা", "মরতে চাই", "বাঁচতে চাই না", "নিজেকে শেষ", "নিজের ক্ষতি",
    "খিঁচুনি", "স্ট্রোক", "হার্ট অ্যাটাক", "হার্ট এটাক", "বিষ খে", "ওভারডোজ", "একপাশ অবশ",
]

# Same message the English version always showed, now in all three languages.
EMERGENCY_TEXT = {
    "en": "This sounds like it could be a medical emergency. Please call 108 (ambulance) or 104 (health helpline) right now, or go to the nearest hospital immediately.",
    "hi": "यह आपातकाल जैसा लग रहा है। कृपया अभी 108 (एम्बुलेंस) या 104 (स्वास्थ्य हेल्पलाइन) पर कॉल करें, या तुरंत नज़दीकी अस्पताल जाएँ।",
    "bn": "এটি জরুরি অবস্থা হতে পারে। দয়া করে এখনই 108 (অ্যাম্বুলেন্স) বা 104 (স্বাস্থ্য হেল্পলাইন) নম্বরে ফোন করুন, অথবা এখনই নিকটতম হাসপাতালে যান।",
}


def _norm(s: str) -> str:
    # NFC so the same Hindi/Bengali word typed or transcribed in different
    # Unicode forms (e.g. nukta letters) still matches.
    return unicodedata.normalize("NFC", s).lower()


_PATTERNS = [_norm(p) for p in EMERGENCY_PATTERNS]


def check_emergency(text: str) -> bool:
    lowered = _norm(text)
    return any(p in lowered for p in _PATTERNS)
