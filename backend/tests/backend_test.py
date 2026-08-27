"""KLECBA Feedback Portal — backend API tests (single class to keep sequential shared state under xdist loadscope)."""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

from conftest import API, mongosh

STATE = {}


def iso(delta_days):
    return (datetime.now(timezone.utc) + timedelta(days=delta_days)).isoformat()


class TestKlecbaBackend:

    # ---- health ----
    def test_00_root(self, anon_client):
        r = anon_client.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    # ---- auth: admin password login ----
    def test_01_admin_login_success(self, test_credentials):
        s = requests.Session()
        r = s.post(f"{API}/auth/admin-login", json=test_credentials, timeout=30)
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        assert user["email"] == test_credentials["email"]
        assert user["role"] == "admin"
        assert "_id" not in user
        assert "session_token" in s.cookies.get_dict()
        # me works with cookie
        me = s.get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200
        assert me.json()["user"]["role"] == "admin"
        # logout invalidates
        lo = s.post(f"{API}/auth/logout", timeout=30)
        assert lo.status_code == 200
        me2 = s.get(f"{API}/auth/me", timeout=30)
        assert me2.status_code == 401

    def test_02_admin_login_wrong_password(self, test_credentials):
        r = requests.post(f"{API}/auth/admin-login",
                          json={"email": test_credentials["email"], "password": "wrong-pass"}, timeout=30)
        assert r.status_code == 401

    def test_03_admin_login_wrong_email(self):
        r = requests.post(f"{API}/auth/admin-login",
                          json={"email": "nobody@klecba.edu.in", "password": "whatever"}, timeout=30)
        assert r.status_code == 401

    def test_04_admin_login_missing_fields(self):
        r = requests.post(f"{API}/auth/admin-login", json={"email": ""}, timeout=30)
        assert r.status_code == 400

    def test_05_me_unauthenticated(self, anon_client):
        r = anon_client.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_06_google_session_requires_session_id(self, anon_client):
        r = anon_client.post(f"{API}/auth/session", json={}, timeout=30)
        assert r.status_code == 400

    def test_07_google_session_invalid_id(self, anon_client):
        r = anon_client.post(f"{API}/auth/session", json={"session_id": "bogus-id"}, timeout=30)
        assert r.status_code == 401

    # ---- seed ----
    def test_10_seed(self, admin_client, seeded):
        for ent in ["departments", "programs", "academic_years", "year_levels", "semesters", "divisions", "subjects"]:
            assert len(seeded[ent]) > 0, f"{ent} empty after seed"
        names = [d["name"] for d in seeded["departments"]]
        assert "Business Administration" in names

    def test_11_seed_requires_admin(self, anon_client):
        r = anon_client.post(f"{API}/seed", timeout=30)
        assert r.status_code == 401

    # ---- academic structure CRUD ----
    @pytest.mark.parametrize("entity,payload", [
        ("departments", {"name": "TEST_Dept", "code": "TDEPT"}),
        ("programs", {"name": "TEST_Prog", "code": "TPROG"}),
        ("academic_years", {"name": "TEST_2099-2100"}),
        ("year_levels", {"name": "TEST_9th Year", "order": 9}),
        ("semesters", {"name": "TEST_Semester 9", "order": 9}),
        ("divisions", {"name": "TEST_Z"}),
        ("subjects", {"name": "TEST_Subject", "code": "TSUB1"}),
    ])
    def test_12_structure_crud(self, admin_client, entity, payload):
        # GET public
        pub = requests.get(f"{API}/{entity}", timeout=30)
        assert pub.status_code == 200
        assert isinstance(pub.json(), list)

        # CREATE
        r = admin_client.post(f"{API}/{entity}", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert "_id" not in doc
        assert doc["id"]
        assert doc["name"] == payload["name"]
        oid = doc["id"]

        # GET verify persisted
        listing = requests.get(f"{API}/{entity}", timeout=30).json()
        found = [d for d in listing if d["id"] == oid]
        assert found, "created doc not in listing"
        assert found[0]["name"] == payload["name"]

        # UPDATE
        upd = admin_client.put(f"{API}/{entity}/{oid}", json={"name": payload["name"] + "_upd"}, timeout=30)
        assert upd.status_code == 200
        assert upd.json()["name"] == payload["name"] + "_upd"
        listing = requests.get(f"{API}/{entity}", timeout=30).json()
        assert [d for d in listing if d["id"] == oid][0]["name"] == payload["name"] + "_upd"

        # DELETE
        dl = admin_client.delete(f"{API}/{entity}/{oid}", timeout=30)
        assert dl.status_code == 200
        listing = requests.get(f"{API}/{entity}", timeout=30).json()
        assert not [d for d in listing if d["id"] == oid]

    @pytest.mark.parametrize("entity", ["departments", "programs", "subjects", "divisions"])
    def test_13_structure_write_requires_auth(self, anon_client, entity):
        assert anon_client.post(f"{API}/{entity}", json={"name": "TEST_x"}, timeout=30).status_code == 401
        assert anon_client.put(f"{API}/{entity}/nope", json={"name": "TEST_x"}, timeout=30).status_code == 401
        assert anon_client.delete(f"{API}/{entity}/nope", timeout=30).status_code == 401

    def test_14_structure_write_forbidden_for_student(self, student_session):
        c = student_session["client"]
        assert c.post(f"{API}/departments", json={"name": "TEST_x"}, timeout=30).status_code == 403

    def test_15_admin_only_endpoints_reject_student(self, student_session):
        c = student_session["client"]
        for path in ["/students", "/templates", "/responses", "/analytics/summary", "/export?fmt=csv"]:
            r = c.get(f"{API}{path}", timeout=30)
            assert r.status_code == 403, f"{path} -> {r.status_code}"

    # ---- faculty + assignments ----
    def test_20_create_faculty_and_assignment(self, admin_client, seeded):
        email = f"TEST_faculty_{uuid.uuid4().hex[:6]}@klecba.edu.in"
        r = admin_client.post(f"{API}/faculty", json={"name": "TEST Faculty", "email": email,
                                                     "department_id": seeded["departments"][0]["id"]}, timeout=30)
        assert r.status_code == 200, r.text
        f = r.json()
        assert f["role"] == "faculty"
        assert f["email"] == email.lower()  # backend normalizes to lowercase
        assert "_id" not in f
        STATE["faculty_id"] = f["user_id"]

        listing = admin_client.get(f"{API}/faculty", timeout=30)
        assert listing.status_code == 200
        assert any(x["user_id"] == f["user_id"] for x in listing.json())

        # update
        up = admin_client.put(f"{API}/faculty/{f['user_id']}", json={"name": "TEST Faculty Renamed"}, timeout=30)
        assert up.status_code == 200
        assert up.json()["name"] == "TEST Faculty Renamed"

        # assignment
        prog = [p for p in seeded["programs"] if p["name"] == "BBA"][0]
        payload = {
            "faculty_id": f["user_id"],
            "subject_id": seeded["subjects"][0]["id"],
            "program_id": prog["id"],
            "year_level_id": seeded["year_levels"][0]["id"],
            "semester_id": seeded["semesters"][0]["id"],
            "division_id": seeded["divisions"][0]["id"],
            "academic_year_id": seeded["academic_years"][0]["id"],
        }
        STATE["scope"] = payload
        ar = admin_client.post(f"{API}/assignments", json=payload, timeout=30)
        assert ar.status_code == 200, ar.text
        a = ar.json()
        assert a["id"] and a["active"] is True
        assert "_id" not in a
        STATE["assignment_id"] = a["id"]

        al = admin_client.get(f"{API}/assignments", timeout=30)
        assert al.status_code == 200
        assert any(x["id"] == a["id"] for x in al.json())

    def test_21_assignment_validation(self, admin_client):
        r = admin_client.post(f"{API}/assignments", json={"faculty_id": "x"}, timeout=30)
        assert r.status_code == 422

    def test_22_faculty_requires_email(self, admin_client):
        r = admin_client.post(f"{API}/faculty", json={"name": "TEST"}, timeout=30)
        assert r.status_code == 400

    def test_23_assignments_reject_anon(self, anon_client):
        assert anon_client.get(f"{API}/assignments", timeout=30).status_code == 401

    # ---- students ----
    def test_30_students_list_and_profile_upsert(self, admin_client, student_session, seeded):
        r = admin_client.get(f"{API}/students", timeout=30)
        assert r.status_code == 200
        students = r.json()
        mine = [s for s in students if s["user_id"] == student_session["user_id"]]
        assert mine, "test student not listed"
        assert "profile" in mine[0]

        scope = STATE["scope"]
        prof_payload = {
            "user_id": student_session["user_id"],
            "student_id": "TEST_ROLL_1",
            "department_id": [p for p in seeded["programs"] if p["id"] == scope["program_id"]][0]["department_id"],
            "program_id": scope["program_id"],
            "year_level_id": scope["year_level_id"],
            "semester_id": scope["semester_id"],
            "division_id": scope["division_id"],
            "academic_year_id": scope["academic_year_id"],
        }
        STATE["profile"] = prof_payload
        pr = admin_client.post(f"{API}/students/profile", json=prof_payload, timeout=30)
        assert pr.status_code == 200, pr.text
        prof = pr.json()
        assert prof["student_id"] == "TEST_ROLL_1"
        assert "_id" not in prof

        # verify via auth/me of the student
        me = student_session["client"].get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200
        assert me.json()["profile"]["student_id"] == "TEST_ROLL_1"

    def test_31_profile_requires_user_id(self, admin_client):
        r = admin_client.post(f"{API}/students/profile", json={}, timeout=30)
        assert r.status_code == 400

    # ---- templates ----
    def test_40_template_lifecycle(self, admin_client):
        r = admin_client.post(f"{API}/templates", json={"name": "TEST_Template", "category": "student",
                                                        "description": "qa", "rating_scale": 5}, timeout=30)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["latest_version"] == 0
        assert t["published_version_id"] is None
        assert t["iterates_faculty"] is True
        assert "_id" not in t
        tid = t["id"]
        STATE["template_id"] = tid

        questions = [
            {"id": "q1", "type": "rating", "text": "TEST rate teaching", "required": True},
            {"id": "q2", "type": "text", "text": "TEST comments", "required": False},
        ]
        STATE["questions"] = questions
        up = admin_client.put(f"{API}/templates/{tid}", json={"questions": questions}, timeout=30)
        assert up.status_code == 200
        assert len(up.json()["questions"]) == 2

        listing = admin_client.get(f"{API}/templates", timeout=30).json()
        got = [x for x in listing if x["id"] == tid][0]
        assert len(got["questions"]) == 2

        pubr = admin_client.post(f"{API}/templates/{tid}/publish", timeout=30)
        assert pubr.status_code == 200, pubr.text
        v = pubr.json()
        assert v["version"] == 1
        assert len(v["questions"]) == 2
        STATE["version_id"] = v["id"]

        listing = admin_client.get(f"{API}/templates", timeout=30).json()
        got = [x for x in listing if x["id"] == tid][0]
        assert got["latest_version"] == 1
        assert got["published_version_id"] == v["id"]

        # republish increments
        v2 = admin_client.post(f"{API}/templates/{tid}/publish", timeout=30).json()
        assert v2["version"] == 2
        listing = admin_client.get(f"{API}/templates", timeout=30).json()
        assert [x for x in listing if x["id"] == tid][0]["latest_version"] == 2
        STATE["version_id"] = v2["id"]

    def test_41_publish_missing_template(self, admin_client):
        r = admin_client.post(f"{API}/templates/does-not-exist/publish", timeout=30)
        assert r.status_code == 404

    # ---- cycles ----
    def test_50_cycle_requires_published_template(self, admin_client):
        draft = admin_client.post(f"{API}/templates", json={"name": "TEST_Unpublished"}, timeout=30).json()
        STATE["unpublished_template_id"] = draft["id"]
        r = admin_client.post(f"{API}/cycles", json={"name": "TEST_Bad Cycle", "template_id": draft["id"]}, timeout=30)
        assert r.status_code == 400
        assert "ublish" in r.json().get("detail", "")
        r2 = admin_client.post(f"{API}/cycles", json={"name": "TEST", "template_id": "nope"}, timeout=30)
        assert r2.status_code == 400

    def test_51_create_active_cycle(self, admin_client):
        scope = STATE["scope"]
        prof = STATE["profile"]
        payload = {
            "name": "TEST_Cycle Active",
            "template_id": STATE["template_id"],
            "academic_year_id": scope["academic_year_id"],
            "department_id": prof["department_id"],
            "program_id": scope["program_id"],
            "year_level_id": scope["year_level_id"],
            "semester_id": scope["semester_id"],
            "division_ids": [scope["division_id"]],
            "starts_at": iso(-2),
            "ends_at": iso(10),
            "status": "active",
        }
        r = admin_client.post(f"{API}/cycles", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["template_version_id"] == STATE["version_id"]
        assert c["status"] == "active"
        assert "_id" not in c
        STATE["cycle_id"] = c["id"]

        listing = admin_client.get(f"{API}/cycles", timeout=30).json()
        assert any(x["id"] == c["id"] for x in listing)

    def test_52_delete_template_used_by_cycle_blocked(self, admin_client):
        r = admin_client.delete(f"{API}/templates/{STATE['template_id']}", timeout=30)
        assert r.status_code == 400

    # ---- student flow ----
    def test_60_student_cycles_listed(self, student_session):
        r = student_session["client"].get(f"{API}/my/cycles", timeout=30)
        assert r.status_code == 200, r.text
        cycles = r.json()
        mine = [c for c in cycles if c["id"] == STATE["cycle_id"]]
        assert mine, f"active cycle not resolved for student: {cycles}"
        assert mine[0]["submitted"] is False
        assert mine[0]["has_draft"] is False

    def test_61_no_profile_student_gets_empty(self):
        suffix = uuid.uuid4().hex[:8]
        user_id = f"TEST_noprof_{suffix}"
        token = f"TEST_sess_{suffix}"
        exp = iso(7)
        mongosh(f"""
db.users.insertOne({{user_id:'{user_id}', email:'TEST_noprof_{suffix}@klecba.edu.in', name:'TEST NoProfile', role:'student', created_at:'{exp}'}});
db.user_sessions.insertOne({{user_id:'{user_id}', session_token:'{token}', expires_at:'{exp}', created_at:'{exp}'}});
""")
        try:
            s = requests.Session()
            s.headers.update({"Authorization": f"Bearer {token}"})
            r = s.get(f"{API}/my/cycles", timeout=30)
            assert r.status_code == 200
            assert r.json() == []
            ctx = s.get(f"{API}/my/cycles/{STATE['cycle_id']}/context", timeout=30)
            assert ctx.status_code == 400, ctx.status_code
        finally:
            mongosh(f"db.users.deleteMany({{user_id:'{user_id}'}}); db.user_sessions.deleteMany({{user_id:'{user_id}'}});")

    def test_62_cycle_context(self, student_session):
        r = student_session["client"].get(f"{API}/my/cycles/{STATE['cycle_id']}/context", timeout=30)
        assert r.status_code == 200, r.text
        ctx = r.json()
        assert ctx["cycle"]["id"] == STATE["cycle_id"]
        assert len(ctx["template_version"]["questions"]) == 2
        assert ctx["submitted"] is False
        assert ctx["profile"]["student_id"] == "TEST_ROLL_1"
        items = ctx["faculty_items"]
        assert items, "faculty_items empty — assignment not resolved"
        assert items[0]["assignment_id"] == STATE["assignment_id"]
        assert items[0]["faculty_name"]
        assert items[0]["subject_name"]
        STATE["faculty_items"] = items

    def test_63_context_not_found_and_forbidden(self, student_session, admin_client):
        r = student_session["client"].get(f"{API}/my/cycles/nonexistent/context", timeout=30)
        assert r.status_code == 404
        # admin is not a student
        r2 = admin_client.get(f"{API}/my/cycles/{STATE['cycle_id']}/context", timeout=30)
        assert r2.status_code == 403

    def test_64_save_draft(self, student_session):
        aid = STATE["faculty_items"][0]["assignment_id"]
        answers = {aid: {"q1": 4, "q2": "TEST draft comment"}}
        r = student_session["client"].post(f"{API}/my/cycles/{STATE['cycle_id']}/draft",
                                          json={"answers": answers, "step": 1}, timeout=30)
        assert r.status_code == 200, r.text
        ctx = student_session["client"].get(f"{API}/my/cycles/{STATE['cycle_id']}/context", timeout=30).json()
        assert ctx["draft"] is not None
        assert ctx["draft"]["step"] == 1
        assert ctx["draft"]["answers"][aid]["q2"] == "TEST draft comment"
        lst = student_session["client"].get(f"{API}/my/cycles", timeout=30).json()
        assert [c for c in lst if c["id"] == STATE["cycle_id"]][0]["has_draft"] is True

    def test_65_submit_and_reject_duplicate(self, student_session):
        aid = STATE["faculty_items"][0]["assignment_id"]
        answers = {aid: {"q1": 5, "q2": "TEST final comment"}}
        payload = {"answers": answers, "faculty_items": STATE["faculty_items"]}
        r = student_session["client"].post(f"{API}/my/cycles/{STATE['cycle_id']}/submit", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["avg"] == 5.0, body
        STATE["submission_id"] = body["id"]

        # draft deleted, submitted flag set
        ctx = student_session["client"].get(f"{API}/my/cycles/{STATE['cycle_id']}/context", timeout=30).json()
        assert ctx["draft"] is None
        assert ctx["submitted"] is True
        lst = student_session["client"].get(f"{API}/my/cycles", timeout=30).json()
        assert [c for c in lst if c["id"] == STATE["cycle_id"]][0]["submitted"] is True

        # duplicate rejected
        dup = student_session["client"].post(f"{API}/my/cycles/{STATE['cycle_id']}/submit", json=payload, timeout=30)
        assert dup.status_code == 400

        # draft after submission rejected
        d = student_session["client"].post(f"{API}/my/cycles/{STATE['cycle_id']}/draft", json={"answers": {}}, timeout=30)
        assert d.status_code == 400

    def test_66_delete_cycle_with_submissions_blocked(self, admin_client):
        r = admin_client.delete(f"{API}/cycles/{STATE['cycle_id']}", timeout=30)
        assert r.status_code == 400

    # ---- responses / analytics / export ----
    def test_70_responses_and_filters(self, admin_client):
        r = admin_client.get(f"{API}/responses", timeout=30)
        assert r.status_code == 200
        docs = r.json()
        assert any(d["id"] == STATE["submission_id"] for d in docs)
        assert all("_id" not in d for d in docs)

        f1 = admin_client.get(f"{API}/responses", params={"cycle_id": STATE["cycle_id"]}, timeout=30).json()
        assert all(d["cycle_id"] == STATE["cycle_id"] for d in f1)
        assert len(f1) >= 1

        scope = STATE["scope"]
        f2 = admin_client.get(f"{API}/responses", params={"program_id": scope["program_id"]}, timeout=30).json()
        assert any(d["id"] == STATE["submission_id"] for d in f2)
        f3 = admin_client.get(f"{API}/responses", params={"faculty_id": STATE["faculty_id"]}, timeout=30).json()
        assert any(d["id"] == STATE["submission_id"] for d in f3)
        f4 = admin_client.get(f"{API}/responses", params={"program_id": "bogus-id"}, timeout=30).json()
        assert f4 == []

    def test_71_analytics_summary(self, admin_client):
        r = admin_client.get(f"{API}/analytics/summary", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        t = d["totals"]
        for k in ["students", "faculty", "users", "responses", "avg_rating", "cycles_active", "completion", "pending"]:
            assert k in t
        assert t["responses"] >= 1
        assert t["cycles_active"] >= 1
        assert isinstance(d["faculty_ratings"], list)
        assert any(f["faculty_id"] == STATE["faculty_id"] for f in d["faculty_ratings"]), d["faculty_ratings"]
        assert isinstance(d["trend"], list) and len(d["trend"]) >= 1
        assert isinstance(d["dept_ratings"], list)

    def test_72_export_csv(self, admin_client):
        r = admin_client.get(f"{API}/export", params={"fmt": "csv"}, timeout=60)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "submitted_at" in r.text.splitlines()[0]

    def test_73_export_xlsx(self, admin_client):
        r = admin_client.get(f"{API}/export", params={"fmt": "xlsx"}, timeout=60)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")
        assert len(r.content) > 1000

    def test_74_export_requires_admin(self, anon_client):
        assert anon_client.get(f"{API}/export?fmt=csv", timeout=30).status_code == 401

    # ---- session edge cases ----
    def test_80_expired_session_rejected(self):
        suffix = uuid.uuid4().hex[:8]
        user_id = f"TEST_exp_{suffix}"
        token = f"TEST_sess_{suffix}"
        exp = iso(-1)
        mongosh(f"""
db.users.insertOne({{user_id:'{user_id}', email:'TEST_exp_{suffix}@klecba.edu.in', name:'TEST Expired', role:'student', created_at:'{exp}'}});
db.user_sessions.insertOne({{user_id:'{user_id}', session_token:'{token}', expires_at:'{exp}', created_at:'{exp}'}});
""")
        try:
            r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=30)
            assert r.status_code == 401
        finally:
            mongosh(f"db.users.deleteMany({{user_id:'{user_id}'}}); db.user_sessions.deleteMany({{user_id:'{user_id}'}});")

    def test_81_invalid_token_rejected(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer nope"}, timeout=30)
        assert r.status_code == 401

    # ---- cleanup ----
    def test_99_cleanup(self, admin_client):
        if STATE.get("assignment_id"):
            admin_client.delete(f"{API}/assignments/{STATE['assignment_id']}", timeout=30)
        if STATE.get("unpublished_template_id"):
            admin_client.delete(f"{API}/templates/{STATE['unpublished_template_id']}", timeout=30)
        mongosh("""
db.feedback_submissions.deleteMany({user_email:/^TEST_/});
db.feedback_cycles.deleteMany({name:/^TEST_/});
db.feedback_templates.deleteMany({name:/^TEST_/});
db.feedback_template_versions.deleteMany({name:/^TEST_/});
db.users.deleteMany({email:/^test_/i});
db.user_sessions.deleteMany({session_token:/^TEST_/});
db.departments.deleteMany({name:/^TEST_/});
db.programs.deleteMany({name:/^TEST_/});
db.subjects.deleteMany({name:/^TEST_/});
db.divisions.deleteMany({name:/^TEST_/});
db.semesters.deleteMany({name:/^TEST_/});
db.year_levels.deleteMany({name:/^TEST_/});
db.academic_years.deleteMany({name:/^TEST_/});
""")
        assert True
