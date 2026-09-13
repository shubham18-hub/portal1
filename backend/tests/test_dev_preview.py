"""Tests for the new /api/auth/dev-preview testing-preview endpoint + auth regressions."""
import pytest
import requests

from conftest import API


def preview_session(role):
    s = requests.Session()
    r = s.post(f"{API}/auth/dev-preview", json={"role": role}, timeout=30)
    return s, r


# ---------------- dev-preview endpoint ----------------
class TestDevPreview:
    @pytest.mark.parametrize("role,email", [
        ("student", "preview.student@klecba.edu.in"),
        ("faculty", "preview.faculty@klecba.edu.in"),
        ("admin", "preview.admin@klecba.edu.in"),
    ])
    def test_preview_role_login(self, role, email):
        s, r = preview_session(role)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "user" in body
        u = body["user"]
        assert u["role"] == role
        assert u["email"] == email
        assert isinstance(u.get("user_id"), str) and u["user_id"]
        assert "_id" not in u
        # cookie set
        assert "session_token" in s.cookies.get_dict(), s.cookies.get_dict()
        # session works
        me = s.get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200, me.text
        me_user = me.json()["user"]
        assert me_user["role"] == role
        assert me_user["email"] == email

    def test_invalid_role_rejected(self):
        r = requests.post(f"{API}/auth/dev-preview", json={"role": "hacker"}, timeout=30)
        assert r.status_code == 400, r.text
        assert "role must be student|faculty|admin" in r.text

    def test_missing_role_rejected(self):
        r = requests.post(f"{API}/auth/dev-preview", json={}, timeout=30)
        assert r.status_code == 400, r.text

    def test_accounts_are_stable_across_calls(self):
        s1, r1 = preview_session("student")
        s2, r2 = preview_session("student")
        assert r1.status_code == r2.status_code == 200
        assert r1.json()["user"]["user_id"] == r2.json()["user"]["user_id"]


# ---------------- RBAC of preview sessions ----------------
class TestPreviewRBAC:
    def test_admin_preview_can_access_analytics(self, seeded):
        s, r = preview_session("admin")
        assert r.status_code == 200
        a = s.get(f"{API}/analytics/summary", timeout=30)
        assert a.status_code == 200, a.text
        assert isinstance(a.json(), dict)

    def test_faculty_preview_insights_and_403(self):
        s, r = preview_session("faculty")
        assert r.status_code == 200
        ins = s.get(f"{API}/faculty/me/insights", timeout=30)
        assert ins.status_code == 200, ins.text
        blocked = s.get(f"{API}/analytics/summary", timeout=30)
        assert blocked.status_code == 403, blocked.status_code

    def test_student_preview_cycles_and_403(self, seeded):
        s, r = preview_session("student")
        assert r.status_code == 200
        cy = s.get(f"{API}/my/cycles", timeout=30)
        assert cy.status_code == 200, cy.text
        assert isinstance(cy.json(), list)
        blocked = s.get(f"{API}/analytics/summary", timeout=30)
        assert blocked.status_code == 403, blocked.status_code

    def test_student_preview_has_profile(self, seeded):
        s, r = preview_session("student")
        assert r.status_code == 200
        me = s.get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200, me.text
        data = me.json().get("profile")
        assert data, "student preview has no student_profile — dashboard shows 'no profile' banner"
        assert data.get("program_id") and data.get("division_id") and data.get("semester_id"), data


# ---------------- regressions ----------------
class TestAuthRegressions:
    def test_admin_password_login_still_works(self, test_credentials):
        s = requests.Session()
        r = s.post(f"{API}/auth/admin-login", json=test_credentials, timeout=30)
        assert r.status_code == 200, r.text
        assert "session_token" in s.cookies.get_dict()
        me = s.get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200 and me.json()["user"]["role"] == "admin"

    def test_admin_login_bad_password(self, test_credentials):
        r = requests.post(f"{API}/auth/admin-login",
                          json={"email": test_credentials["email"], "password": "wrong"}, timeout=30)
        assert r.status_code in (400, 401, 403), r.status_code

    def test_seed_endpoint_works(self, admin_client):
        r = admin_client.post(f"{API}/seed", timeout=90)
        assert r.status_code == 200, r.text

    def test_unauthenticated_me_is_401(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401, r.status_code
