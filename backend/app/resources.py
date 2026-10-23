import re
import requests
from app.llm import client, extract_json

HEADERS = {"User-Agent": "SmartCompanion/1.0 (final-year student project)"}
WIKI_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

_cache = {} 

SMALL_TALK = {
    "hi", "hii", "hiii", "hey", "heyy", "hello", "helo", "hola", "yo", "sup", "namaste", "namaskar",
    "good morning", "good afternoon", "good evening", "good night", "gm", "gn",
    "thanks", "thank you", "thanks a lot", "thx", "ty", "ok", "okay", "k", "cool", "nice", "great", "awesome",
    "bye", "goodbye", "see you", "got it", "yes", "no", "yeah", "yep", "nope", "sure", "please", "sorry",
    "welcome", "how are you", "how r u", "who are you", "what can you do", "whats up", "what's up",
    "hey there", "hello there", "hi there", "hey companion", "hello companion",
    "नमस्ते", "नमस्कार", "हेलो", "हैलो", "हाय", "धन्यवाद", "शुक्रिया", "ठीक है", "जी", "हाँ", "नहीं", "अलविदा",
    "হ্যালো", "হাই", "নমস্কার", "ধন্যবাদ", "ঠিক আছে", "হ্যাঁ", "না", "বিদায়",
}
_GREET_START = re.compile(r"^(hi+|hey+|hello+|helo|hola|namaste|good (morning|afternoon|evening|night))\b", re.I)
_INFO_START = re.compile(
    r"^(what|why|how|who|when|where|which|explain|define|describe|tell me|teach|recipe|cook|bake|make|"
    r"meaning of|difference between|solve|derive|prove|summar|notes on|about)\b", re.I)


def is_small_talk(goal: str) -> bool:
    """True for greetings, thanks, one-word replies and chit-chat. No AI call needed."""
    g = re.sub(r"[^\w\s\u0900-\u097F\u0980-\u09FF']", " ", (goal or "").lower())
    g = re.sub(r"\s+", " ", g).strip()
    if not g or g in SMALL_TALK:
        return True
    words = g.split()
    # "hey how are you", "hello can you help me": a greeting plus no real topic
    if _GREET_START.match(g) and len(words) <= 6:
        rest = " ".join(words[1:])
        chat = ("how are", "how r u", "can you help", "who are", "what can you", "i need help", "help me", "i want help", "whats up", "what s up")
        if not rest or rest in SMALL_TALK or rest.startswith(chat):
            return True
    return False


def looks_informational(goal: str) -> bool:
    """Used only if the AI check fails: a careful guess from the wording."""
    return bool(_INFO_START.match((goal or "").strip().lower()))


def extract_topic(goal: str) -> dict:
    """Ask the LLM for a clean topic + search phrases. Falls back to the raw goal."""
    fallback = {"topic": goal, "web_query": goal, "image_query": goal,
                "kind": "knowledge" if looks_informational(goal) else "other"}
    prompt = f"""From the user's request below, give search phrases and say what kind of request it is.
Respond with ONLY raw JSON in this shape:
{{"kind": "study | knowledge | cooking | other", "topic": "2-4 word main subject", "web_query": "best web search phrase to learn or do this", "image_query": "2-4 words for a helpful diagram or photo"}}

"kind" rules:
- "study": a school or college subject, exam topic, concept, formula, or how something works.
- "knowledge": a general fact or explanation (science, history, people, places, technology, the world).
- "cooking": a recipe, a food, or a cooking technique.
- "other": greetings, thanks, small talk, chores, tidying, plans, schedules, errands, bookings, reminders, feelings, health or medical questions, follow-up questions about the earlier chat, or anything that is not about learning a topic.

Example: "how to make biryani" ->
{{"kind": "cooking", "topic": "Biryani", "web_query": "easy chicken biryani recipe", "image_query": "biryani"}}
Example: "what is a black hole" ->
{{"kind": "knowledge", "topic": "Black hole", "web_query": "what is a black hole explained", "image_query": "black hole diagram"}}
Example: "clean my study desk" ->
{{"kind": "other", "topic": "Desk", "web_query": "", "image_query": ""}}

Request: "{goal}"
"""
    try:
        r = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.2,
            extra_body={"reasoning_effort": "low"},
        )
        data = extract_json((r.choices[0].message.content or "").strip())
        if data and data.get("topic"):
            return {
                "topic": data["topic"],
                "web_query": data.get("web_query") or data["topic"],
                "image_query": data.get("image_query") or data["topic"],
                "kind": str(data.get("kind") or "other").lower(),
            }
    except Exception as e:
        print(f"[resources] topic extraction failed: {e}")
    return fallback


def wikipedia_page(topic: str):
    """Best-matching Wikipedia article: title, url, short summary, lead image."""
    try:
        r = requests.get(WIKI_API, headers=HEADERS, timeout=6, params={
            "action": "query", "format": "json", "generator": "search",
            "gsrsearch": topic, "gsrlimit": 1,
            "prop": "extracts|pageimages|info", "exintro": 1, "explaintext": 1,
            "exsentences": 2, "piprop": "thumbnail", "pithumbsize": 600, "inprop": "url",
        })
        pages = (r.json().get("query") or {}).get("pages") or {}
        if not pages:
            return None
        p = next(iter(pages.values()))
        return {
            "title": p.get("title", topic),
            "url": p.get("fullurl"),
            "snippet": (p.get("extract") or "")[:220],
            "image": (p.get("thumbnail") or {}).get("source"),
        }
    except Exception as e:
        print(f"[resources] wikipedia failed: {e}")
        return None


def commons_images(query: str, n: int = 3):
    """Diagrams / photos from Wikimedia Commons (free to use)."""
    try:
        r = requests.get(COMMONS_API, headers=HEADERS, timeout=6, params={
            "action": "query", "format": "json", "generator": "search",
            "gsrnamespace": 6, "gsrsearch": query, "gsrlimit": 10,
            "prop": "imageinfo", "iiprop": "url|mime", "iiurlwidth": 500,
        })
        pages = (r.json().get("query") or {}).get("pages") or {}
        out = []
        for p in sorted(pages.values(), key=lambda x: x.get("index", 0)):
            info = (p.get("imageinfo") or [{}])[0]
            if info.get("mime") not in ("image/jpeg", "image/png", "image/svg+xml"):
                continue
            src = info.get("thumburl") or info.get("url")
            if not src:
                continue
            caption = p.get("title", "").replace("File:", "").rsplit(".", 1)[0]
            out.append({"src": src, "link": info.get("descriptionurl"), "caption": caption})
            if len(out) == n:
                break
        return out
    except Exception as e:
        print(f"[resources] commons failed: {e}")
        return []


def web_links(query: str, n: int = 2):
    """1-2 non-Wikipedia links via DuckDuckGo. Optional: pip install ddgs"""
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS
        out = []
        for h in DDGS().text(query, max_results=8):
            url = h.get("href") or ""
            if not url.startswith("http") or "wikipedia.org" in url:
                continue
            out.append({"title": h.get("title", url)[:90], "url": url,
                        "snippet": (h.get("body") or "")[:160]})
            if len(out) == n:
                break
        return out
    except Exception as e:
        print(f"[resources] web search skipped: {e}")
        return []


EMPTY = {"topic": "", "links": [], "images": []}
EXPLORE_KINDS = {"study", "knowledge", "cooking"}


def get_resources(goal: str) -> dict:
    if is_small_talk(goal):                 
        return EMPTY
    t = extract_topic(goal)
    if t.get("kind") not in EXPLORE_KINDS:  
        return EMPTY
    key = t["topic"].lower()
    if key in _cache:
        return _cache[key]

    links, images = [], []

    wiki = wikipedia_page(t["topic"])
    if wiki and wiki["url"]:
        links.append({"title": wiki["title"] + " (Wikipedia)", "url": wiki["url"],
                      "snippet": wiki["snippet"]})
        if wiki["image"]:
            images.append({"src": wiki["image"], "link": wiki["url"], "caption": wiki["title"]})

    links += web_links(t["web_query"], n=3 - len(links))   # total max 3 links
    images += commons_images(t["image_query"], n=4 - len(images))  # total max 4 images

    result = {"topic": t["topic"], "links": links[:3], "images": images[:4]}
    if links or images:
        _cache[key] = result
    return result