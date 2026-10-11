# resources.py - "Explore more": finds 2-3 good links + a few images/diagrams
# for whatever the user asked. Everything here is FREE and needs no API key:
#   - Wikipedia API      -> best encyclopedia link + lead image
#   - Wikimedia Commons  -> real diagrams / photos (openly licensed)
#   - DuckDuckGo search  -> 1-2 other web links (optional; skipped if not installed)
# Nothing is invented: every link and image comes from a real search result.

import requests
from app.llm import client, extract_json

HEADERS = {"User-Agent": "SmartCompanion/1.0 (final-year student project)"}
WIKI_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

_cache = {}  # topic -> result, so repeat questions are instant


def extract_topic(goal: str) -> dict:
    """Ask the LLM for a clean topic + search phrases. Falls back to the raw goal."""
    fallback = {"topic": goal, "web_query": goal, "image_query": goal}
    prompt = f"""From the user's request below, give search phrases.
Respond with ONLY raw JSON in this shape:
{{"topic": "2-4 word main subject", "web_query": "best web search phrase to learn or do this", "image_query": "2-4 words for a helpful diagram or photo"}}

Example: "how to make biryani" ->
{{"topic": "Biryani", "web_query": "easy chicken biryani recipe", "image_query": "biryani"}}
Example: "what is a black hole" ->
{{"topic": "Black hole", "web_query": "what is a black hole explained", "image_query": "black hole diagram"}}

Request: "{goal}"
"""
    try:
        r = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.2,
        )
        data = extract_json((r.choices[0].message.content or "").strip())
        if data and data.get("topic"):
            return {
                "topic": data["topic"],
                "web_query": data.get("web_query") or data["topic"],
                "image_query": data.get("image_query") or data["topic"],
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


def get_resources(goal: str) -> dict:
    t = extract_topic(goal)
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