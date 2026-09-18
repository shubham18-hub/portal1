# Render Environment Variables Setup Guide

**Issue:** Backend OAuth endpoint returns `"configured": false` because Google OAuth credentials are missing.

---

## 🚨 **Current Status**

Testing: `https://klecba-backend.onrender.com/api/auth/google/status`

**Current Response:**
```json
{
  "configured": false,
  "client_id_set": false,
  "client_secret_set": false,
  "frontend_url": "https://klecba-frontend.onrender.com"
}
```

**Required Response:**
```json
{
  "configured": true,
  "client_id_set": true,
  "client_secret_set": true,
  "frontend_url": "https://klecba-frontend.onrender.com"
}
```

---

## 📋 **Step-by-Step: Add Environment Variables**

### **Step 1: Open Render Dashboard**
1. Go to: https://dashboard.render.com
2. Sign in to your account

### **Step 2: Select Backend Service**
1. Click on **"klecba-backend"** service in your dashboard
2. You should see the service overview page

### **Step 3: Navigate to Environment Tab**
1. Look for tabs near the top: "Overview", "Events", "Logs", "Shell", **"Environment"**, etc.
2. Click on **"Environment"** tab

### **Step 4: Check Existing Variables**
You should already have these variables (don't change them):
- `MONGO_URL`
- `DB_NAME`
- `CORS_ORIGINS`
- `ALLOWED_EMAIL_DOMAINS`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`

### **Step 5: Add Missing Variables**

Look for the **"Add Environment Variable"** button (usually at the bottom or top of the list).

Click it **THREE TIMES** to add these three variables:

#### **Variable 1: GOOGLE_CLIENT_ID**
```
Key:   GOOGLE_CLIENT_ID
Value: 768641231680-vit4brsqlcq20j8kvkaog606oq4n1tqq.apps.googleusercontent.com
```

#### **Variable 2: GOOGLE_CLIENT_SECRET**
```
Key:   GOOGLE_CLIENT_SECRET
Value: set this privately in Render; never commit it
```

#### **Variable 3: FRONTEND_URL**
```
Key:   FRONTEND_URL
Value: https://klecba-frontend.onrender.com
```

### **Step 6: Save Changes**
1. Scroll to the bottom of the Environment page
2. Click **"Save Changes"** button
3. Render will show a notification: "Service will be redeployed with new environment variables"

### **Step 7: Wait for Redeployment**
1. Click on **"Events"** tab
2. You'll see a new deployment starting
3. Wait for status to show **"Deploy succeeded"** (usually 2-5 minutes)
4. Watch the logs to ensure no errors

---

## ✅ **Verification**

After redeployment completes:

### **Test 1: OAuth Status**
Open this URL in your browser:
```
https://klecba-backend.onrender.com/api/auth/google/status
```

**Expected Response:**
```json
{
  "configured": true,
  "client_id_set": true,
  "client_secret_set": true,
  "frontend_url": "https://klecba-frontend.onrender.com"
}
```

✅ All values should be `true`

### **Test 2: OAuth URL Generation**
Open this URL in your browser:
```
https://klecba-backend.onrender.com/api/auth/google/url
```

**Expected Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=768641231680-vit4brsqlcq20j8kvkaog606oq4n1tqq.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fklecba-frontend.onrender.com%2Fauth%2Fcallback&response_type=code&scope=openid+email+profile&access_type=offline&prompt=consent&state=SOME_RANDOM_STATE",
  "state": "SOME_RANDOM_STATE"
}
```

✅ URL should start with `https://accounts.google.com/o/oauth2/v2/auth`

### **Test 3: Login Flow**
1. Go to: `https://klecba-frontend.onrender.com`
2. Click **"Continue with Google"** button
3. **Expected:** Redirects to `https://accounts.google.com/o/oauth2/v2/auth...`
4. **Not Expected:** Redirects to `auth.emergentagent.com`
5. **Not Expected:** Shows `login?error=deprecated`

### **Test 4: Complete Authentication**
1. After redirecting to Google, sign in with college account
2. **Expected:** Returns to `https://klecba-frontend.onrender.com/auth/success`
3. **Expected:** User is logged in
4. **Expected:** Dashboard loads with user data

---

## 🔍 **Troubleshooting**

### **Issue: Variables don't appear after adding**
- Make sure you clicked **"Save Changes"** at the bottom
- Check the **"Events"** tab to see if deployment started
- If no deployment started, try clicking **"Manual Deploy"** → **"Deploy latest commit"**

### **Issue: Still showing `"configured": false` after deployment**
- Go back to **"Environment"** tab
- Verify the three variables are listed with correct keys (no typos)
- Check that values are pasted completely (no extra spaces)
- Click **"Manual Deploy"** to force redeploy

### **Issue: Deployment failed**
- Check **"Logs"** tab for error messages
- Common issues:
  - MongoDB connection string invalid
  - Dependency installation failure
  - Port already in use (Render should handle this)

### **Issue: OAuth still not working after all variables set**
1. Clear browser cache completely
2. Test `/api/auth/google/status` directly
3. Check browser Network tab for API call errors
4. Verify Google Cloud Console redirect URIs are correct

---

## 📸 **Visual Reference**

When you're in the Render Environment tab, you should see something like:

```
Environment Variables

[Add Environment Variable] button

Existing variables:
┌─────────────────────────┬──────────────────────────────────────┐
│ Key                     │ Value                                │
├─────────────────────────┼──────────────────────────────────────┤
│ MONGO_URL              │ mongodb+srv://...                    │
│ DB_NAME                │ klecba                               │
│ CORS_ORIGINS           │ *                                    │
│ ALLOWED_EMAIL_DOMAINS  │ klecba.edu.in,kle.ac.in,klecba.edu  │
│ ADMIN_EMAIL            │ admin@klecba.edu.in                 │
│ ADMIN_PASSWORD_HASH    │ $2b$12$...                          │
└─────────────────────────┴──────────────────────────────────────┘

ADD THESE THREE:
┌─────────────────────────┬──────────────────────────────────────┐
│ GOOGLE_CLIENT_ID       │ 768641231680-vit4brsqlcq20j8k...     │
│ GOOGLE_CLIENT_SECRET   │ set privately in Render              │
│ FRONTEND_URL           │ https://klecba-frontend.onrender.com │
└─────────────────────────┴──────────────────────────────────────┘

[Save Changes] button
```

---

## 🎯 **Success Checklist**

After completing all steps, verify:

- [ ] Opened Render Dashboard
- [ ] Selected klecba-backend service
- [ ] Clicked Environment tab
- [ ] Added `GOOGLE_CLIENT_ID` variable
- [ ] Added `GOOGLE_CLIENT_SECRET` variable
- [ ] Added `FRONTEND_URL` variable
- [ ] Clicked "Save Changes"
- [ ] Watched deployment complete in Events tab
- [ ] Tested `/api/auth/google/status` shows all `true`
- [ ] Tested `/api/auth/google/url` returns Google URL
- [ ] Tested login flow redirects to Google
- [ ] Successfully authenticated and logged in
- [ ] No more `error=deprecated` messages

---

## 📞 **Need Help?**

If you're stuck:
1. Take a screenshot of your Render Environment tab
2. Share the output of `/api/auth/google/status`
3. Check the Logs tab for error messages
4. Verify you're looking at the **backend** service (not frontend)

---

**Last Updated:** September 16, 2026  
**Next Step:** Add the three environment variables in Render Dashboard
