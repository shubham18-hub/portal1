"""Helper (not a pytest test): create/remove an ACTIVE student-category cycle matching the
preview student's profile so the UI can be checked in the 'ongoing' state.
Usage: python ui_cat_seed.py create|delete
"""
import sys
from datetime import datetime, timezone, timedelta

import requests
from conftest import API, mongosh
from dotenv import dotenv_values
import re
from pathlib import Path

content = Path("/app/memory/test_credentials.md").read_text()
email = re.search(r'(?im)^\s*[-*]?\s*(?:\*\*)?Email(?:\*\*)?\s*:\s*\**([^\s*]+)', content).group(1)
pwd = re.search(r'(?im)^\s*[-*]?\s*(?:\*\*)?Password(?:\*\*)?\s*:\s*\**([^\s*]+)', content).group(1)

s = requests.Session()
r = s.post(f"{API}/auth/admin-login", json={"email": email, "password": pwd}, timeout=30)
assert r.status_code == 200, r.text


def iso(d):
    return (datetime.now(timezone.utc) + timedelta(days=d)).isoformat()


def create():
    prof = None
    out = mongosh("print(JSON.stringify(db.student_profiles.findOne({student_id:'PREVIEW-001'})));")
    import json
    prof = json.loads(out.splitlines()[-1])
    print("preview profile:", {k: prof.get(k) for k in ["program_id", "year_level_id", "semester_id", "division_id", "academic_year_id", "department_id"]})

    t = s.post(f"{API}/templates", json={"name": "TEST_UICat", "category": "student", "rating_scale": 5}, timeout=30).json()
    s.put(f"{API}/templates/{t['id']}", json={"questions": [
        {"id": "q1", "type": "rating", "text": "TEST rate", "label": "TEST rate", "required": True},
        {"id": "q2", "type": "text", "text": "TEST comment", "label": "TEST comment", "required": False},
    ]}, timeout=30)
    p = s.post(f"{API}/templates/{t['id']}/publish", timeout=30)
    assert p.status_code == 200, p.text
    c = s.post(f"{API}/cycles", json={
        "name": "TEST_UICycle",
        "template_id": t["id"],
        "academic_year_id": prof.get("academic_year_id"),
        "department_id": prof.get("department_id"),
        "program_id": prof.get("program_id"),
        "year_level_id": prof.get("year_level_id"),
        "semester_id": prof.get("semester_id"),
        "division_ids": [prof.get("division_id")],
        "starts_at": iso(-1), "ends_at": iso(7), "status": "active",
    }, timeout=30)
    assert c.status_code == 200, c.text
    print("cycle_id", c.json()["id"])


def delete():
    mongosh("""
db.feedback_submissions.deleteMany({cycle_name:/^TEST_UICycle/});
var cs = db.feedback_cycles.find({name:/^TEST_UICycle/}).toArray();
cs.forEach(function(c){ db.feedback_submissions.deleteMany({cycle_id:c.id}); db.feedback_drafts.deleteMany({cycle_id:c.id}); });
db.feedback_cycles.deleteMany({name:/^TEST_UICycle/});
db.feedback_templates.deleteMany({name:/^TEST_UICat/});
db.feedback_template_versions.deleteMany({name:/^TEST_UICat/});
""")
    print("deleted")


if __name__ == "__main__":
    {"create": create, "delete": delete}[sys.argv[1]]()
