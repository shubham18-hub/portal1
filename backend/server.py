from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Query, UploadFile, File
from fastapi.responses import StreamingResponse, RedirectResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
import uuid
import bcrypt
import secrets
import hashlib
import base64
import json
import math
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import httpx
from pymongo.errors import DuplicateKeyError
from openpyxl import Workbook
from urllib.parse import urlencode, urlparse, parse_qs

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

ALLOWED_DOMAINS = {
    d.strip().lower()
    for d in os.environ.get("ALLOWED_EMAIL_DOMAINS", "").split(",")
    if d.strip()
}
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").lower()
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "")

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
MAX_SUBMISSION_FILE_SIZE = int(os.environ.get("MAX_SUBMISSION_FILE_SIZE", str(10 * 1024 * 1024)))
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# OAuth state store (in production, use Redis or similar)
oauth_states: Dict[str, float] = {}

app = FastAPI(title="KLECBA Feedback Portal")
api = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("klecba")


@app.on_event("startup")
async def on_startup():
    try:
        await db.task_submissions.create_index([("user_id", 1), ("task_id", 1)], unique=True, name="unique_student_task_submission")
    except Exception as error:
        logger.error("Unable to create submission uniqueness index: %s", type(error).__name__)


# ---------------- Helpers ----------------
def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_deadline(value: Any) -> Optional[str]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(400, "deadline must be a valid ISO datetime") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def uid(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}" if prefix else uuid.uuid4().hex


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        key: value
        for key, value in user.items()
        if key not in {"_id", "password_hash", "session_token"}
    }


def domain_allowed(email: str) -> bool:
    if not ALLOWED_DOMAINS:
        return True  # Not configured -> allow (dev)
    return email.lower().split("@")[-1] in ALLOWED_DOMAINS


async def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(401, "Invalid session")
    exp = session["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


async def require_role(request: Request, roles: List[str]):
    user = await get_current_user(request)
    if user.get("role") not in roles:
        raise HTTPException(403, "Not allowed")
    return user


async def create_session_for(user_id: str, response: Response, remember_days: int = 7) -> str:
    token = f"sess_{secrets.token_urlsafe(32)}"
    expires = datetime.now(timezone.utc) + timedelta(days=remember_days)
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": expires.isoformat(), "created_at": utcnow_iso(),
    })
    response.set_cookie(
        "session_token", token, path="/", httponly=True, secure=True,
        samesite="none", max_age=remember_days * 24 * 3600,
    )
    return token


# ---------------- Auth (Google + Admin password) ----------------
@api.post("/auth/session")
async def create_session(payload: Dict[str, str], response: Response):
    """Legacy Emergent Google OAuth session exchange for STUDENT/FACULTY only."""
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id required")
    async with httpx.AsyncClient(timeout=15.0) as hx:
        r = await hx.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Invalid session_id")
    data = r.json()
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(401, "Invalid session_id")

    if not domain_allowed(email):
        raise HTTPException(403, "Only college domain emails allowed. Contact administration.")

    if email == ADMIN_EMAIL:
        raise HTTPException(403, "Admin accounts must use the admin login.")

    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not session_token:
        raise HTTPException(401, "Invalid session_id")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_login": utcnow_iso()}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "role": "student", "created_at": utcnow_iso(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": expires_at.isoformat(), "created_at": utcnow_iso(),
    })
    response.set_cookie(
        "session_token", session_token, path="/", httponly=True, secure=True,
        samesite="none", max_age=7 * 24 * 3600,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": public_user(user)}


@api.post("/auth/admin-login")
async def admin_login(payload: Dict[str, str], response: Response):
    email = (payload.get("email") or "").lower().strip()
    password = payload.get("password") or ""
    if not email or not password:
        raise HTTPException(400, "email and password required")
    if not ADMIN_EMAIL or not ADMIN_PASSWORD_HASH:
        raise HTTPException(500, "Admin not configured")
    if email != ADMIN_EMAIL:
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(password.encode(), ADMIN_PASSWORD_HASH.encode()):
        raise HTTPException(401, "Invalid credentials")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"role": "admin", "last_login": utcnow_iso()}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": "KLECBA Admin",
            "role": "admin", "picture": None, "created_at": utcnow_iso(),
        })
    await create_session_for(user_id, response)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": public_user(user)}


@api.post("/auth/register")
async def register(payload: Dict[str, str], response: Response):
    email = (payload.get("email") or "").lower().strip()
    password = payload.get("password") or ""
    name = (payload.get("name") or "").strip()
    if not email or "@" not in email or not name:
        raise HTTPException(400, "name and valid email are required")
    if len(password) < 8:
        raise HTTPException(400, "password must be at least 8 characters")
    if not domain_allowed(email):
        raise HTTPException(403, "Only college domain emails are allowed")
    if email == ADMIN_EMAIL:
        raise HTTPException(403, "Admin accounts must use the admin login")
    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(409, "An account with this email already exists")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": "student",
        "picture": None,
        "password_hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
        "created_at": utcnow_iso(),
    }
    await db.users.insert_one(user)
    await create_session_for(user_id, response)
    return {"user": public_user(user)}


@api.post("/auth/login")
async def login(payload: Dict[str, str], response: Response):
    email = (payload.get("email") or "").lower().strip()
    password = payload.get("password") or ""
    if not email or not password:
        raise HTTPException(400, "email and password are required")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    password_hash = user.get("password_hash") if user else None
    if not user or not password_hash or not bcrypt.checkpw(password.encode(), password_hash.encode()):
        raise HTTPException(401, "Invalid credentials")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_login": utcnow_iso()}})
    await create_session_for(user["user_id"], response)
    return {"user": public_user(user)}


@api.get("/auth/me")
async def me(request: Request):
    user = await get_current_user(request)
    profile = None
    if user.get("role") == "student":
        profile = await db.student_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": public_user(user), "profile": profile}


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------------- Google OAuth 2.0 Direct Flow ----------------
@api.get("/auth/google/url")
async def get_google_oauth_url():
    """Generate Google OAuth 2.0 authorization URL with PKCE-like state."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(500, "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")
    
    # Generate cryptographically secure state
    state = secrets.token_urlsafe(32)
    oauth_states[state] = datetime.now(timezone.utc).timestamp()
    
    # Clean up old states (older than 10 minutes)
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).timestamp()
    oauth_states.update({k: v for k, v in oauth_states.items() if v > cutoff})
    
    redirect_uri = f"{FRONTEND_URL}/auth/callback"
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    
    return {"url": auth_url, "state": state}


@api.get("/auth/google/callback")
async def google_oauth_callback(code: str, state: str, response: Response):
    """Handle Google OAuth 2.0 callback and create user session."""
    # Verify state to prevent CSRF
    if state not in oauth_states:
        raise HTTPException(400, "Invalid or expired OAuth state")
    
    # Remove used state
    oauth_states.pop(state, None)
    
    if not code:
        raise HTTPException(400, "Authorization code required")
    
    redirect_uri = f"{FRONTEND_URL}/auth/callback"
    
    # Exchange code for tokens
    async with httpx.AsyncClient(timeout=15.0) as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    
    if token_response.status_code != 200:
        logger.error(f"Google token exchange failed: {token_response.text}")
        raise HTTPException(400, "Failed to exchange authorization code")
    
    tokens = token_response.json()
    access_token = tokens.get("access_token")
    
    # Get user info from Google
    async with httpx.AsyncClient(timeout=15.0) as client:
        user_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    
    if user_response.status_code != 200:
        logger.error(f"Google user info failed: {user_response.text}")
        raise HTTPException(400, "Failed to get user information")
    
    user_info = user_response.json()
    email = user_info.get("email", "").lower()
    
    if not email:
        raise HTTPException(400, "Email not provided by Google")
    
    # Enforce college domain restriction
    if not domain_allowed(email):
        error_url = f"{FRONTEND_URL}/login?error=domain"
        return RedirectResponse(url=error_url, status_code=302)
    
    # NOTE: Temporarily allowing admin to sign in via Google OAuth for testing
    # In production, uncomment the check below to force admin-only login
    # if email == ADMIN_EMAIL:
    #     error_url = f"{FRONTEND_URL}/login?error=admin_only"
    #     return RedirectResponse(url=error_url, status_code=302)
    
    name = user_info.get("name") or email.split("@")[0]
    picture = user_info.get("picture")
    
    # Create or update user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_login": utcnow_iso()}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        # Determine user role: admin if email matches ADMIN_EMAIL, otherwise student
        user_role = "admin" if email == ADMIN_EMAIL else "student"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": user_role,
            "created_at": utcnow_iso(),
        })
    
    # Create session
    token = f"sess_{secrets.token_urlsafe(32)}"
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": expires.isoformat(),
        "created_at": utcnow_iso(),
    })
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    # Set cookie and redirect to frontend
    redirect_response = RedirectResponse(url=f"{FRONTEND_URL}/auth/success", status_code=302)
    redirect_response.set_cookie(
        "session_token",
        token,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",  # Allow cross-site cookies for OAuth flow
        max_age=7 * 24 * 3600,
    )
    
    return redirect_response


@api.get("/auth/google/status")
async def check_google_oauth_status():
    """Check if Google OAuth is properly configured."""
    return {
        "configured": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
        "client_id_set": bool(GOOGLE_CLIENT_ID),
        "client_secret_set": bool(GOOGLE_CLIENT_SECRET),
        "frontend_url": FRONTEND_URL,
    }


# ---------------- Preview/Demo Sessions (testing only) ----------------
PREVIEW_ACCOUNTS = {
    "student": {"email": "preview.student@klecba.edu.in", "name": "Preview Student"},
    "faculty": {"email": "preview.faculty@klecba.edu.in", "name": "Preview Faculty"},
    "admin":   {"email": "preview.admin@klecba.edu.in",   "name": "Preview Admin"},
}


@api.post("/auth/dev-preview")
async def dev_preview(payload: Dict[str, str], response: Response):
    """Create/reuse a demo account for the requested role and sign in.
    Not linked from the public login page — intended for internal testing/demo only."""
    role = (payload.get("role") or "").strip().lower()
    if role not in PREVIEW_ACCOUNTS:
        raise HTTPException(400, "role must be student|faculty|admin")
    acct = PREVIEW_ACCOUNTS[role]
    existing = await db.users.find_one({"email": acct["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"role": role, "name": acct["name"], "last_login": utcnow_iso()}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": acct["email"], "name": acct["name"],
            "role": role, "picture": None, "created_at": utcnow_iso(),
        })

    # For student preview, auto-assign a profile so the dashboard is meaningful
    if role == "student":
        prof = await db.student_profiles.find_one({"user_id": user_id}, {"_id": 0})
        if not prof:
            program = await db.programs.find_one({}, {"_id": 0})
            year = await db.year_levels.find_one({}, {"_id": 0}, sort=[("order", 1)])
            sem = await db.semesters.find_one({}, {"_id": 0}, sort=[("order", 1)])
            div = await db.divisions.find_one({}, {"_id": 0})
            ay = await db.academic_years.find_one({}, {"_id": 0})
            if program and year and sem and div:
                await db.student_profiles.insert_one({
                    "user_id": user_id,
                    "student_id": "PREVIEW-001",
                    "department_id": program.get("department_id"),
                    "program_id": program["id"],
                    "year_level_id": year["id"],
                    "semester_id": sem["id"],
                    "division_id": div["id"],
                    "academic_year_id": ay["id"] if ay else None,
                    "updated_at": utcnow_iso(),
                })

    await create_session_for(user_id, response)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user}




# ---------------- Academic Structure ----------------
STRUCTURE_ENTITIES = {
    "departments": ["name", "code"],
    "programs": ["name", "code", "department_id"],
    "academic_years": ["name"],  # e.g., 2025-2026
    "year_levels": ["name", "order"],  # 1st Year, 2nd Year
    "semesters": ["name", "order"],  # Semester 1
    "divisions": ["name"],  # A, B, C
    "subjects": ["name", "code"],
}


def struct_router(entity: str, fields: List[str]):
    @api.get(f"/{entity}")
    async def _list():
        docs = await db[entity].find({}, {"_id": 0}).to_list(2000)
        return docs

    @api.post(f"/{entity}")
    async def _create(payload: Dict[str, Any], request: Request):
        await require_admin(request)
        doc = {k: payload.get(k) for k in fields}
        doc["id"] = uid()
        doc["active"] = payload.get("active", True)
        doc["created_at"] = utcnow_iso()
        await db[entity].insert_one(doc)
        doc.pop("_id", None)
        return doc

    @api.put(f"/{entity}/{{oid}}")
    async def _update(oid: str, payload: Dict[str, Any], request: Request):
        await require_admin(request)
        existing = await db[entity].find_one({"id": oid}, {"_id": 0})
        if not existing:
            raise HTTPException(404, f"{entity} not found")
        upd = {k: payload.get(k) for k in fields if k in payload}
        if "active" in payload:
            upd["active"] = payload["active"]
        await db[entity].update_one({"id": oid}, {"$set": upd})
        return await db[entity].find_one({"id": oid}, {"_id": 0})

    @api.delete(f"/{entity}/{{oid}}")
    async def _delete(oid: str, request: Request):
        await require_admin(request)
        existing = await db[entity].find_one({"id": oid}, {"_id": 0})
        if not existing:
            raise HTTPException(404, f"{entity} not found")
        # Referential integrity: block delete if referenced
        ref_map = {
            "departments": [("programs", "department_id"), ("users", "department_id"),
                             ("student_profiles", "department_id"), ("feedback_cycles", "department_id")],
            "programs": [("faculty_assignments", "program_id"), ("student_profiles", "program_id"), ("feedback_cycles", "program_id"), ("stages", "program_id")],
            "subjects": [("faculty_assignments", "subject_id")],
            "divisions": [("faculty_assignments", "division_id"), ("student_profiles", "division_id")],
            "semesters": [("faculty_assignments", "semester_id"), ("student_profiles", "semester_id"), ("feedback_cycles", "semester_id")],
            "year_levels": [("faculty_assignments", "year_level_id"), ("student_profiles", "year_level_id"), ("feedback_cycles", "year_level_id")],
            "academic_years": [("faculty_assignments", "academic_year_id"), ("student_profiles", "academic_year_id"), ("feedback_cycles", "academic_year_id")],
        }
        for coll, key in ref_map.get(entity, []):
            if await db[coll].count_documents({key: oid}):
                raise HTTPException(400, f"Cannot delete: referenced by {coll}")
        await db[entity].delete_one({"id": oid})
        return {"ok": True}


for _entity, _fields in STRUCTURE_ENTITIES.items():
    struct_router(_entity, _fields)


# ---------------- Program stages and tasks ----------------
@api.get("/stages")
async def list_stages(request: Request, program_id: Optional[str] = Query(None)):
    await require_role(request, ["admin", "student"])
    query = {"program_id": program_id} if program_id else {}
    return await db.stages.find(query, {"_id": 0}).sort("order", 1).to_list(2000)


@api.post("/stages")
async def create_stage(payload: Dict[str, Any], request: Request):
    await require_admin(request)
    program_id = (payload.get("program_id") or "").strip()
    name = (payload.get("name") or "").strip()
    if not program_id or not name:
        raise HTTPException(400, "program_id and name are required")
    if not await db.programs.find_one({"id": program_id}, {"_id": 0}):
        raise HTTPException(404, "Program not found")
    stage = {
        "id": uid(), "program_id": program_id, "name": name,
        "order": int(payload.get("order") or 1), "active": True,
        "created_at": utcnow_iso(),
    }
    await db.stages.insert_one(stage)
    stage.pop("_id", None)
    return stage


@api.put("/stages/{stage_id}")
async def update_stage(stage_id: str, payload: Dict[str, Any], request: Request):
    await require_admin(request)
    existing = await db.stages.find_one({"id": stage_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Stage not found")
    updates = {}
    if "name" in payload and str(payload["name"]).strip():
        updates["name"] = str(payload["name"]).strip()
    if "order" in payload:
        updates["order"] = int(payload["order"])
    if "active" in payload:
        updates["active"] = bool(payload["active"])
    if updates:
        await db.stages.update_one({"id": stage_id}, {"$set": updates})
    return await db.stages.find_one({"id": stage_id}, {"_id": 0})


@api.delete("/stages/{stage_id}")
async def delete_stage(stage_id: str, request: Request):
    await require_admin(request)
    if not await db.stages.find_one({"id": stage_id}, {"_id": 0}):
        raise HTTPException(404, "Stage not found")
    if await db.tasks.count_documents({"stage_id": stage_id}):
        raise HTTPException(400, "Cannot delete: stage has tasks")
    await db.stages.delete_one({"id": stage_id})
    return {"ok": True}


@api.get("/tasks")
async def list_tasks(request: Request, stage_id: Optional[str] = Query(None), program_id: Optional[str] = Query(None)):
    await require_role(request, ["admin", "student"])
    query = {}
    if stage_id:
        query["stage_id"] = stage_id
    if program_id:
        query["program_id"] = program_id
    return await db.tasks.find(query, {"_id": 0}).sort([("stage_id", 1), ("order", 1), ("created_at", 1)]).to_list(5000)


@api.post("/tasks")
async def create_task(payload: Dict[str, Any], request: Request):
    await require_admin(request)
    stage_id = (payload.get("stage_id") or "").strip()
    title = (payload.get("title") or "").strip()
    if not stage_id or not title:
        raise HTTPException(400, "stage_id and title are required")
    stage = await db.stages.find_one({"id": stage_id}, {"_id": 0})
    if not stage:
        raise HTTPException(404, "Stage not found")
    task = {
        "id": uid(), "program_id": stage["program_id"], "stage_id": stage_id,
        "title": title, "description": (payload.get("description") or "").strip(),
        "deadline": normalize_deadline(payload.get("deadline")),
        "order": int(payload.get("order") or 1), "active": True,
        "created_at": utcnow_iso(), "updated_at": utcnow_iso(),
    }
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task


@api.put("/tasks/{task_id}")
async def update_task(task_id: str, payload: Dict[str, Any], request: Request):
    await require_admin(request)
    existing = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Task not found")
    updates = {"updated_at": utcnow_iso()}
    if "title" in payload and str(payload["title"]).strip():
        updates["title"] = str(payload["title"]).strip()
    if "description" in payload:
        updates["description"] = str(payload["description"] or "").strip()
    if "deadline" in payload:
        updates["deadline"] = normalize_deadline(payload.get("deadline"))
    if "order" in payload:
        updates["order"] = int(payload["order"])
    if "active" in payload:
        updates["active"] = bool(payload["active"])
    await db.tasks.update_one({"id": task_id}, {"$set": updates})
    return await db.tasks.find_one({"id": task_id}, {"_id": 0})


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    await require_admin(request)
    if not await db.tasks.find_one({"id": task_id}, {"_id": 0}):
        raise HTTPException(404, "Task not found")
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}


# ---------------- Task submissions ----------------
async def _submission_for_user(task_id: str, user_id: str):
    return await db.task_submissions.find_one({"task_id": task_id, "user_id": user_id}, {"_id": 0})


@api.post("/tasks/{task_id}/submission")
async def submit_task(task_id: str, request: Request, file: UploadFile = File(...)):
    user = await require_role(request, ["student"])
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task or task.get("active") is False:
        raise HTTPException(404, "Task not found")
    if await _submission_for_user(task_id, user["user_id"]):
        raise HTTPException(409, "A submission already exists for this task")
    deadline = task.get("deadline")
    if deadline:
        deadline_dt = datetime.fromisoformat(deadline)
        if deadline_dt.tzinfo is None:
            deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > deadline_dt:
            raise HTTPException(400, "The task deadline has passed")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed")
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(400, "Only PDF files are allowed")

    submission_id = uid("sub_")
    stored_name = f"{submission_id}.pdf"
    stored_path = UPLOAD_DIR / stored_name
    total_size = 0
    first_chunk = True
    try:
        with stored_path.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                if first_chunk and not chunk.startswith(b"%PDF-"):
                    raise HTTPException(400, "The uploaded file is not a valid PDF")
                first_chunk = False
                total_size += len(chunk)
                if total_size > MAX_SUBMISSION_FILE_SIZE:
                    raise HTTPException(413, "PDF exceeds the maximum file size")
                output.write(chunk)
    except HTTPException:
        stored_path.unlink(missing_ok=True)
        raise
    except Exception:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(500, "Unable to store the uploaded PDF")
    finally:
        await file.close()

    submission = {
        "id": submission_id,
        "task_id": task_id,
        "program_id": task["program_id"],
        "stage_id": task["stage_id"],
        "user_id": user["user_id"],
        "student_name": user.get("name"),
        "student_email": user.get("email"),
        "task_title": task["title"],
        "original_filename": Path(file.filename).name,
        "stored_filename": stored_name,
        "content_type": "application/pdf",
        "size_bytes": total_size,
        "submitted_at": utcnow_iso(),
        "status": "submitted",
    }
    try:
        await db.task_submissions.insert_one(submission)
    except DuplicateKeyError as exc:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(409, "A submission already exists for this task") from exc
    submission.pop("_id", None)
    return submission


@api.get("/submissions/mine")
async def my_task_submissions(request: Request):
    user = await require_role(request, ["student"])
    return await db.task_submissions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("submitted_at", -1).to_list(1000)


@api.get("/tasks/{task_id}/submission")
async def task_submission(task_id: str, request: Request):
    user = await require_role(request, ["student"])
    submission = await _submission_for_user(task_id, user["user_id"])
    return submission or {"status": "not_submitted", "task_id": task_id}


@api.get("/submissions")
async def list_task_submissions(request: Request):
    await require_admin(request)
    return await db.task_submissions.find({}, {"_id": 0}).sort("submitted_at", -1).to_list(5000)


@api.put("/submissions/{submission_id}/evaluation")
async def evaluate_submission(submission_id: str, payload: Dict[str, Any], request: Request):
    admin = await require_admin(request)
    submission = await db.task_submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(404, "Submission not found")
    try:
        marks = float(payload.get("marks"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(400, "marks must be a number") from exc
    if not math.isfinite(marks) or not 0 <= marks <= 100:
        raise HTTPException(400, "marks must be between 0 and 100")
    feedback = str(payload.get("feedback") or "").strip()
    await db.task_submissions.update_one(
        {"id": submission_id},
        {"$set": {
            "marks": marks,
            "feedback": feedback,
            "status": "evaluated",
            "evaluated_at": utcnow_iso(),
            "evaluated_by": admin["user_id"],
        }},
    )
    return await db.task_submissions.find_one({"id": submission_id}, {"_id": 0})


@api.get("/submissions/{submission_id}/file")
async def download_submission(submission_id: str, request: Request):
    user = await get_current_user(request)
    submission = await db.task_submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(404, "Submission not found")
    if user.get("role") != "admin" and submission.get("user_id") != user.get("user_id"):
        raise HTTPException(403, "You cannot access this submission")
    stored_path = UPLOAD_DIR / Path(submission["stored_filename"]).name
    if not stored_path.is_file():
        raise HTTPException(404, "Uploaded PDF is missing")
    return FileResponse(stored_path, media_type="application/pdf", filename=Path(submission["original_filename"]).name)


# ---------------- Faculty (users with role=faculty) ----------------
@api.get("/faculty")
async def list_faculty(request: Request):
    await require_role(request, ["admin", "faculty"])
    docs = await db.users.find({"role": "faculty"}, {"_id": 0, "session_token": 0}).to_list(2000)
    return docs


@api.post("/faculty")
async def create_faculty(payload: Dict[str, Any], request: Request):
    await require_admin(request)
    email = (payload.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(400, "email required")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        await db.users.update_one({"email": email}, {"$set": {"role": "faculty", "name": payload.get("name") or existing.get("name"), "department_id": payload.get("department_id"), "active": True}})
        return await db.users.find_one({"email": email}, {"_id": 0})
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id, "email": email, "name": payload.get("name") or email.split("@")[0],
        "role": "faculty", "department_id": payload.get("department_id"),
        "active": True, "created_at": utcnow_iso(), "picture": None,
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/faculty/{uid_}")
async def update_faculty(uid_: str, payload: Dict[str, Any], request: Request):
    await require_admin(request)
    upd = {k: v for k, v in payload.items() if k in ("name", "department_id", "active")}
    await db.users.update_one({"user_id": uid_, "role": "faculty"}, {"$set": upd})
    return await db.users.find_one({"user_id": uid_}, {"_id": 0})


# ---------------- Faculty Assignments ----------------
class Assignment(BaseModel):
    id: Optional[str] = None
    faculty_id: str
    subject_id: str
    program_id: str
    year_level_id: str
    semester_id: str
    division_id: str
    academic_year_id: str
    active: bool = True


@api.get("/assignments")
async def list_assignments(request: Request):
    await require_role(request, ["admin", "faculty"])
    docs = await db.faculty_assignments.find({}, {"_id": 0}).to_list(5000)
    return docs


@api.post("/assignments")
async def create_assignment(payload: Assignment, request: Request):
    await require_admin(request)
    d = payload.model_dump()
    scope_q = {k: d[k] for k in ("faculty_id", "subject_id", "program_id", "year_level_id", "semester_id", "division_id", "academic_year_id")}
    if await db.faculty_assignments.find_one(scope_q):
        raise HTTPException(409, "Assignment already exists for this scope")
    d["id"] = uid()
    d["created_at"] = utcnow_iso()
    await db.faculty_assignments.insert_one(d)
    d.pop("_id", None)
    return d


@api.put("/assignments/{aid}")
async def update_assignment(aid: str, payload: Assignment, request: Request):
    await require_admin(request)
    d = payload.model_dump()
    d.pop("id", None)
    await db.faculty_assignments.update_one({"id": aid}, {"$set": d})
    return await db.faculty_assignments.find_one({"id": aid}, {"_id": 0})


@api.delete("/assignments/{aid}")
async def delete_assignment(aid: str, request: Request):
    await require_admin(request)
    await db.faculty_assignments.delete_one({"id": aid})
    return {"ok": True}


# ---------------- Students ----------------
@api.get("/students")
async def list_students(request: Request):
    await require_admin(request)
    docs = await db.users.find({"role": "student"}, {"_id": 0}).to_list(5000)
    # attach profile
    profiles = {p["user_id"]: p for p in await db.student_profiles.find({}, {"_id": 0}).to_list(5000)}
    for d in docs:
        d["profile"] = profiles.get(d["user_id"])
    return docs


@api.post("/students/profile")
async def upsert_student_profile(payload: Dict[str, Any], request: Request):
    await require_admin(request)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(400, "user_id required")
    doc = {
        "user_id": user_id,
        "student_id": payload.get("student_id"),
        "department_id": payload.get("department_id"),
        "program_id": payload.get("program_id"),
        "year_level_id": payload.get("year_level_id"),
        "semester_id": payload.get("semester_id"),
        "division_id": payload.get("division_id"),
        "academic_year_id": payload.get("academic_year_id"),
        "updated_at": utcnow_iso(),
    }
    await db.student_profiles.update_one({"user_id": user_id}, {"$set": doc}, upsert=True)
    return await db.student_profiles.find_one({"user_id": user_id}, {"_id": 0})


# ---------------- Feedback Templates & Versions ----------------
@api.get("/templates")
async def list_templates(request: Request):
    await require_admin(request)
    docs = await db.feedback_templates.find({}, {"_id": 0}).to_list(2000)
    return docs


@api.post("/templates")
async def create_template(payload: Dict[str, Any], request: Request):
    await require_admin(request)
    doc = {
        "id": uid(),
        "name": payload.get("name") or "Untitled Template",
        "description": payload.get("description") or "",
        "category": payload.get("category") or "student",  # student|certification|faculty|academic
        "iterates_faculty": bool(payload.get("iterates_faculty", payload.get("category") == "student")),
        "rating_scale": int(payload.get("rating_scale") or 5),
        "questions": payload.get("questions") or [],
        "published_version_id": None,
        "latest_version": 0,
        "active": True,
        "created_at": utcnow_iso(),
        "updated_at": utcnow_iso(),
    }
    await db.feedback_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/templates/{tid}")
async def update_template(tid: str, payload: Dict[str, Any], request: Request):
    await require_admin(request)
    upd = {k: v for k, v in payload.items() if k in ("name", "description", "category", "iterates_faculty", "rating_scale", "questions", "active")}
    upd["updated_at"] = utcnow_iso()
    await db.feedback_templates.update_one({"id": tid}, {"$set": upd})
    return await db.feedback_templates.find_one({"id": tid}, {"_id": 0})


@api.post("/templates/{tid}/publish")
async def publish_template(tid: str, request: Request):
    """Create immutable version snapshot of current questions."""
    await require_admin(request)
    t = await db.feedback_templates.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Template not found")
    version_num = (t.get("latest_version") or 0) + 1
    version_doc = {
        "id": uid(),
        "template_id": tid,
        "version": version_num,
        "name": t["name"],
        "description": t["description"],
        "category": t["category"],
        "iterates_faculty": t["iterates_faculty"],
        "rating_scale": t["rating_scale"],
        "questions": t.get("questions") or [],
        "published_at": utcnow_iso(),
    }
    await db.feedback_template_versions.insert_one(version_doc)
    await db.feedback_templates.update_one(
        {"id": tid},
        {"$set": {"published_version_id": version_doc["id"], "latest_version": version_num}},
    )
    version_doc.pop("_id", None)
    return version_doc


@api.delete("/templates/{tid}")
async def delete_template(tid: str, request: Request):
    await require_admin(request)
    used = await db.feedback_cycles.count_documents({"template_id": tid})
    if used:
        raise HTTPException(400, "Template is used by cycles. Deactivate instead.")
    await db.feedback_templates.delete_one({"id": tid})
    return {"ok": True}


# ---------------- Feedback Cycles ----------------
@api.get("/cycles")
async def list_cycles(request: Request):
    user = await get_current_user(request)
    if user["role"] == "admin":
        docs = await db.feedback_cycles.find({}, {"_id": 0}).to_list(2000)
    else:
        docs = await db.feedback_cycles.find({"status": {"$in": ["active", "closed"]}}, {"_id": 0}).to_list(2000)
    return docs


@api.post("/cycles")
async def create_cycle(payload: Dict[str, Any], request: Request):
    await require_admin(request)
    t = await db.feedback_templates.find_one({"id": payload.get("template_id")}, {"_id": 0})
    if not t:
        raise HTTPException(400, "Template not found")
    if not t.get("published_version_id"):
        raise HTTPException(400, "Publish the template before creating a cycle")
    doc = {
        "id": uid(),
        "name": payload.get("name") or "Untitled Cycle",
        "template_id": t["id"],
        "template_version_id": t["published_version_id"],
        "academic_year_id": payload.get("academic_year_id"),
        "department_id": payload.get("department_id"),
        "program_id": payload.get("program_id"),
        "year_level_id": payload.get("year_level_id"),
        "semester_id": payload.get("semester_id"),
        "division_ids": payload.get("division_ids") or [],  # list of divisions
        "starts_at": payload.get("starts_at"),
        "ends_at": payload.get("ends_at"),
        "status": payload.get("status") or "draft",  # draft|scheduled|active|closed|archived
        "created_at": utcnow_iso(),
    }
    await db.feedback_cycles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/cycles/{cid}")
async def update_cycle(cid: str, payload: Dict[str, Any], request: Request):
    await require_admin(request)
    upd = {k: v for k, v in payload.items() if k in ("name", "academic_year_id", "department_id", "program_id", "year_level_id", "semester_id", "division_ids", "starts_at", "ends_at", "status")}
    await db.feedback_cycles.update_one({"id": cid}, {"$set": upd})
    return await db.feedback_cycles.find_one({"id": cid}, {"_id": 0})


@api.delete("/cycles/{cid}")
async def delete_cycle(cid: str, request: Request):
    await require_admin(request)
    if await db.feedback_submissions.count_documents({"cycle_id": cid}):
        raise HTTPException(400, "Cycle has submissions; archive instead")
    await db.feedback_cycles.delete_one({"id": cid})
    await db.feedback_drafts.delete_many({"cycle_id": cid})
    return {"ok": True}


# ---------------- Student Feedback Flow ----------------
async def _resolve_student_cycles(user_id: str) -> List[Dict[str, Any]]:
    prof = await db.student_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not prof:
        return []
    now = utcnow_iso()
    q: Dict[str, Any] = {
        "status": "active",
        "starts_at": {"$lte": now},
        "ends_at": {"$gte": now},
    }
    # match scope: only compare if cycle sets that scope; empty means "any"
    all_cycles = await db.feedback_cycles.find(q, {"_id": 0}).to_list(1000)
    out = []
    for c in all_cycles:
        ok = True
        for key in ("department_id", "program_id", "year_level_id", "semester_id", "academic_year_id"):
            if c.get(key) and c.get(key) != prof.get(key):
                ok = False
                break
        divs = c.get("division_ids") or []
        if divs and prof.get("division_id") not in divs:
            ok = False
        if ok:
            out.append(c)
    return out


@api.get("/my/cycles")
async def my_cycles(request: Request):
    user = await get_current_user(request)
    if user["role"] != "student":
        return []
    cycles = await _resolve_student_cycles(user["user_id"])
    # Attach submission/draft status
    for c in cycles:
        c["submitted"] = bool(await db.feedback_submissions.find_one({"user_id": user["user_id"], "cycle_id": c["id"]}))
        c["has_draft"] = bool(await db.feedback_drafts.find_one({"user_id": user["user_id"], "cycle_id": c["id"]}))
    return cycles


@api.get("/my/cycles/{cid}/context")
async def cycle_context(cid: str, request: Request):
    """Full data needed to render the student's wizard: cycle, template version, faculty assignments, draft."""
    user = await get_current_user(request)
    if user["role"] != "student":
        raise HTTPException(403, "Students only")
    prof = await db.student_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not prof:
        raise HTTPException(400, "No academic profile assigned")
    cycle = await db.feedback_cycles.find_one({"id": cid}, {"_id": 0})
    if not cycle:
        raise HTTPException(404, "Cycle not found")
    # Verify eligibility (compare by id)
    eligible_ids = {c["id"] for c in await _resolve_student_cycles(user["user_id"])}
    if cycle["id"] not in eligible_ids:
        raise HTTPException(403, "Not eligible for this cycle")

    submission = await db.feedback_submissions.find_one({"user_id": user["user_id"], "cycle_id": cid}, {"_id": 0})
    tv = await db.feedback_template_versions.find_one({"id": cycle["template_version_id"]}, {"_id": 0})
    if not tv:
        raise HTTPException(500, "Template version missing")

    faculty_items: List[Dict[str, Any]] = []
    if tv.get("iterates_faculty"):
        # Load assignments matching scope
        aq: Dict[str, Any] = {"active": True}
        for key in ("program_id", "year_level_id", "semester_id", "academic_year_id"):
            if cycle.get(key):
                aq[key] = cycle[key]
            elif prof.get(key):
                aq[key] = prof.get(key)
        aq["division_id"] = prof["division_id"]
        assignments = await db.faculty_assignments.find(aq, {"_id": 0}).to_list(500)
        # decorate
        subjects = {s["id"]: s for s in await db.subjects.find({}, {"_id": 0}).to_list(2000)}
        faculty_map = {u["user_id"]: u for u in await db.users.find({"role": "faculty"}, {"_id": 0}).to_list(2000)}
        for a in assignments:
            f = faculty_map.get(a["faculty_id"])
            if not f:
                continue
            faculty_items.append({
                "assignment_id": a["id"],
                "faculty_id": a["faculty_id"],
                "faculty_name": f.get("name"),
                "subject_id": a["subject_id"],
                "subject_name": (subjects.get(a["subject_id"]) or {}).get("name"),
            })

    draft = await db.feedback_drafts.find_one({"user_id": user["user_id"], "cycle_id": cid}, {"_id": 0})
    return {
        "cycle": cycle,
        "template_version": tv,
        "faculty_items": faculty_items,
        "profile": prof,
        "draft": draft,
        "submitted": bool(submission),
    }


@api.post("/my/cycles/{cid}/draft")
async def save_draft(cid: str, payload: Dict[str, Any], request: Request):
    user = await get_current_user(request)
    if user["role"] != "student":
        raise HTTPException(403, "Students only")
    if await db.feedback_submissions.find_one({"user_id": user["user_id"], "cycle_id": cid}):
        raise HTTPException(400, "Already submitted")
    doc = {
        "user_id": user["user_id"],
        "cycle_id": cid,
        "answers": payload.get("answers") or {},
        "step": int(payload.get("step") or 0),
        "updated_at": utcnow_iso(),
    }
    await db.feedback_drafts.update_one(
        {"user_id": user["user_id"], "cycle_id": cid},
        {"$set": doc}, upsert=True,
    )
    return {"ok": True}


@api.post("/my/cycles/{cid}/submit")
async def submit_cycle(cid: str, payload: Dict[str, Any], request: Request):
    user = await get_current_user(request)
    if user["role"] != "student":
        raise HTTPException(403, "Students only")
    if await db.feedback_submissions.find_one({"user_id": user["user_id"], "cycle_id": cid}):
        raise HTTPException(400, "Already submitted")
    cycle = await db.feedback_cycles.find_one({"id": cid}, {"_id": 0})
    if not cycle:
        raise HTTPException(404, "Cycle not found")
    tv = await db.feedback_template_versions.find_one({"id": cycle["template_version_id"]}, {"_id": 0})
    if not tv:
        raise HTTPException(500, "Template version missing")
    answers = payload.get("answers") or {}
    faculty_items = payload.get("faculty_items") or []
    q_by_id = {q["id"]: q for q in tv.get("questions") or []}
    # Validate required answers server-side
    def group_valid(group_key):
        grp = answers.get(group_key) or {}
        for q in tv.get("questions") or []:
            if q.get("required"):
                v = grp.get(q["id"])
                if v is None or v == "":
                    return False, q["label"]
        return True, None
    if tv.get("iterates_faculty"):
        if not faculty_items:
            raise HTTPException(400, "Missing faculty items")
        for f in faculty_items:
            ok, missing = group_valid(f.get("assignment_id"))
            if not ok:
                raise HTTPException(400, f"Missing required answer '{missing}' for {f.get('faculty_name')}")
    else:
        ok, missing = group_valid("general")
        if not ok:
            raise HTTPException(400, f"Missing required answer '{missing}'")
    # Build immutable submission
    submission = {
        "id": uid(),
        "user_id": user["user_id"],
        "user_email": user["email"],
        "cycle_id": cid,
        "template_version_id": tv["id"],
        "template_snapshot": tv,
        "faculty_snapshot": faculty_items,
        "answers": answers,
        "submitted_at": utcnow_iso(),
    }
    # Compute avg for analytics
    ratings = []
    for k, v in _flatten_ratings(answers, q_by_id).items():
        ratings.append(v)
    submission["avg"] = round(sum(ratings) / len(ratings), 2) if ratings else 0
    await db.feedback_submissions.insert_one(submission)
    await db.feedback_drafts.delete_one({"user_id": user["user_id"], "cycle_id": cid})
    return {"ok": True, "id": submission["id"], "avg": submission["avg"]}


def _flatten_ratings(answers: Dict[str, Any], q_by_id: Dict[str, Any]) -> Dict[str, float]:
    """Extract numeric rating values (int type questions) from nested answers."""
    result: Dict[str, float] = {}

    def visit(prefix: str, obj: Any):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in q_by_id and q_by_id[k].get("type") == "rating":
                    try:
                        n = int(v)
                        if 1 <= n <= 5:
                            result[f"{prefix}{k}"] = n
                    except Exception:
                        pass
                elif isinstance(v, (dict, list)):
                    visit(f"{prefix}{k}.", v)
        elif isinstance(obj, list):
            for i, x in enumerate(obj):
                visit(f"{prefix}{i}.", x)

    visit("", answers)
    return result


# ---------------- Admin Responses & Analytics ----------------
@api.get("/responses")
async def responses(
    request: Request,
    cycle_id: Optional[str] = None,
    department_id: Optional[str] = None,
    program_id: Optional[str] = None,
    year_level_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    division_id: Optional[str] = None,
    faculty_id: Optional[str] = None,
    subject_id: Optional[str] = None,
):
    await require_admin(request)
    q: Dict[str, Any] = {}
    if cycle_id:
        q["cycle_id"] = cycle_id
    docs = await db.feedback_submissions.find(q, {"_id": 0}).sort("submitted_at", -1).to_list(5000)
    # Optional filters against cycle/profile
    if any([department_id, program_id, year_level_id, semester_id, division_id]):
        cycles = {c["id"]: c for c in await db.feedback_cycles.find({}, {"_id": 0}).to_list(2000)}
        profiles = {p["user_id"]: p for p in await db.student_profiles.find({}, {"_id": 0}).to_list(5000)}
        def match(d):
            c = cycles.get(d["cycle_id"], {})
            p = profiles.get(d["user_id"], {})
            for key, val in (("department_id", department_id), ("program_id", program_id), ("year_level_id", year_level_id), ("semester_id", semester_id), ("division_id", division_id)):
                if val and (c.get(key) or p.get(key)) != val:
                    return False
            return True
        docs = [d for d in docs if match(d)]
    if faculty_id or subject_id:
        def touches(d):
            for f in d.get("faculty_snapshot") or []:
                if faculty_id and f.get("faculty_id") == faculty_id:
                    return True
                if subject_id and f.get("subject_id") == subject_id:
                    return True
            return False
        docs = [d for d in docs if touches(d)]
    return docs


@api.get("/analytics/summary")
async def analytics_summary(request: Request):
    await require_admin(request)
    subs = await db.feedback_submissions.find({}, {"_id": 0}).to_list(10000)
    users = await db.users.count_documents({})
    students = await db.users.count_documents({"role": "student"})
    faculty = await db.users.count_documents({"role": "faculty"})
    cycles_active = await db.feedback_cycles.count_documents({"status": "active"})
    total_resp = len(subs)
    avg_all = round(sum(s.get("avg") or 0 for s in subs) / total_resp, 2) if total_resp else 0

    # Faculty averages via faculty_snapshot answers — RESTRICT to rating-type questions
    fac_map: Dict[str, List[float]] = {}
    fac_names: Dict[str, str] = {}
    dept_map: Dict[str, List[float]] = {}
    cycles = {c["id"]: c for c in await db.feedback_cycles.find({}, {"_id": 0}).to_list(2000)}
    for s in subs:
        tsnap = s.get("template_snapshot") or {}
        rating_qids = {q["id"] for q in (tsnap.get("questions") or []) if q.get("type") == "rating"}
        for f in s.get("faculty_snapshot") or []:
            fid = f["faculty_id"]
            aid = f.get("assignment_id")
            ans = (s.get("answers") or {}).get(aid) if aid else None
            if isinstance(ans, dict):
                nums = []
                for qid, v in ans.items():
                    if qid in rating_qids and isinstance(v, (int, str)) and str(v).isdigit() and 1 <= int(v) <= 5:
                        nums.append(int(v))
                if nums:
                    avg = sum(nums) / len(nums)
                    fac_map.setdefault(fid, []).append(avg)
                    fac_names[fid] = f.get("faculty_name") or fid
        c = cycles.get(s.get("cycle_id"), {})
        if c.get("department_id"):
            dept_map.setdefault(c["department_id"], []).append(s.get("avg") or 0)

    faculty_ratings = sorted(
        [{"faculty_id": fid, "faculty": fac_names.get(fid, fid), "avg": round(sum(v) / len(v), 2), "count": len(v)} for fid, v in fac_map.items()],
        key=lambda x: -x["avg"],
    )
    depts = {d["id"]: d for d in await db.departments.find({}, {"_id": 0}).to_list(500)}
    dept_ratings = [{"department": depts.get(k, {}).get("name", k), "avg": round(sum(v) / len(v), 2), "count": len(v)} for k, v in dept_map.items()]

    trend_map: Dict[str, List[float]] = {}
    for s in subs:
        m = (s.get("submitted_at") or "")[:7]
        if m:
            trend_map.setdefault(m, []).append(s.get("avg") or 0)
    trend = sorted(
        [{"month": m, "avg": round(sum(v) / len(v), 2), "count": len(v)} for m, v in trend_map.items()],
        key=lambda x: x["month"],
    )

    # Completion: submissions vs eligible students per active cycle
    completion = 0
    pending = 0
    if cycles_active:
        active_cycles = [c for c in cycles.values() if c.get("status") == "active"]
        elig_total = 0
        sub_total = 0
        for c in active_cycles:
            elig = await db.student_profiles.count_documents(_scope_query(c))
            elig_total += elig
            sub_total += await db.feedback_submissions.count_documents({"cycle_id": c["id"]})
        completion = round((sub_total / elig_total) * 100, 1) if elig_total else 0
        pending = max(0, elig_total - sub_total)

    return {
        "totals": {
            "students": students, "faculty": faculty, "users": users,
            "responses": total_resp, "avg_rating": avg_all,
            "cycles_active": cycles_active, "completion": completion, "pending": pending,
        },
        "faculty_ratings": faculty_ratings,
        "dept_ratings": dept_ratings,
        "trend": trend,
    }


def _scope_query(cycle: Dict[str, Any]) -> Dict[str, Any]:
    q: Dict[str, Any] = {}
    for key in ("department_id", "program_id", "year_level_id", "semester_id", "academic_year_id"):
        if cycle.get(key):
            q[key] = cycle[key]
    if cycle.get("division_ids"):
        q["division_id"] = {"$in": cycle["division_ids"]}
    return q


@api.get("/export")
async def export_data(request: Request, fmt: str = Query("csv"), cycle_id: Optional[str] = None, include_pii: bool = False):
    await require_admin(request)
    q: Dict[str, Any] = {"cycle_id": cycle_id} if cycle_id else {}
    docs = await db.feedback_submissions.find(q, {"_id": 0}).sort("submitted_at", -1).to_list(10000)
    rows = []
    for d in docs:
        base_avg = d.get("avg")
        for f in d.get("faculty_snapshot") or [{}]:
            aid = f.get("assignment_id")
            ans = (d.get("answers") or {}).get(aid) or {}
            row = {
                "submitted_at": d.get("submitted_at"),
                "cycle_id": d.get("cycle_id"),
                "faculty": f.get("faculty_name") or "",
                "subject": f.get("subject_name") or "",
                "avg": base_avg,
                "answers": "; ".join(f"{k}:{v}" for k, v in ans.items()) if isinstance(ans, dict) else str(ans),
            }
            if include_pii:
                row["respondent_email"] = d.get("user_email") or ""
            rows.append(row)
    if not rows:
        rows = [{"info": "no data"}]

    if fmt == "xlsx":
        wb = Workbook(); ws = wb.active; ws.title = "Responses"
        ws.append(list(rows[0].keys()))
        for r in rows:
            ws.append(list(r.values()))
        buf = io.BytesIO(); wb.save(buf); buf.seek(0)
        return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 headers={"Content-Disposition": "attachment; filename=klecba_responses.xlsx"})
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    w.writeheader()
    for r in rows: w.writerow(r)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                              headers={"Content-Disposition": "attachment; filename=klecba_responses.csv"})


@api.get("/feedback/mine")
async def my_feedback(request: Request):
    """Legacy compatibility: returns current student's submissions (new + legacy)."""
    user = await get_current_user(request)
    if user["role"] != "student":
        return []
    subs = await db.feedback_submissions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    return subs


# ---------------- Faculty Portal (anonymous own insights) ----------------
@api.get("/faculty/me/insights")
async def faculty_me_insights(request: Request, year_level_id: Optional[str] = None, division_id: Optional[str] = None):
    user = await get_current_user(request)
    if user["role"] != "faculty":
        raise HTTPException(403, "Faculty only")
    fid = user["user_id"]
    # Determine which assignment_ids to scope to when filters are applied
    scoped_aids: Optional[set] = None
    if year_level_id or division_id:
        aq: Dict[str, Any] = {"faculty_id": fid}
        if year_level_id: aq["year_level_id"] = year_level_id
        if division_id: aq["division_id"] = division_id
        assignments = await db.faculty_assignments.find(aq, {"_id": 0, "id": 1}).to_list(2000)
        scoped_aids = {a["id"] for a in assignments}

    subs = await db.feedback_submissions.find({"faculty_snapshot.faculty_id": fid}, {"_id": 0}).to_list(5000)
    ratings = []
    trend_map: Dict[str, List[float]] = {}
    question_map: Dict[str, Dict[str, Any]] = {}  # q_id -> {label, values[]}
    subject_map: Dict[str, List[float]] = {}
    comments: List[Dict[str, Any]] = []

    for s in subs:
        tsnap = s.get("template_snapshot") or {}
        q_by_id = {q["id"]: q for q in (tsnap.get("questions") or [])}
        rating_qids = {qid for qid, q in q_by_id.items() if q.get("type") == "rating"}
        text_qids = {qid for qid, q in q_by_id.items() if q.get("type") == "text"}
        month = (s.get("submitted_at") or "")[:7]
        for f in s.get("faculty_snapshot") or []:
            if f.get("faculty_id") != fid:
                continue
            aid = f.get("assignment_id")
            if scoped_aids is not None and aid not in scoped_aids:
                continue
            ans = (s.get("answers") or {}).get(aid) or {}
            if not isinstance(ans, dict):
                continue
            nums = []
            for qid, v in ans.items():
                if qid in rating_qids and isinstance(v, (int, str)) and str(v).isdigit() and 1 <= int(v) <= 5:
                    n = int(v)
                    nums.append(n)
                    label = q_by_id.get(qid, {}).get("label") or qid
                    qm = question_map.setdefault(qid, {"label": label, "values": []})
                    qm["values"].append(n)
                elif qid in text_qids and isinstance(v, str) and v.strip():
                    # anonymised comment
                    comments.append({
                        "subject": f.get("subject_name"),
                        "text": v.strip(),
                        "submitted_at": s.get("submitted_at"),
                    })
            if nums:
                avg = sum(nums) / len(nums)
                ratings.append(avg)
                trend_map.setdefault(month, []).append(avg)
                sname = f.get("subject_name") or "—"
                subject_map.setdefault(sname, []).append(avg)

    overall_avg = round(sum(ratings) / len(ratings), 2) if ratings else 0
    trend = sorted(
        [{"month": m, "avg": round(sum(v) / len(v), 2), "count": len(v)} for m, v in trend_map.items()],
        key=lambda x: x["month"],
    )
    question_ratings = [
        {
            "question_id": qid,
            "label": q["label"],
            "avg": round(sum(q["values"]) / len(q["values"]), 2) if q["values"] else 0,
            "count": len(q["values"]),
            "distribution": {str(i): sum(1 for v in q["values"] if v == i) for i in range(1, 6)},
        }
        for qid, q in question_map.items()
    ]
    question_ratings.sort(key=lambda x: -x["avg"])
    subject_ratings = [
        {"subject": s, "avg": round(sum(v) / len(v), 2), "count": len(v)} for s, v in subject_map.items()
    ]
    # Show latest 20 anonymised comments
    # Improvement area: lowest-rated question (with enough responses)
    improvement = None
    ranked = [q for q in question_ratings if q["count"] >= 1]
    if ranked:
        low = min(ranked, key=lambda q: (q["avg"], -q["count"]))
        improvement = {"label": low["label"], "avg": low["avg"], "count": low["count"]}
    comments = sorted(comments, key=lambda c: c["submitted_at"] or "", reverse=True)[:20]
    return {
        "overall_avg": overall_avg,
        "response_count": len(ratings),
        "trend": trend,
        "question_ratings": question_ratings,
        "subject_ratings": subject_ratings,
        "comments": comments,
        "improvement": improvement,
    }


@api.get("/faculty/me/scope")
async def faculty_me_scope(request: Request):
    """Return the year/division options that this faculty is assigned to."""
    user = await get_current_user(request)
    if user["role"] != "faculty":
        raise HTTPException(403, "Faculty only")
    assignments = await db.faculty_assignments.find({"faculty_id": user["user_id"]}, {"_id": 0}).to_list(2000)
    year_ids = {a["year_level_id"] for a in assignments if a.get("year_level_id")}
    div_ids = {a["division_id"] for a in assignments if a.get("division_id")}
    years = await db.year_levels.find({"id": {"$in": list(year_ids)}}, {"_id": 0}).sort("order", 1).to_list(50)
    divs = await db.divisions.find({"id": {"$in": list(div_ids)}}, {"_id": 0}).to_list(50)
    return {"years": years, "divisions": divs}


@api.get("/faculty/me/export")
async def faculty_me_export(request: Request, fmt: str = Query("csv"), year_level_id: Optional[str] = None, division_id: Optional[str] = None):
    """Anonymous CSV/XLSX export of the faculty's own scoped ratings. No student PII."""
    user = await get_current_user(request)
    if user["role"] != "faculty":
        raise HTTPException(403, "Faculty only")
    fid = user["user_id"]
    scoped_aids: Optional[set] = None
    if year_level_id or division_id:
        aq: Dict[str, Any] = {"faculty_id": fid}
        if year_level_id: aq["year_level_id"] = year_level_id
        if division_id: aq["division_id"] = division_id
        assignments = await db.faculty_assignments.find(aq, {"_id": 0}).to_list(2000)
        scoped_aids = {a["id"] for a in assignments}

    subs = await db.feedback_submissions.find({"faculty_snapshot.faculty_id": fid}, {"_id": 0}).to_list(5000)
    rows = []
    for s in subs:
        tsnap = s.get("template_snapshot") or {}
        q_by_id = {q["id"]: q for q in (tsnap.get("questions") or [])}
        for f in s.get("faculty_snapshot") or []:
            if f.get("faculty_id") != fid: continue
            aid = f.get("assignment_id")
            if scoped_aids is not None and aid not in scoped_aids: continue
            ans = (s.get("answers") or {}).get(aid) or {}
            if not isinstance(ans, dict): continue
            for qid, v in ans.items():
                q = q_by_id.get(qid) or {}
                rows.append({
                    "submitted_at": s.get("submitted_at"),
                    "subject": f.get("subject_name") or "",
                    "question": q.get("label") or qid,
                    "type": q.get("type") or "",
                    "answer": v,
                })
    if not rows:
        rows = [{"info": "no data"}]
    if fmt == "xlsx":
        wb = Workbook(); ws = wb.active; ws.title = "My Feedback"
        ws.append(list(rows[0].keys()))
        for r in rows: ws.append(list(r.values()))
        buf = io.BytesIO(); wb.save(buf); buf.seek(0)
        return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 headers={"Content-Disposition": "attachment; filename=my_feedback.xlsx"})
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    w.writeheader()
    for r in rows: w.writerow(r)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                              headers={"Content-Disposition": "attachment; filename=my_feedback.csv"})


# ---------------- Student Categories (4 fixed cards) ----------------
CATEGORY_META = {
    "student":       {"title": "Student Feedback",       "desc": "Rate your teachers across your enrolled subjects."},
    "certification": {"title": "Certification Course",   "desc": "Share your experience for certification programmes."},
    "faculty":       {"title": "Faculty Feedback",       "desc": "Peer/departmental feedback across faculty."},
    "academic":      {"title": "Academic Feedback",      "desc": "Rate infrastructure, administration and overall experience."},
}


@api.get("/my/categories")
async def my_categories(request: Request):
    user = await get_current_user(request)
    if user["role"] != "student":
        return []
    prof = await db.student_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    all_cycles = await db.feedback_cycles.find({}, {"_id": 0}).to_list(2000)
    tmpls = {t["id"]: t for t in await db.feedback_templates.find({}, {"_id": 0}).to_list(2000)}
    now_iso = utcnow_iso()

    def match(cycle: Dict[str, Any]) -> bool:
        if not prof:
            return False
        for key in ("department_id", "program_id", "year_level_id", "semester_id", "academic_year_id"):
            if cycle.get(key) and cycle.get(key) != prof.get(key):
                return False
        divs = cycle.get("division_ids") or []
        if divs and prof.get("division_id") not in divs:
            return False
        return True

    out = []
    for cat, meta in CATEGORY_META.items():
        # find best matching cycle in this category for this student
        matching = []
        for c in all_cycles:
            t = tmpls.get(c.get("template_id")) or {}
            if t.get("category") != cat:
                continue
            if not match(c):
                continue
            matching.append(c)
        card = {"category": cat, "title": meta["title"], "desc": meta["desc"], "status": "upcoming", "cycle": None, "submitted": False, "has_draft": False}
        if not matching:
            out.append(card); continue
        # Prefer active, then scheduled, then closed
        def rank(c):
            s = c.get("status")
            active = s == "active" and c.get("starts_at", "") <= now_iso <= c.get("ends_at", "")
            return (0 if active else 1 if s == "scheduled" else 2 if s == "closed" else 3, c.get("ends_at") or "")
        matching.sort(key=rank)
        best = matching[0]
        card["cycle"] = best
        submitted = bool(await db.feedback_submissions.find_one({"user_id": user["user_id"], "cycle_id": best["id"]}))
        card["submitted"] = submitted
        card["has_draft"] = bool(await db.feedback_drafts.find_one({"user_id": user["user_id"], "cycle_id": best["id"]}))
        s = best.get("status")
        if submitted:
            card["status"] = "completed"
        elif s == "active" and best.get("starts_at", "") <= now_iso <= best.get("ends_at", ""):
            card["status"] = "ongoing"
        elif s == "closed" or (best.get("ends_at") and now_iso > best["ends_at"]):
            card["status"] = "completed"
        else:
            card["status"] = "upcoming"
        out.append(card)
    return out



# ---------------- Bulk Student Import ----------------
@api.post("/students/import")
async def import_students(payload: Dict[str, Any], request: Request):
    """Accepts CSV text under 'csv' key. Columns (headers): student_id, name, email, program, year, semester, division, academic_year."""
    await require_admin(request)
    csv_text = payload.get("csv") or ""
    dry_run = bool(payload.get("dry_run", False))
    if not csv_text.strip():
        raise HTTPException(400, "CSV content required")
    reader = csv.DictReader(io.StringIO(csv_text))

    programs = {p["name"].lower(): p for p in await db.programs.find({}, {"_id": 0}).to_list(500)}
    years = {y["name"].lower(): y for y in await db.year_levels.find({}, {"_id": 0}).to_list(50)}
    sems = {s["name"].lower(): s for s in await db.semesters.find({}, {"_id": 0}).to_list(50)}
    divs = {d["name"].lower(): d for d in await db.divisions.find({}, {"_id": 0}).to_list(50)}
    ays = {a["name"].lower(): a for a in await db.academic_years.find({}, {"_id": 0}).to_list(50)}
    departments_by_program = {p["id"]: p.get("department_id") for p in programs.values()}

    valid: List[Dict[str, Any]] = []
    invalid: List[Dict[str, Any]] = []
    row_no = 1

    for row in reader:
        row_no += 1
        errors = []
        email = (row.get("email") or "").strip().lower()
        name = (row.get("name") or "").strip()
        student_id = (row.get("student_id") or "").strip()
        if not email or "@" not in email:
            errors.append("Missing/invalid email")
        elif not domain_allowed(email):
            errors.append(f"Email domain not allowed")
        if not name:
            errors.append("Missing name")

        program = (row.get("program") or "").strip().lower()
        year = (row.get("year") or "").strip().lower()
        sem = (row.get("semester") or "").strip().lower()
        div = (row.get("division") or "").strip().lower()
        ay = (row.get("academic_year") or "").strip().lower()

        prog_obj = programs.get(program) if program else None
        year_obj = years.get(year) if year else None
        sem_obj = sems.get(sem) if sem else None
        div_obj = divs.get(div) if div else None
        ay_obj = ays.get(ay) if ay else None
        if program and not prog_obj: errors.append(f"Unknown program: {row.get('program')}")
        if year and not year_obj: errors.append(f"Unknown year: {row.get('year')}")
        if sem and not sem_obj: errors.append(f"Unknown semester: {row.get('semester')}")
        if div and not div_obj: errors.append(f"Unknown division: {row.get('division')}")
        if ay and not ay_obj: errors.append(f"Unknown academic year: {row.get('academic_year')}")

        record = {
            "row": row_no, "email": email, "name": name, "student_id": student_id,
            "program_id": prog_obj["id"] if prog_obj else None,
            "department_id": departments_by_program.get(prog_obj["id"]) if prog_obj else None,
            "year_level_id": year_obj["id"] if year_obj else None,
            "semester_id": sem_obj["id"] if sem_obj else None,
            "division_id": div_obj["id"] if div_obj else None,
            "academic_year_id": ay_obj["id"] if ay_obj else None,
        }
        if errors:
            invalid.append({**record, "errors": errors})
        else:
            valid.append(record)

    imported = 0
    updated = 0
    if not dry_run:
        for r in valid:
            existing = await db.users.find_one({"email": r["email"]}, {"_id": 0})
            if existing:
                user_id = existing["user_id"]
                # do not demote admin/faculty via import
                if existing.get("role") not in ("admin", "faculty"):
                    await db.users.update_one({"user_id": user_id}, {"$set": {"role": "student", "name": r["name"]}})
                updated += 1
            else:
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                await db.users.insert_one({
                    "user_id": user_id, "email": r["email"], "name": r["name"],
                    "role": "student", "picture": None, "created_at": utcnow_iso(),
                })
                imported += 1
            profile = {
                "user_id": user_id,
                "student_id": r["student_id"] or None,
                "department_id": r["department_id"],
                "program_id": r["program_id"],
                "year_level_id": r["year_level_id"],
                "semester_id": r["semester_id"],
                "division_id": r["division_id"],
                "academic_year_id": r["academic_year_id"],
                "updated_at": utcnow_iso(),
            }
            await db.student_profiles.update_one({"user_id": user_id}, {"$set": profile}, upsert=True)

    return {
        "dry_run": dry_run,
        "valid_count": len(valid),
        "invalid_count": len(invalid),
        "imported": imported,
        "updated": updated,
        "invalid_rows": invalid[:200],
        "sample_valid": valid[:20],
    }


# ---------------- Cycle Reminders ----------------
@api.get("/reminders/preview")
async def reminders_preview(request: Request, days_before: int = 2):
    """List students who have a saved draft and no submission, for cycles ending within `days_before` days."""
    await require_admin(request)
    now = datetime.now(timezone.utc)
    cutoff = (now + timedelta(days=days_before)).isoformat()
    cycles = await db.feedback_cycles.find({"status": "active", "ends_at": {"$lte": cutoff, "$gte": now.isoformat()}}, {"_id": 0}).to_list(500)
    result = []
    for c in cycles:
        drafts = await db.feedback_drafts.find({"cycle_id": c["id"]}, {"_id": 0}).to_list(2000)
        for d in drafts:
            if await db.feedback_submissions.find_one({"user_id": d["user_id"], "cycle_id": c["id"]}):
                continue
            user = await db.users.find_one({"user_id": d["user_id"]}, {"_id": 0})
            if not user:
                continue
            last_sent = await db.reminders_sent.find_one({"user_id": d["user_id"], "cycle_id": c["id"]}, {"_id": 0})
            result.append({
                "user_id": d["user_id"], "email": user["email"], "name": user["name"],
                "cycle_id": c["id"], "cycle_name": c["name"], "ends_at": c["ends_at"],
                "already_reminded": bool(last_sent),
                "reminded_at": last_sent.get("sent_at") if last_sent else None,
            })
    return {
        "days_before": days_before,
        "count": len(result),
        "recipients": result,
        "email_configured": bool(os.environ.get("RESEND_API_KEY") and os.environ.get("REMINDER_FROM_EMAIL")),
    }


@api.post("/reminders/run")
async def reminders_run(request: Request, days_before: int = 2, dry_run: bool = True):
    """Send (or dry-run) reminder emails. Idempotent — will not resend to same user+cycle.
    Requires RESEND_API_KEY and REMINDER_FROM_EMAIL to actually send."""
    await require_admin(request)
    preview = await reminders_preview(request, days_before=days_before)
    to_send = [r for r in preview["recipients"] if not r["already_reminded"]]
    resend_key = os.environ.get("RESEND_API_KEY")
    from_email = os.environ.get("REMINDER_FROM_EMAIL")
    sent = 0
    skipped = 0
    errors: List[str] = []
    for r in to_send:
        if dry_run or not resend_key or not from_email:
            skipped += 1
            continue
        try:
            async with httpx.AsyncClient(timeout=15.0) as hx:
                resp = await hx.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                    json={
                        "from": from_email, "to": [r["email"]],
                        "subject": f"KLECBA · Reminder: your feedback for {r['cycle_name']}",
                        "html": f"<p>Hi {r['name']},</p><p>Your feedback draft for <strong>{r['cycle_name']}</strong> is still open. It closes on {r['ends_at'][:10]}. Please take a minute to submit it.</p><p>— KLECBA</p>",
                    },
                )
                if resp.status_code >= 300:
                    errors.append(f"{r['email']}: HTTP {resp.status_code}")
                    continue
            await db.reminders_sent.update_one(
                {"user_id": r["user_id"], "cycle_id": r["cycle_id"]},
                {"$set": {"user_id": r["user_id"], "cycle_id": r["cycle_id"], "sent_at": utcnow_iso()}}, upsert=True,
            )
            sent += 1
        except Exception as e:
            errors.append(f"{r['email']}: {e}")
    return {
        "dry_run": dry_run,
        "email_configured": bool(resend_key and from_email),
        "candidates": len(to_send),
        "sent": sent, "skipped": skipped, "errors": errors,
        "required_env": ["RESEND_API_KEY", "REMINDER_FROM_EMAIL"],
    }


# ---------------- Question Insights ----------------
@api.get("/analytics/question-insights")
async def question_insights(
    request: Request,
    cycle_id: Optional[str] = None,
    academic_year_id: Optional[str] = None,
    department_id: Optional[str] = None,
    program_id: Optional[str] = None,
    year_level_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    division_id: Optional[str] = None,
    faculty_id: Optional[str] = None,
    subject_id: Optional[str] = None,
):
    await require_admin(request)
    cycles = {c["id"]: c for c in await db.feedback_cycles.find({}, {"_id": 0}).to_list(2000)}
    profiles = {p["user_id"]: p for p in await db.student_profiles.find({}, {"_id": 0}).to_list(5000)}

    q: Dict[str, Any] = {}
    if cycle_id:
        q["cycle_id"] = cycle_id
    subs = await db.feedback_submissions.find(q, {"_id": 0}).to_list(10000)

    # filter by cycle/profile scope
    def scope_ok(s):
        c = cycles.get(s.get("cycle_id"), {})
        p = profiles.get(s.get("user_id"), {})
        for key, val in [("academic_year_id", academic_year_id), ("department_id", department_id),
                          ("program_id", program_id), ("year_level_id", year_level_id),
                          ("semester_id", semester_id), ("division_id", division_id)]:
            if val and (c.get(key) or p.get(key)) != val:
                return False
        return True

    subs = [s for s in subs if scope_ok(s)]

    # per faculty x question
    from collections import defaultdict
    faculty_names: Dict[str, str] = {}
    subject_names: Dict[str, str] = {}
    combos: Dict[str, Dict[str, Any]] = {}  # key: fid|subject|qid
    for s in subs:
        tsnap = s.get("template_snapshot") or {}
        q_by_id = {qq["id"]: qq for qq in (tsnap.get("questions") or []) if qq.get("type") == "rating"}
        for f in s.get("faculty_snapshot") or []:
            fid_ = f.get("faculty_id")
            sname = f.get("subject_name") or "—"
            sid = f.get("subject_id")
            if faculty_id and fid_ != faculty_id: continue
            if subject_id and sid != subject_id: continue
            faculty_names[fid_] = f.get("faculty_name") or fid_
            subject_names[sid or ""] = sname
            aid = f.get("assignment_id")
            ans = (s.get("answers") or {}).get(aid) or {}
            if not isinstance(ans, dict): continue
            for qid, v in ans.items():
                if qid not in q_by_id: continue
                if not (isinstance(v, (int, str)) and str(v).isdigit() and 1 <= int(v) <= 5): continue
                n = int(v)
                key = f"{fid_}|{sid}|{qid}"
                c = combos.setdefault(key, {
                    "faculty_id": fid_, "faculty_name": faculty_names[fid_],
                    "subject_id": sid, "subject_name": sname,
                    "question_id": qid, "question_label": q_by_id[qid].get("label") or qid,
                    "values": [],
                })
                c["values"].append(n)

    rows = []
    for _, c in combos.items():
        vals = c.pop("values")
        rows.append({
            **c,
            "avg": round(sum(vals) / len(vals), 2),
            "count": len(vals),
            "distribution": {str(i): sum(1 for v in vals if v == i) for i in range(1, 6)},
        })
    rows.sort(key=lambda x: (x["faculty_name"], x["subject_name"], -x["avg"]))
    return {"count": len(rows), "rows": rows}




# ---------------- Events (unchanged) ----------------
class Event(BaseModel):
    id: str = Field(default_factory=lambda: uid())
    title: str
    description: str = ""
    venue: str = ""
    speaker: str = ""
    starts_at: str
    ends_at: str
    feedback_type: str = "academic"
    active: bool = True


class EventIn(BaseModel):
    title: str
    description: str = ""
    venue: str = ""
    speaker: str = ""
    starts_at: str
    ends_at: str
    feedback_type: str = "academic"
    active: bool = True


@api.get("/events")
async def list_events():
    return await db.events.find({}, {"_id": 0}).sort("starts_at", 1).to_list(1000)


@api.post("/events")
async def create_event(payload: EventIn, request: Request):
    await require_admin(request)
    e = Event(**payload.model_dump()); await db.events.insert_one(e.model_dump()); return e


@api.put("/events/{eid}")
async def update_event(eid: str, payload: EventIn, request: Request):
    await require_admin(request)
    await db.events.update_one({"id": eid}, {"$set": payload.model_dump()})
    return await db.events.find_one({"id": eid}, {"_id": 0})


@api.delete("/events/{eid}")
async def delete_event(eid: str, request: Request):
    await require_admin(request)
    await db.events.delete_one({"id": eid})
    return {"ok": True}


# ---------------- Seed (dev only, admin required) ----------------
@api.post("/seed")
async def seed(request: Request):
    await require_admin(request)
    # Academic structure
    async def upsert_many(entity, items, key="name"):
        for i in items:
            if not await db[entity].find_one({key: i[key]}):
                i.setdefault("id", uid())
                i.setdefault("active", True)
                i.setdefault("created_at", utcnow_iso())
                await db[entity].insert_one(i)

    await upsert_many("departments", [
        {"name": "Business Administration", "code": "BBA"},
        {"name": "Commerce", "code": "BCOM"},
        {"name": "Computer Science", "code": "BCA"},
    ])
    depts = {d["name"]: d for d in await db.departments.find({}, {"_id": 0}).to_list(100)}
    await upsert_many("programs", [
        {"name": "BBA", "code": "BBA", "department_id": depts["Business Administration"]["id"]},
        {"name": "B.Com", "code": "BCOM", "department_id": depts["Commerce"]["id"]},
        {"name": "BCA", "code": "BCA", "department_id": depts["Computer Science"]["id"]},
    ])
    await upsert_many("academic_years", [{"name": "2025-2026"}, {"name": "2024-2025"}])
    for i, n in enumerate(["1st Year", "2nd Year", "3rd Year"], start=1):
        if not await db.year_levels.find_one({"name": n}):
            await db.year_levels.insert_one({"id": uid(), "name": n, "order": i, "active": True, "created_at": utcnow_iso()})
    for i, n in enumerate([f"Semester {j}" for j in range(1, 7)], start=1):
        if not await db.semesters.find_one({"name": n}):
            await db.semesters.insert_one({"id": uid(), "name": n, "order": i, "active": True, "created_at": utcnow_iso()})
    await upsert_many("divisions", [{"name": "A"}, {"name": "B"}, {"name": "C"}])
    await upsert_many("subjects", [
        {"name": "Financial Management", "code": "BBA301"},
        {"name": "Marketing Management", "code": "BBA302"},
        {"name": "Business Law", "code": "BBA303"},
        {"name": "Human Resource Management", "code": "BBA304"},
        {"name": "Operations Research", "code": "BBA305"},
        {"name": "Business Analytics", "code": "BBA306"},
        {"name": "Entrepreneurship", "code": "BBA307"},
    ])
    # Ensure events seed for existing
    if await db.events.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        await db.events.insert_many([
            {"id": uid(), "title": "AI in Business — Guest Lecture", "description": "Applied AI in modern enterprises.", "venue": "Auditorium A", "speaker": "Dr. Arjun Rao", "starts_at": (now + timedelta(days=3)).isoformat(), "ends_at": (now + timedelta(days=3, hours=2)).isoformat(), "feedback_type": "academic", "active": True},
            {"id": uid(), "title": "Design Thinking Workshop", "description": "Hands-on workshop.", "venue": "Innovation Lab", "speaker": "Prof. Ravi Deshpande", "starts_at": (now - timedelta(days=5)).isoformat(), "ends_at": (now - timedelta(days=5, hours=-3)).isoformat(), "feedback_type": "certification", "active": True},
        ])
    return {"ok": True}


@api.get("/")
async def root():
    return {"app": "KLECBA Feedback Portal", "ok": True}


@app.get("/")
async def app_root():
    return {"app": "KLECBA Feedback Portal", "ok": True}


@app.get("/api")
async def api_root():
    return {"app": "KLECBA Feedback Portal", "ok": True}


app.include_router(api)

configured_origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "*").split(",") if origin.strip()]
if "*" in configured_origins:
    configured_origins = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001", FRONTEND_URL]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=configured_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint for Render and load balancers
@app.get("/api/health")
async def health_check():
    """Health check endpoint for deployment platforms."""
    try:
        # Verify database connection
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error("Health check failed: %s", type(e).__name__)
        return {"status": "unhealthy", "database": "unavailable"}


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
