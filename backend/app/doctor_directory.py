import math
import os
import re
import sqlite3
import requests
from fastapi import APIRouter
from pydantic import BaseModel

DB_PATH = os.path.join(os.path.dirname(__file__), "doctors.db")
router = APIRouter(prefix="/directory", tags=["directory"])


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            osm_id TEXT UNIQUE,
            name TEXT, specialty TEXT DEFAULT 'general',
            address TEXT, phone TEXT, timings TEXT,
            lat REAL, lon REAL,
            source TEXT DEFAULT 'osm',
            verified INTEGER DEFAULT 0
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS appointment_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_id INTEGER, patient_name TEXT,
            preferred_time TEXT, note TEXT,
            status TEXT DEFAULT 'requested',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS seeded_areas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL, lon REAL, radius_km REAL,
            seeded_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""")


OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
]


def seed_from_osm(south: float, west: float, north: float, east: float) -> int:
    query = f"""
    [out:json][timeout:60];
    (
      nwr["amenity"~"^(doctors|clinic|hospital|dentist)$"]({south},{west},{north},{east});
      nwr["healthcare"="doctor"]({south},{west},{north},{east});
    );
    out center tags;
    """
    data = None
    for url in OVERPASS_MIRRORS:
        try:
            res = requests.post(url, data={"data": query},
                                headers={"User-Agent": "SmartCompanionApp/1.0"}, timeout=90)
            res.raise_for_status()
            data = res.json()
            print(f"[seed_from_osm] succeeded via {url}")
            break
        except Exception as exc:
            print(f"[seed_from_osm] {url} failed: {exc}")

    if data is None:
        print("[seed_from_osm] all mirrors failed - try again in a few minutes")
        return 0

    added = 0
    with _conn() as c:
        for el in data.get("elements", []):
            tags = el.get("tags", {})
            lat = el.get("lat") or el.get("center", {}).get("lat")
            lon = el.get("lon") or el.get("center", {}).get("lon")
            if lat is None or not tags.get("name"):
                continue
            address = ", ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street"),
                                              tags.get("addr:suburb"), tags.get("addr:city")]))
            cur = c.execute(
                """INSERT OR IGNORE INTO doctors
                   (osm_id, name, specialty, address, phone, timings, lat, lon, source)
                   VALUES (?,?,?,?,?,?,?,?, 'osm')""",
                (f"{el['type']}/{el['id']}", tags["name"],
                 tags.get("healthcare:speciality", "general"), address,
                 tags.get("phone") or tags.get("contact:phone"), tags.get("opening_hours"), lat, lon))
            added += cur.rowcount
    return added


def seed_by_place(place: str, radius_km: float = 5) -> dict:
    res = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": place, "format": "json", "limit": 1},
        headers={"User-Agent": "SmartCompanionApp/1.0 (student project)"},
        timeout=10,
    )
    results = res.json()
    if not results:
        return {"found": False, "added": 0}

    lat, lon = float(results[0]["lat"]), float(results[0]["lon"])
    display_name = results[0]["display_name"]

    current_radius = radius_km
    for attempt in range(3):
        deg = current_radius / 111.0
        added = seed_from_osm(lat - deg, lon - deg, lat + deg, lon + deg)
        if added > 0:
            _mark_area_seeded(lat, lon, radius_km)
            return {"found": True, "place": display_name, "added": added, "radius_km_used": current_radius}
        print(f"[seed_by_place] {current_radius}km got 0 results (likely timeout) - shrinking and retrying")
        current_radius = round(current_radius / 2, 1)

    return {"found": True, "place": display_name, "added": 0, "note": "all attempts failed even at a small radius - try again later"}


def _km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2 +
         math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 6371 * 2 * math.asin(math.sqrt(a))


def _mark_area_seeded(lat: float, lon: float, radius_km: float):
    with _conn() as c:
        c.execute("INSERT INTO seeded_areas (lat, lon, radius_km) VALUES (?,?,?)", (lat, lon, radius_km))


def _area_already_covered(lat: float, lon: float) -> bool:
    with _conn() as c:
        rows = c.execute("SELECT lat, lon, radius_km FROM seeded_areas").fetchall()
    return any(_km(lat, lon, r["lat"], r["lon"]) <= r["radius_km"] for r in rows)


def ensure_area_seeded(lat: float, lon: float, radius_km: float = 5) -> dict:
    if _area_already_covered(lat, lon):
        return {"newly_seeded": False}

    current_radius = radius_km
    added = 0
    for attempt in range(3):
        deg = current_radius / 111.0
        added = seed_from_osm(lat - deg, lon - deg, lat + deg, lon + deg)
        if added > 0 or current_radius < 1:
            break
        current_radius = round(current_radius / 2, 1)

    _mark_area_seeded(lat, lon, radius_km)
    return {"newly_seeded": True, "added": added}


@router.get("/search")
def search(lat: float, lon: float, specialty: str = "", radius_km: float = 5, limit: int = 10):
    ensure_area_seeded(lat, lon, radius_km)
    with _conn() as c:
        rows = c.execute("SELECT * FROM doctors WHERE specialty LIKE ?", (f"%{specialty}%",)).fetchall()
    results = []
    for r in rows:
        d = _km(lat, lon, r["lat"], r["lon"])
        if d <= radius_km:
            item = dict(r)
            item["distance_km"] = round(d, 2)
            results.append(item)
    results.sort(key=lambda x: (-x["verified"], x["distance_km"]))
    return {"count": len(results[:limit]), "doctors": results[:limit]}


class DoctorIn(BaseModel):
    name: str
    specialty: str = "general"
    address: str = ""
    phone: str = ""
    timings: str = ""
    lat: float
    lon: float


@router.get("/geocode")
def geocode(place: str):
    try:
        res = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": place, "format": "json", "limit": 1},
            headers={"User-Agent": "SmartCompanionApp/1.0 (student project)"},
            timeout=10,
        )
        res.raise_for_status()
        results = res.json()
        if not results:
            return {"found": False}
        return {
            "found": True,
            "lat": float(results[0]["lat"]),
            "lon": float(results[0]["lon"]),
            "display_name": results[0]["display_name"],
        }
    except Exception as exc:
        print(f"[geocode] failed: {exc}")
        return {"found": False}


@router.post("/doctors")
def register_doctor(d: DoctorIn):
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO doctors (name, specialty, address, phone, timings, lat, lon, source) "
            "VALUES (?,?,?,?,?,?,?, 'self_registered')",
            (d.name, d.specialty, d.address, d.phone, d.timings, d.lat, d.lon))
    return {"id": cur.lastrowid, "verified": 0}


@router.post("/doctors/{doctor_id}/verify")
def verify_doctor(doctor_id: int):
    with _conn() as c:
        c.execute("UPDATE doctors SET verified=1 WHERE id=?", (doctor_id,))
    return {"id": doctor_id, "verified": 1}


class AppointmentIn(BaseModel):
    doctor_id: int
    patient_name: str
    preferred_time: str
    note: str = ""


@router.post("/appointments")
def request_appointment(a: AppointmentIn):
    with _conn() as c:
        doc = c.execute("SELECT name, phone FROM doctors WHERE id=?", (a.doctor_id,)).fetchone()
        if not doc:
            return {"error": "Doctor not found"}
        cur = c.execute(
            "INSERT INTO appointment_requests (doctor_id, patient_name, preferred_time, note) VALUES (?,?,?,?)",
            (a.doctor_id, a.patient_name, a.preferred_time, a.note))

    whatsapp_link = None
    if doc["phone"]:
        digits = re.sub(r"\D", "", doc["phone"])
        if len(digits) == 10:
            digits = "91" + digits
        msg = (f"Hello, I'd like an appointment with {doc['name']} around {a.preferred_time}. "
               f"Name: {a.patient_name}. {a.note}").strip()
        whatsapp_link = f"https://wa.me/{digits}?text={requests.utils.quote(msg)}"

    return {"request_id": cur.lastrowid, "status": "requested", "whatsapp_link": whatsapp_link,
            "message": "Tap the link to send your request to the clinic." if whatsapp_link
                       else "This clinic has no phone on file yet - showing address only."}
    
    
