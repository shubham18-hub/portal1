Testing Playbook

Auth-Gated App Testing Playbook

Step 1: Create Test User & Session
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  role: 'student',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"

Step 2: Test Backend
curl -X GET "$URL/api/auth/me" -H "Authorization: Bearer $TOKEN"

Step 3: Browser
Set cookie session_token via page.context.add_cookies with httpOnly:true, secure:true, sameSite:"None".

Roles: student, faculty, admin
Admin bootstrap email: runningmarathonjourney@gmail.com (auto-promoted to admin on first login)
