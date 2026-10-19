"""Encrypted sync store.

The server only ever holds an encrypted blob it cannot read. The key stays on the user's
devices. Each account is a random id plus a secret token (both derived on the device from
the user's Sync key). We keep only a hash of the token.
"""
import hashlib, hmac, re, sqlite3, time, threading
from pathlib import Path
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/sync", tags=["sync"])

DB_PATH = Path(__file__).resolve().parent.parent / "sync_store.db"
MAX_BLOB = 4 * 1024 * 1024          # 4 MB of ciphertext is far more than health data needs
ID_RE = re.compile(r"^[0-9a-f]{64}$")
_lock = threading.Lock()


def _db():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.execute("CREATE TABLE IF NOT EXISTS sync (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, "
              "rev INTEGER NOT NULL, blob TEXT NOT NULL, updated REAL NOT NULL)")
    return c


# very small per-IP limiter (60 requests a minute) so nobody can hammer the store
_hits: dict = {}
def _limit(request: Request):
    ip = request.client.host if request.client else "?"
    now = time.time()
    q = [t for t in _hits.get(ip, []) if now - t < 60]
    if len(q) >= 60:
        raise HTTPException(429, "Too many requests. Please wait a minute.")
    q.append(now); _hits[ip] = q


def _token(auth: str) -> str:
    if not auth or not auth.startswith("Bearer ") or len(auth) > 200:
        raise HTTPException(401, "Missing token")
    return auth[7:].strip()


def _check(row, token: str):
    ok = hmac.compare_digest(row[0], hashlib.sha256(token.encode()).hexdigest())
    if not ok:
        raise HTTPException(403, "Wrong sync key")


class PutBody(BaseModel):
    base_rev: int = 0        
    blob: str                


@router.get("/{sid}")
def get_blob(sid: str, request: Request, authorization: str = Header("")):
    _limit(request)
    if not ID_RE.match(sid): raise HTTPException(400, "Bad id")
    tok = _token(authorization)
    with _lock, _db() as c:
        row = c.execute("SELECT token_hash, rev, blob, updated FROM sync WHERE id=?", (sid,)).fetchone()
    if not row: raise HTTPException(404, "Nothing stored for this key")
    _check(row, tok)
    return {"rev": row[1], "blob": row[2], "updated": row[3]}


@router.put("/{sid}")
def put_blob(sid: str, body: PutBody, request: Request, authorization: str = Header("")):
    _limit(request)
    if not ID_RE.match(sid): raise HTTPException(400, "Bad id")
    if len(body.blob) > MAX_BLOB: raise HTTPException(413, "Too large")
    tok = _token(authorization)
    with _lock, _db() as c:
        row = c.execute("SELECT token_hash, rev, blob FROM sync WHERE id=?", (sid,)).fetchone()
        if row is None:
            c.execute("INSERT INTO sync VALUES (?,?,?,?,?)",
                      (sid, hashlib.sha256(tok.encode()).hexdigest(), 1, body.blob, time.time()))
            return {"rev": 1}
        _check(row, tok)
        if row[1] != body.base_rev:       # another device saved first: client must merge and retry
            raise HTTPException(409, detail={"rev": row[1], "blob": row[2]})
        rev = row[1] + 1
        c.execute("UPDATE sync SET blob=?, rev=?, updated=? WHERE id=?", (body.blob, rev, time.time(), sid))
        return {"rev": rev}


@router.delete("/{sid}")
def delete_blob(sid: str, request: Request, authorization: str = Header("")):
    _limit(request)
    if not ID_RE.match(sid): raise HTTPException(400, "Bad id")
    tok = _token(authorization)
    with _lock, _db() as c:
        row = c.execute("SELECT token_hash FROM sync WHERE id=?", (sid,)).fetchone()
        if row:
            _check(row, tok)
            c.execute("DELETE FROM sync WHERE id=?", (sid,))
    return {"deleted": True}