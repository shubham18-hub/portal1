"""New endpoints: GET /api/my/categories, /api/faculty/me/scope, /api/faculty/me/export,
and the year/division + improvement additions to /api/faculty/me/insights.
Single class so xdist loadscope keeps the sequential shared state intact."""
import csv
import io
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

from conftest import API, mongosh

S = {}
CATS = ["student", "certification", "faculty", "academic"]


def iso(delta_days):
    return (datetime.now(timezone.utc) + timedelta(days=delta_days)).isoformat()


def mk_session(role, prefix):
    suffix = uuid.uuid4().hex[:8]
    user_id = f"TEST_{prefix}_{suffix}"
    token = f"TEST_sess_{suffix}"
    exp = iso(7)
    mongosh(f"""
db.users.insertOne({{user_id:'{user_id}', email:'TEST_{prefix}_{suffix}@klecba.edu.in', name:'TEST {prefix}', role:'{role}', picture:null, created_at:'{exp}'}});
db.user_sessions.insertOne({{user_id:'{user_id}', session_token:'{token}', expires_at:'{exp}', created_at:'{exp}'}});
""")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return {"user_id": user_id, "token": token, "client": s}


@pytest.fixture(scope="class")
def cat_student():
    u = mk_session("student", "catstu")
    yield u
    mongosh(f"""
db.users.deleteMany({{user_id:'{u['user_id']}'}});
db.user_sessions.deleteMany({{user_id:'{u['user_id']}'}});
db.student_profiles.deleteMany({{user_id:'{u['user_id']}'}});
db.feedback_drafts.deleteMany({{user_id:'{u['user_id']}'}});
db.feedback_submissions.deleteMany({{user_id:'{u['user_id']}'}});
""")


@pytest.fixture(scope="class")
def noprof_student():
    u = mk_session("student", "catnoprof")
    yield u
    mongosh(f"db.users.deleteMany({{user_id:'{u['user_id']}'}}); db.user_sessions.deleteMany({{user_id:'{u['user_id']}'}});")


class TestCategoriesAndFacultyScope:

    # ---- empty / unassigned state ----
    def test_00_categories_no_profile(self, noprof_student):
        r = noprof_student["client"].get(f"{API}/my/categories", timeout=30)
        assert r.status_code == 200, r.text
        cards = r.json()
        assert isinstance(cards, list) and len(cards) == 4, cards
        assert [c["category"] for c in cards] == CATS
        titles = {c["category"]: c["title"] for c in cards}
        assert titles["student"] == "Student Feedback"
        assert titles["certification"] == "Certification Course"
        assert titles["faculty"] == "Faculty Feedback"
        assert titles["academic"] == "Academic Feedback"
        for c in cards:
            assert c["status"] == "upcoming", c
            assert c["cycle"] is None
            assert c["submitted"] is False
            assert c["has_draft"] is False
            assert c["desc"]

    def test_01_categories_requires_auth(self, anon_client):
        assert anon_client.get(f"{API}/my/categories", timeout=30).status_code == 401

    # ---- build an isolated scope: new division + faculty + assignment + student profile ----
    def test_10_setup_scope(self, admin_client, seeded):
        div = admin_client.post(f"{API}/divisions", json={"name": f"TEST_CATDIV_{uuid.uuid4().hex[:4]}"}, timeout=30)
        assert div.status_code == 200, div.text
        S["division_id"] = div.json()["id"]

        prog = [p for p in seeded["programs"] if p["name"] == "BBA"][0]
        femail = f"TEST_catfac_{uuid.uuid4().hex[:6]}@klecba.edu.in"
        fr = admin_client.post(f"{API}/faculty", json={"name": "TEST Cat Faculty", "email": femail,
                                                      "department_id": prog["department_id"]}, timeout=30)
        assert fr.status_code == 200, fr.text
        S["faculty_id"] = fr.json()["user_id"]

        scope = {
            "faculty_id": S["faculty_id"],
            "subject_id": seeded["subjects"][0]["id"],
            "program_id": prog["id"],
            "year_level_id": seeded["year_levels"][0]["id"],
            "semester_id": seeded["semesters"][0]["id"],
            "division_id": S["division_id"],
            "academic_year_id": seeded["academic_years"][0]["id"],
        }
        S["scope"] = scope
        ar = admin_client.post(f"{API}/assignments", json=scope, timeout=30)
        assert ar.status_code == 200, ar.text
        S["assignment_id"] = ar.json()["id"]
        S["department_id"] = prog["department_id"]

    def test_11_student_profile(self, admin_client, cat_student):
        prof = {
            "user_id": cat_student["user_id"],
            "student_id": "TEST_ROLL_CAT",
            "department_id": S["department_id"],
            "program_id": S["scope"]["program_id"],
            "year_level_id": S["scope"]["year_level_id"],
            "semester_id": S["scope"]["semester_id"],
            "division_id": S["division_id"],
            "academic_year_id": S["scope"]["academic_year_id"],
        }
        r = admin_client.post(f"{API}/students/profile", json=prof, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["student_id"] == "TEST_ROLL_CAT"
        me = cat_student["client"].get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200
        assert me.json()["profile"]["student_id"] == "TEST_ROLL_CAT"

    def test_12_publish_student_template_and_active_cycle(self, admin_client):
        t = admin_client.post(f"{API}/templates", json={"name": f"TEST_CatTemplate_{uuid.uuid4().hex[:4]}",
                                                        "category": "student", "rating_scale": 5}, timeout=30)
        assert t.status_code == 200, t.text
        tid = t.json()["id"]
        S["template_id"] = tid
        qs = [
            {"id": "q1", "type": "rating", "text": "TEST clarity", "label": "TEST clarity", "required": True},
            {"id": "q2", "type": "rating", "text": "TEST punctuality", "label": "TEST punctuality", "required": True},
            {"id": "q3", "type": "text", "text": "TEST comments", "label": "TEST comments", "required": False},
        ]
        assert admin_client.put(f"{API}/templates/{tid}", json={"questions": qs}, timeout=30).status_code == 200
        pub = admin_client.post(f"{API}/templates/{tid}/publish", timeout=30)
        assert pub.status_code == 200, pub.text

        sc = S["scope"]
        cyc = admin_client.post(f"{API}/cycles", json={
            "name": f"TEST_CatCycle_{uuid.uuid4().hex[:4]}",
            "template_id": tid,
            "academic_year_id": sc["academic_year_id"],
            "department_id": S["department_id"],
            "program_id": sc["program_id"],
            "year_level_id": sc["year_level_id"],
            "semester_id": sc["semester_id"],
            "division_ids": [S["division_id"]],
            "starts_at": iso(-1),
            "ends_at": iso(10),
            "status": "active",
        }, timeout=30)
        assert cyc.status_code == 200, cyc.text
        S["cycle_id"] = cyc.json()["id"]

    def test_13_categories_ongoing(self, cat_student):
        r = cat_student["client"].get(f"{API}/my/categories", timeout=30)
        assert r.status_code == 200, r.text
        cards = {c["category"]: c for c in r.json()}
        assert len(cards) == 4
        stu = cards["student"]
        assert stu["status"] == "ongoing", stu
        assert stu["cycle"] and stu["cycle"]["id"] == S["cycle_id"]
        assert "_id" not in stu["cycle"]
        assert stu["submitted"] is False
        assert stu["has_draft"] is False

    def test_14_categories_has_draft(self, cat_student):
        ctx = cat_student["client"].get(f"{API}/my/cycles/{S['cycle_id']}/context", timeout=30)
        assert ctx.status_code == 200, ctx.text
        items = ctx.json()["faculty_items"]
        assert items, "faculty_items empty"
        S["faculty_items"] = items
        aid = items[0]["assignment_id"]
        assert aid == S["assignment_id"]
        d = cat_student["client"].post(f"{API}/my/cycles/{S['cycle_id']}/draft",
                                      json={"answers": {aid: {"q1": 3}}, "step": 1}, timeout=30)
        assert d.status_code == 200, d.text
        cards = {c["category"]: c for c in cat_student["client"].get(f"{API}/my/categories", timeout=30).json()}
        assert cards["student"]["has_draft"] is True
        assert cards["student"]["status"] == "ongoing"

    def test_15_categories_completed_after_submit(self, cat_student):
        aid = S["assignment_id"]
        payload = {"answers": {aid: {"q1": 4, "q2": 2, "q3": "TEST needs improvement in punctuality"}},
                   "faculty_items": S["faculty_items"]}
        r = cat_student["client"].post(f"{API}/my/cycles/{S['cycle_id']}/submit", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        cards = {c["category"]: c for c in cat_student["client"].get(f"{API}/my/categories", timeout=30).json()}
        stu = cards["student"]
        assert stu["status"] == "completed", stu
        assert stu["submitted"] is True
        assert stu["has_draft"] is False

    # ---- faculty scope / insights / export ----
    def test_20_faculty_scope(self):
        S["fac_client"] = requests.Session()
        token = f"TEST_sess_{uuid.uuid4().hex[:8]}"
        mongosh(f"db.user_sessions.insertOne({{user_id:'{S['faculty_id']}', session_token:'{token}', expires_at:'{iso(7)}', created_at:'{iso(0)}'}});")
        S["fac_token"] = token
        S["fac_client"].headers.update({"Authorization": f"Bearer {token}"})

        r = S["fac_client"].get(f"{API}/faculty/me/scope", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(body.keys()) == {"years", "divisions"}
        assert any(y["id"] == S["scope"]["year_level_id"] for y in body["years"]), body["years"]
        assert any(d["id"] == S["division_id"] for d in body["divisions"]), body["divisions"]
        assert all("_id" not in y for y in body["years"])
        assert all("_id" not in d for d in body["divisions"])

    def test_21_faculty_scope_empty_when_no_assignments(self, admin_client):
        email = f"TEST_emptyfac_{uuid.uuid4().hex[:6]}@klecba.edu.in"
        fr = admin_client.post(f"{API}/faculty", json={"name": "TEST Empty Faculty", "email": email}, timeout=30)
        assert fr.status_code == 200, fr.text
        fid = fr.json()["user_id"]
        token = f"TEST_sess_{uuid.uuid4().hex[:8]}"
        mongosh(f"db.user_sessions.insertOne({{user_id:'{fid}', session_token:'{token}', expires_at:'{iso(7)}', created_at:'{iso(0)}'}});")
        c = requests.Session(); c.headers.update({"Authorization": f"Bearer {token}"})
        r = c.get(f"{API}/faculty/me/scope", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json() == {"years": [], "divisions": []}
        ins = c.get(f"{API}/faculty/me/insights", timeout=30)
        assert ins.status_code == 200
        assert ins.json()["response_count"] == 0
        assert ins.json()["improvement"] is None
        mongosh(f"db.users.deleteMany({{user_id:'{fid}'}}); db.user_sessions.deleteMany({{session_token:'{token}'}});")

    def test_22_insights_unfiltered_improvement(self):
        r = S["fac_client"].get(f"{API}/faculty/me/insights", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["response_count"] >= 1
        imp = d["improvement"]
        assert imp is not None, d
        assert imp["label"] == "TEST punctuality", imp  # lowest avg question (2 vs 4)
        assert imp["avg"] == 2.0
        assert imp["count"] >= 1
        labels = {q["label"] for q in d["question_ratings"]}
        assert {"TEST clarity", "TEST punctuality"} <= labels
        assert any("punctuality" in (c["text"] or "") for c in d["comments"])

    def test_23_insights_scope_filter_match(self):
        r = S["fac_client"].get(f"{API}/faculty/me/insights", timeout=30,
                                params={"year_level_id": S["scope"]["year_level_id"],
                                        "division_id": S["division_id"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["response_count"] >= 1, d
        assert d["improvement"] and d["improvement"]["label"] == "TEST punctuality"

    def test_24_insights_scope_filter_excludes(self, seeded):
        other_div = [x["id"] for x in seeded["divisions"] if x["id"] != S["division_id"]][0]
        r = S["fac_client"].get(f"{API}/faculty/me/insights", timeout=30,
                                params={"division_id": other_div})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["response_count"] == 0, d
        assert d["question_ratings"] == []
        assert d["improvement"] is None
        assert d["overall_avg"] == 0

    def test_25_export_csv(self):
        r = S["fac_client"].get(f"{API}/faculty/me/export", params={"fmt": "csv"}, timeout=60)
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "")
        rows = list(csv.DictReader(io.StringIO(r.text)))
        header = r.text.splitlines()[0]
        for col in ["submitted_at", "subject", "question", "type", "answer"]:
            assert col in header, header
        assert rows, "csv had no data rows"
        # No student PII
        low = r.text.lower()
        for leak in ["email", "@klecba", "user_id", "student_id", "TEST_ROLL_CAT".lower()]:
            assert leak not in low, f"PII leak '{leak}' in export"
        assert any(row["question"] == "TEST punctuality" for row in rows), rows[:3]

    def test_26_export_xlsx(self):
        r = S["fac_client"].get(f"{API}/faculty/me/export", params={"fmt": "xlsx"}, timeout=60)
        assert r.status_code == 200, r.text
        assert "spreadsheet" in r.headers.get("content-type", "")
        assert r.content[:2] == b"PK"
        assert len(r.content) > 1000

    def test_27_export_scope_filter(self, seeded):
        other_div = [x["id"] for x in seeded["divisions"] if x["id"] != S["division_id"]][0]
        r = S["fac_client"].get(f"{API}/faculty/me/export",
                                params={"fmt": "csv", "division_id": other_div}, timeout=60)
        assert r.status_code == 200
        assert "no data" in r.text.lower(), r.text[:200]

    # ---- RBAC ----
    @pytest.mark.parametrize("path", ["/faculty/me/insights", "/faculty/me/scope", "/faculty/me/export?fmt=csv"])
    def test_30_non_faculty_forbidden(self, path, cat_student, admin_client):
        assert cat_student["client"].get(f"{API}{path}", timeout=30).status_code == 403, path
        assert admin_client.get(f"{API}{path}", timeout=30).status_code == 403, path

    @pytest.mark.parametrize("path", ["/faculty/me/insights", "/faculty/me/scope", "/faculty/me/export?fmt=csv"])
    def test_31_anon_unauthorized(self, path, anon_client):
        assert anon_client.get(f"{API}{path}", timeout=30).status_code == 401, path

    # ---- cleanup ----
    def test_99_cleanup(self, admin_client):
        if S.get("assignment_id"):
            admin_client.delete(f"{API}/assignments/{S['assignment_id']}", timeout=30)
        mongosh(f"""
db.feedback_submissions.deleteMany({{cycle_id:'{S.get('cycle_id','x')}'}});
db.feedback_drafts.deleteMany({{cycle_id:'{S.get('cycle_id','x')}'}});
db.feedback_cycles.deleteMany({{name:/^TEST_CatCycle/}});
db.feedback_templates.deleteMany({{name:/^TEST_CatTemplate/}});
db.feedback_template_versions.deleteMany({{name:/^TEST_CatTemplate/}});
db.divisions.deleteMany({{name:/^TEST_CATDIV/}});
db.users.deleteMany({{email:/^test_catfac/i}});
db.users.deleteMany({{email:/^test_emptyfac/i}});
db.user_sessions.deleteMany({{session_token:'{S.get('fac_token','x')}'}});
db.faculty_assignments.deleteMany({{division_id:'{S.get('division_id','x')}'}});
""")
        assert True
