"""Seeds a full student happy-path scenario for frontend testing. Prints JSON with tokens/ids."""
import json
import sys
import uuid
from datetime import datetime, timezone, timedelta

sys.path.insert(0, "/app/backend/tests")
import requests
from conftest import API, mongosh

ADMIN = {"email": "admin@klecba.edu.in", "password": "KlecbaAdmin@2026"}


def iso(d):
    return (datetime.now(timezone.utc) + timedelta(days=d)).isoformat()


s = requests.Session()
r = s.post(f"{API}/auth/admin-login", json=ADMIN, timeout=30)
assert r.status_code == 200, r.text
admin_token = s.cookies.get("session_token")
s.post(f"{API}/seed", timeout=60)

ent = {e: requests.get(f"{API}/{e}", timeout=30).json() for e in
       ["departments", "programs", "year_levels", "semesters", "divisions", "subjects", "academic_years"]}
prog = [p for p in ent["programs"] if p["name"] == "BBA"][0]
scope = {
    "program_id": prog["id"],
    "department_id": prog["department_id"],
    "year_level_id": ent["year_levels"][0]["id"],
    "semester_id": ent["semesters"][0]["id"],
    "division_id": ent["divisions"][0]["id"],
    "academic_year_id": ent["academic_years"][0]["id"],
}

# student user + session
suffix = uuid.uuid4().hex[:6]
student_uid = f"uitest_student_{suffix}"
student_token = f"uitest_sess_{suffix}"
exp = iso(7)
mongosh(f"""
db.users.insertOne({{user_id:'{student_uid}', email:'uitest.student.{suffix}@klecba.edu.in', name:'UITest Student', role:'student', picture:null, created_at:'{exp}'}});
db.user_sessions.insertOne({{user_id:'{student_uid}', session_token:'{student_token}', expires_at:'{exp}', created_at:'{exp}'}});
""")

# student with NO profile
suffix2 = uuid.uuid4().hex[:6]
np_uid = f"uitest_noprof_{suffix2}"
np_token = f"uitest_sess_{suffix2}"
mongosh(f"""
db.users.insertOne({{user_id:'{np_uid}', email:'uitest.noprof.{suffix2}@klecba.edu.in', name:'UITest NoProfile', role:'student', picture:null, created_at:'{exp}'}});
db.user_sessions.insertOne({{user_id:'{np_uid}', session_token:'{np_token}', expires_at:'{exp}', created_at:'{exp}'}});
""")

# profile
p = s.post(f"{API}/students/profile", json={"user_id": student_uid, "student_id": "UITEST01", **scope}, timeout=30)
assert p.status_code == 200, p.text

# faculty + 2 assignments
fac_ids = []
for i, name in enumerate(["UITest Prof One", "UITest Prof Two"]):
    f = s.post(f"{API}/faculty", json={"name": name, "email": f"uitest.fac{i}.{suffix}@klecba.edu.in",
                                       "department_id": scope["department_id"]}, timeout=30).json()
    fac_ids.append(f["user_id"])
    a = s.post(f"{API}/assignments", json={"faculty_id": f["user_id"], "subject_id": ent["subjects"][i]["id"], **scope}, timeout=30)
    assert a.status_code == 200, a.text

# template with 2 questions
t = s.post(f"{API}/templates", json={"name": "UITest Student Feedback", "category": "student",
                                     "description": "UI test template"}, timeout=30).json()
qs = [
    {"id": "uq1", "label": "Teaching clarity", "type": "rating", "required": True},
    {"id": "uq2", "label": "Additional comments", "type": "text", "required": False},
]
s.put(f"{API}/templates/{t['id']}", json={"questions": qs}, timeout=30)
v = s.post(f"{API}/templates/{t['id']}/publish", timeout=30).json()

c = s.post(f"{API}/cycles", json={
    "name": "UITest Cycle 2026", "template_id": t["id"], "division_ids": [scope["division_id"]],
    "starts_at": iso(-2), "ends_at": iso(20), "status": "active",
    **{k: v2 for k, v2 in scope.items() if k != "division_id"},
}, timeout=30)
assert c.status_code == 200, c.text

print(json.dumps({
    "admin_token": admin_token,
    "student_token": student_token,
    "noprofile_token": np_token,
    "cycle_id": c.json()["id"],
    "template_id": t["id"],
}, indent=2))
