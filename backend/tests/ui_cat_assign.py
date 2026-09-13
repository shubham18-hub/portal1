"""Helper: create a faculty assignment matching the preview student's scope (BBA/1st Year/Sem1/Div A)
so the feedback wizard has one faculty to rate. Usage: python ui_cat_assign.py create|delete"""
import json
import re
import sys
from pathlib import Path

import requests
from conftest import API, mongosh

content = Path("/app/memory/test_credentials.md").read_text()
email = re.search(r'(?im)^\s*[-*]?\s*(?:\*\*)?Email(?:\*\*)?\s*:\s*\**([^\s*]+)', content).group(1)
pwd = re.search(r'(?im)^\s*[-*]?\s*(?:\*\*)?Password(?:\*\*)?\s*:\s*\**([^\s*]+)', content).group(1)
s = requests.Session()
assert s.post(f"{API}/auth/admin-login", json={"email": email, "password": pwd}, timeout=30).status_code == 200


def create():
    prof = json.loads(mongosh("print(JSON.stringify(db.student_profiles.findOne({student_id:'PREVIEW-001'})));").splitlines()[-1])
    fac = json.loads(mongosh("print(JSON.stringify(db.users.findOne({email:'preview.faculty@klecba.edu.in'})));").splitlines()[-1])
    subj = requests.get(f"{API}/subjects", timeout=30).json()[0]
    payload = {
        "faculty_id": fac["user_id"],
        "subject_id": subj["id"],
        "program_id": prof["program_id"],
        "year_level_id": prof["year_level_id"],
        "semester_id": prof["semester_id"],
        "division_id": prof["division_id"],
        "academic_year_id": prof["academic_year_id"],
    }
    r = s.post(f"{API}/assignments", json=payload, timeout=30)
    print(r.status_code, r.text[:200])
    Path("/tmp/ui_assignment_id").write_text(r.json()["id"])


def delete():
    p = Path("/tmp/ui_assignment_id")
    if p.exists():
        print(s.delete(f"{API}/assignments/{p.read_text().strip()}", timeout=30).status_code)
        p.unlink()


if __name__ == "__main__":
    {"create": create, "delete": delete}[sys.argv[1]]()
