# Quick Deployment Checklist

## Pre-Deployment Requirements

### 1. Google Cloud Console Setup
- [ ] Go to https://console.cloud.google.com/apis/credentials
- [ ] Create OAuth 2.0 Client ID (Web application)
- [ ] Add authorized JavaScript origins:
  - `https://your-frontend.onrender.com`
  - `http://localhost:3000` (for local testing)
- [ ] Add authorized redirect URIs:
  - `https://your-backend.onrender.com/api/auth/google/callback`
  - `http://localhost:8000/api/auth/google/callback` (for local testing)
- [ ] Copy Client ID and Client Secret

### 2. MongoDB Setup
- [ ] Create MongoDB Atlas cluster (free tier)
- [ ] Create database user
- [ ] Whitelist all IPs (0.0.0.0/0) for Render
- [ ] Get connection string

### 3. Render Setup

#### Backend Web Service
- [ ] Create new Web Service
- [ ] Connect GitHub repository
- [ ] Environment: Docker
- [ ] Dockerfile path: `./Dockerfile.backend`
- [ ] Set environment variables:
  ```
  MONGO_URL=mongodb+srv://...
  DB_NAME=klecba
  CORS_ORIGINS=https://your-frontend.onrender.com
  ALLOWED_EMAIL_DOMAINS=klecba.edu.in,kle.ac.in,klecba.edu
  ADMIN_EMAIL=admin@klecba.edu.in
  ADMIN_PASSWORD_HASH=$2b$12$...
  GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=your-client-secret
  FRONTEND_URL=https://your-frontend.onrender.com
  ```

#### Frontend Static Site
- [ ] Create new Static Site
- [ ] Connect GitHub repository
- [ ] Root directory: `frontend`
- [ ] Build command: `npm install && npm run build`
- [ ] Publish directory: `build`
- [ ] Set environment variables:
  ```
  REACT_APP_BACKEND_URL=https://your-backend.onrender.com
  ```

### 4. Verify Deployment

#### Backend Health Check
```bash
curl https://your-backend.onrender.com/api/auth/google/status
```
Expected response:
```json
{
  "configured": true,
  "client_id_set": true,
  "client_secret_set": true,
  "frontend_url": "https://your-frontend.onrender.com"
}
```

#### Frontend Login Test
1. Visit `https://your-frontend.onrender.com/login`
2. Click "Continue with Google"
3. Should redirect to Google OAuth
4. After authorization, should redirect back and log in

### 5. Common Issues & Fixes

**404 on OAuth callback:**
- Check `FRONTEND_URL` environment variable in backend
- Verify redirect URIs in Google Cloud Console
- Check that backend URL matches exactly

**CORS errors:**
- Verify `CORS_ORIGINS` includes frontend URL
- Check for trailing slashes (remove them)

**"Google OAuth not configured" error:**
- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in backend
- Restart backend service after adding variables

**Session not persisting:**
- Check cookies are being set (browser dev tools)
- Verify `FRONTEND_URL` matches exactly
- Check `sameSite` cookie settings

## Local Testing

### Backend (from project root)
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
# Set environment variables in .env file
uvicorn server:app --reload --port 8000
```

### Frontend (from project root)
```bash
cd frontend
npm install
npm start
```

### Test OAuth locally
1. Backend: http://localhost:8000/api/auth/google/status
2. Frontend: http://localhost:3000/login
3. Google OAuth redirect URI: http://localhost:8000/api/auth/google/callback

## Environment Variables Summary

### Backend (Required)
| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URL` | MongoDB connection string | `mongodb+srv://...` |
| `DB_NAME` | Database name | `klecba` |
| `CORS_ORIGINS` | Frontend URL | `https://app.onrender.com` |
| `ALLOWED_EMAIL_DOMAINS` | Allowed domains | `klecba.edu.in` |
| `ADMIN_EMAIL` | Admin email | `admin@klecba.edu.in` |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash | `$2b$12$...` |
| `GOOGLE_CLIENT_ID` | OAuth Client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret | `GOCSPX-...` |
| `FRONTEND_URL` | Frontend URL | `https://app.onrender.com` |

### Frontend (Required)
| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Backend URL | `https://api.onrender.com` |
