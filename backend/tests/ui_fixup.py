"""Dedupe faculty_assignments (keeps first per faculty+subject+scope) and clear student's draft/submission for re-test."""
import sys
sys.path.insert(0, "/app/backend/tests")
import requests
from conftest import API, mongosh

s = requests.Session()
s.post(f"{API}/auth/admin-login", json={"email": "admin@klecba.edu.in", "password": "KlecbaAdmin@2026"}, timeout=30)
asg = s.get(f"{API}/assignments", timeout=30).json()
seen = set()
for a in asg:
    key = (a["faculty_id"], a["subject_id"], a["program_id"], a["year_level_id"], a["semester_id"], a["division_id"], a["academic_year_id"])
    if key in seen:
        s.delete(f"{API}/assignments/{a['id']}", timeout=30)
        print("deleted duplicate", a["id"])
    else:
        seen.add(key)
print("remaining:", len(s.get(f"{API}/assignments", timeout=30).json()))
mongosh("db.feedback_drafts.deleteMany({user_id:/^uitest_/}); db.feedback_submissions.deleteMany({user_id:/^uitest_/});")
print("cleared drafts/submissions for uitest students")
