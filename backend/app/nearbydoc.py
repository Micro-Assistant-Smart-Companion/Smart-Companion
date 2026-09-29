import math
import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

INDIA_HEALTH_HELPLINES = [
    {"name": "National Health Helpline", "phone": "104"},
    {"name": "Ambulance", "phone": "108"},
    {"name": "Ask your local ASHA worker or nearest Primary Health Centre (PHC)", "phone": None},
]


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def find_nearby_healthcare(lat: float, lng: float, radius_km: float = 15) -> list:
    """Widened to general hospitals/clinics/doctors rather than filtering by
    specialty - OSM rarely tags specific specialties, so a narrow filter
    would return nothing useful even where facilities do exist."""
    radius_m = int(radius_km * 1000)
    query = f"""
    [out:json][timeout:20];
    (
      node["amenity"="hospital"](around:{radius_m},{lat},{lng});
      node["amenity"="clinic"](around:{radius_m},{lat},{lng});
      node["amenity"="doctors"](around:{radius_m},{lat},{lng});
      node["healthcare"](around:{radius_m},{lat},{lng});
    );
    out center;
    """
    try:
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=25)
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
    except Exception as exc:
        print(f"[nearby] Overpass query failed: {exc}")
        return []

    results = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue
        elat, elng = el.get("lat"), el.get("lon")
        distance = round(_haversine_km(lat, lng, elat, elng), 1) if elat and elng else None
        results.append({
            "name": name,
            "type": tags.get("amenity") or tags.get("healthcare") or "healthcare facility",
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "address": tags.get("addr:full") or tags.get("addr:street"),
            "distance_km": distance,
        })

    results.sort(key=lambda r: r["distance_km"] if r["distance_km"] is not None else 999)
    return results[:10]