# KLECBA Feedback Portal — PRD

## Original problem
KLECBA (KLE College of Business Administration, Hubli) — premium, Apple-inspired feedback portal.

## User personas
- **Student** — Google-authenticated via college domain. Sees only their assigned cycle. Cannot self-assign profile.
- **Faculty** — Google-authenticated via college domain. Managed and promoted by admin.
- **Admin/Principal** — Password login at /admin/login. Full control.

## Architecture (implemented)
- FastAPI backend at :8001, MongoDB (test_database).
- React frontend at :3000. Preview at REACT_APP_BACKEND_URL.
- Auth: cookie `session_token` (httpOnly, secure, sameSite=None, 7 days).
- Google OAuth: Emergent-managed; enforced ALLOWED_EMAIL_DOMAINS.
- Admin: bcrypt (ADMIN_PASSWORD_HASH env). Admin cannot log in through Google.

## Data model
users · user_sessions · departments · programs · academic_years · year_levels · semesters · divisions · subjects · faculty_assignments · student_profiles · feedback_templates · feedback_template_versions (immutable snapshots) · feedback_cycles · feedback_drafts · feedback_submissions (immutable, embeds template + faculty snapshot) · events

## What's implemented (2026-02)
- Public login page shows only "Continue with Google" — no dev/preview inputs.
- Admin login at /admin/login (password, bcrypt).
- Backend enforcement: college domain, admin-only endpoints, RBAC.
- Full academic structure CRUD with referential-integrity guards.
- Faculty & assignments (with duplicate-scope 409 guard).
- Student profiles (admin-assigned only).
- Feedback templates with question builder (add/reorder/delete/duplicate, rating + long-text), preview modal, publish → immutable version snapshot.
- Feedback cycles (template_version-based, academic scope, dates, status).
- Student multi-faculty wizard with autosaved drafts (~700ms debounce), Back/Next, Review step, Submit (server-side required validation, one-submission guard).
- Admin: Sidebar-based console with Dashboard, Academic Structure, Faculty & Assignments, Students, Feedback Templates, Feedback Cycles, Responses (filters, CSV/Excel export), Events, Analytics.
- Analytics: totals, faculty ratings (rating-type questions only), department pie, monthly trend, chart empty states.
- Export CSV/Excel — anonymous by default; add `?include_pii=true` for respondent email.
- Events module preserved from Phase 1.

## Backlog / next
- P1: Split server.py into routers (auth, structure, people, templates, cycles, student, analytics).
- P1: Add Pydantic request models to structure endpoints.
- P1: Show Student ID in students table.
- P1: Styled confirm dialog (replace native `confirm`).
- P2: Faculty-facing dashboard (anonymous feedback view of their own results).
- P2: Question-level drill-down analytics.
- P2: Preview date picker via shadcn Calendar instead of native.
- P2: Bulk-import students via CSV.
- P2: In-app notification when a cycle opens.

## Environment
- Backend .env: MONGO_URL, DB_NAME, CORS_ORIGINS, ALLOWED_EMAIL_DOMAINS, ADMIN_EMAIL, ADMIN_PASSWORD_HASH
- Rotate admin password: `python -c "import bcrypt; print(bcrypt.hashpw(b'NEWPASSWORD', bcrypt.gensalt()).decode())"` → set ADMIN_PASSWORD_HASH.
