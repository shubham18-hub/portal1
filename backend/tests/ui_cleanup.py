"""Removes all UI/API test artifacts created during iteration 1 testing."""
import sys
sys.path.insert(0, "/app/backend/tests")
from conftest import mongosh

print(mongosh("""
var cyc = db.feedback_cycles.find({name:/^(UI_|UITest)/}).toArray().map(c=>c.id);
db.feedback_submissions.deleteMany({cycle_id:{$in:cyc}});
db.feedback_drafts.deleteMany({cycle_id:{$in:cyc}});
db.feedback_cycles.deleteMany({name:/^(UI_|UITest)/});
db.feedback_template_versions.deleteMany({name:/^(UI_|UITest)/});
db.feedback_templates.deleteMany({name:/^(UI_|UITest|New Template)/});
var fac = db.users.find({email:/^(uitest|ui\\.prof|ui\\.fac)/i}).toArray().map(u=>u.user_id);
db.faculty_assignments.deleteMany({faculty_id:{$in:fac}});
db.student_profiles.deleteMany({user_id:/^uitest_/});
db.user_sessions.deleteMany({session_token:/^uitest_/});
db.users.deleteMany({email:/^(uitest|ui\\.prof|ui\\.fac|test_)/i});
db.departments.deleteMany({name:/^UI_/});
db.programs.deleteMany({name:/^UI_/});
db.subjects.deleteMany({name:/^UI_/});
db.divisions.deleteMany({name:/^UI_/});
db.semesters.deleteMany({name:/^UI_/});
db.year_levels.deleteMany({name:/^UI_/});
db.academic_years.deleteMany({name:/^UI_/});
print('cycles='+db.feedback_cycles.countDocuments({})+' templates='+db.feedback_templates.countDocuments({})+' subs='+db.feedback_submissions.countDocuments({})+' assignments='+db.faculty_assignments.countDocuments({})+' users='+db.users.countDocuments({}));
"""))
