import os
import re
import uuid
import subprocess
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

backend_env = dotenv_values("/app/backend/.env")
DB_NAME = backend_env.get("DB_NAME")
MONGO_URL = backend_env.get("MONGO_URL")


def mongosh(js: str):
    """Run a mongosh script against the app DB and return stdout."""
    script = f"use('{DB_NAME}');\n{js}"
    res = subprocess.run(["mongosh", MONGO_URL, "--quiet", "--eval", script],
                         capture_output=True, text=True, timeout=60)
    if res.returncode != 0:
        raise RuntimeError(f"mongosh failed: {res.stderr}\n{res.stdout}")
    return res.stdout.strip()


@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*[-*]?\s*(?:\*\*)?Email(?:\*\*)?\s*:\s*\**([^\s*]+)', content)
    pwd = re.search(r'(?im)^\s*[-*]?\s*(?:\*\*)?Password(?:\*\*)?\s*:\s*\**([^\s*]+)', content)
    if not email or not pwd:
        pytest.skip("no credentials found")
    return {"email": email.group(1), "password": pwd.group(1)}


@pytest.fixture(scope="session")
def admin_client(test_credentials):
    s = requests.Session()
    r = s.post(f"{API}/auth/admin-login", json=test_credentials, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    return s


@pytest.fixture(scope="session")
def seeded(admin_client):
    r = admin_client.post(f"{API}/seed", timeout=60)
    assert r.status_code == 200, r.text
    out = {}
    for ent in ["departments", "programs", "academic_years", "year_levels", "semesters", "divisions", "subjects"]:
        out[ent] = requests.get(f"{API}/{ent}", timeout=30).json()
    return out


@pytest.fixture(scope="session")
def student_session():
    """Create a student user + session directly in Mongo."""
    suffix = uuid.uuid4().hex[:8]
    user_id = f"TEST_student_{suffix}"
    token = f"TEST_sess_{suffix}"
    exp = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    mongosh(f"""
db.users.insertOne({{user_id:'{user_id}', email:'TEST_student_{suffix}@klecba.edu.in', name:'TEST Student {suffix}', role:'student', picture:null, created_at:'{exp}'}});
db.user_sessions.insertOne({{user_id:'{user_id}', session_token:'{token}', expires_at:'{exp}', created_at:'{exp}'}});
""")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    yield {"user_id": user_id, "token": token, "client": s}
    mongosh(f"""
db.users.deleteMany({{user_id:'{user_id}'}});
db.user_sessions.deleteMany({{user_id:'{user_id}'}});
db.student_profiles.deleteMany({{user_id:'{user_id}'}});
db.feedback_drafts.deleteMany({{user_id:'{user_id}'}});
db.feedback_submissions.deleteMany({{user_id:'{user_id}'}});
""")


@pytest.fixture(scope="session")
def anon_client():
    return requests.Session()
