# Render Deployment Guide for KLECBA Feedback Portal

This guide walks you through deploying the KLECBA Feedback Portal to Render.

## Quick Start (Blueprint)

The fastest way to deploy is using the included `render.yaml` blueprint:

1. Push code to GitHub/GitLab
2. In Render Dashboard, click **Blueprints** → **New Blueprint Instance**
3. Connect your repository
4. Render will read `render.yaml` and create services
5. Set required environment variables (see below)

**Required Environment Variables** (set these in Render Dashboard):
- `MONGO_URL` - MongoDB connection string
- `ADMIN_EMAIL` - Admin email address
- `ADMIN_PASSWORD_HASH` - Bcrypt hash of admin password (generate using script below)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `FRONTEND_URL` - Your frontend URL (e.g., https://klecba-frontend.onrender.com)

## Prerequisites

1. A [Render](https://render.com) account
2. A MongoDB database (Render offers free MongoDB, or use MongoDB Atlas)
3. Google OAuth credentials configured (see Google OAuth Setup section below)

## Architecture

The application consists of:
- **Backend**: FastAPI application running on a Docker container
- **Frontend**: React static site served by Render
- **Database**: MongoDB

## Step-by-Step Deployment

### 1. Push Code to GitHub/GitLab

Ensure your code is in a Git repository connected to Render.

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Create MongoDB Database

**Option A: Render MongoDB (Recommended for simplicity)**

1. In Render Dashboard, click **New** → **PostgreSQL** (or MongoDB if available)
2. Note the internal connection string

**Option B: MongoDB Atlas (Free tier available)**

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a database user
3. Whitelist all IPs (0.0.0.0/0) for Render
4. Get the connection string

### 3. Deploy Backend Service

1. In Render Dashboard, click **New** → **Web Service**
2. Connect your repository
3. Configure:
   - **Name**: `klecba-backend`
   - **Environment**: Docker
   - **Dockerfile Path**: `./Dockerfile.backend`
   - **Docker Context**: `.`

4. Add environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URL` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net` |
| `DB_NAME` | Database name | `klecba_feedback` |
| `CORS_ORIGINS` | Frontend URL | `https://klecba-frontend.onrender.com` |
| `ALLOWED_EMAIL_DOMAINS` | Allowed email domains | `klecba.edu.in,kle.ac.in` |
| `ADMIN_EMAIL` | Admin email | `admin@klecba.edu.in` |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash of admin password | `$2b$12$...` |

5. Click **Deploy**

### 4. Deploy Frontend Service

1. In Render Dashboard, click **New** → **Static Site**
2. Connect your repository
3. Configure:
   - **Name**: `klecba-frontend`
   - **Build Command**: `cd frontend && yarn install && yarn build`
   - **Publish Directory**: `frontend/build`

4. Add environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Backend URL | `https://klecba-backend.onrender.com` |
| `768641231680-99l5v2ie3s749qudcb6fq073vdjikiej.apps.googleusercontent.com` | Google OAuth Client ID | `your-client-id.apps.googleusercontent.com` |

5. Click **Deploy**

### 5. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Create an OAuth 2.0 Client ID (if you don't have one)
4. Add authorized JavaScript origins:
   - `https://klecba-frontend.onrender.com`
   - `http://localhost:3000` (for local development)
5. Add authorized redirect URIs:
   - `https://klecba-backend.onrender.com/api/auth/google/callback`
   - `http://localhost:8000/api/auth/google/callback` (for local development)
6. Copy the **Client ID** and **Client Secret**

**Important**: Set these environment variables in Render:
- Backend: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`
- Frontend: `REACT_APP_BACKEND_URL`

### 6. Generate Admin Password Hash

Run this Python command to generate a bcrypt hash for your admin password:

**Using the included script:**
```bash
python scripts/generate_admin_hash.py
```

**Or manually:**
```python
import bcrypt
password = b"your_secure_password"
hashed = bcrypt.hashpw(password, bcrypt.gensalt())
print(hashed.decode())
```

Update the `ADMIN_PASSWORD_HASH` environment variable in Render.

## Using render.yaml (Blueprint Deployment)

Render supports Blueprint deployments via `render.yaml`:

1. Push the included `render.yaml` to your repository
2. In Render Dashboard, click **New** → **Blueprint**
3. Connect your repository
4. Render will create all services defined in the blueprint

**Important**: Update the environment variables in `render.yaml` before deploying:
- Replace placeholder URLs with your actual service URLs
- Set sensitive values (passwords, secrets) using Render's secret management

## Environment Variables Reference

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `ALLOWED_EMAIL_DOMAINS` | No | Comma-separated email domains |
| `ADMIN_EMAIL` | Yes | Admin user email |
| `ADMIN_PASSWORD_HASH` | Yes | Bcrypt hash of admin password |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth Client Secret |
| `FRONTEND_URL` | Yes | Frontend URL for OAuth callbacks |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_BACKEND_URL` | Yes | Backend API URL |
| `REACT_APP_GOOGLE_CLIENT_ID` | No | Google OAuth Client ID (optional, for reference) |

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the Google+ API (if not already enabled)

### Step 2: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type
3. Fill in required fields:
   - App name: `KLECBA Feedback Portal`
   - Support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Add test users (if in testing mode)
6. Publish the app (for production)

### Step 3: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Add authorized JavaScript origins:
   - Production: `https://klecba-frontend.onrender.com`
   - Local development: `http://localhost:3000`
5. Add authorized redirect URIs:
   - Production: `https://klecba-backend.onrender.com/api/auth/google/callback`
   - Local development: `http://localhost:8000/api/auth/google/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### Step 4: Configure Environment Variables

**In Render Dashboard (Backend):**
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
FRONTEND_URL=https://klecba-frontend.onrender.com
```

**In Render Dashboard (Frontend):**
```
REACT_APP_BACKEND_URL=https://klecba-backend.onrender.com
```

### Step 5: Verify OAuth Configuration

Test the OAuth configuration by visiting:
```
https://klecba-backend.onrender.com/api/auth/google/status
```

You should see:
```json
{
  "configured": true,
  "client_id_set": true,
  "client_secret_set": true,
  "frontend_url": "https://klecba-frontend.onrender.com"
}
```

## Troubleshooting

### Backend Health Check Failing

- Verify MongoDB connection string
- Check that database user has correct permissions
- Ensure IP whitelist includes Render's IPs (or 0.0.0.0/0)

### CORS Errors

- Verify `CORS_ORIGINS` includes your frontend URL
- Ensure URLs don't have trailing slashes
- Check browser console for specific error messages

### Google OAuth Not Working

- Verify redirect URIs in Google Cloud Console match exactly:
  - Must include `/api/auth/google/callback` suffix
  - No trailing slashes
  - Both frontend and backend URLs must be in JavaScript origins
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in backend
- Verify `FRONTEND_URL` is set correctly in backend
- Check backend logs for OAuth errors
- Test configuration: `GET /api/auth/google/status`
- Ensure OAuth consent screen is published (or you're a test user)
- Check that requested scopes (`email`, `profile`) are authorized

### Frontend Shows 404 on Refresh

- Verify `_redirects` file exists in `frontend/public/`
- For Render static sites, SPA routing is handled automatically

## Monitoring and Logs

- View logs in Render Dashboard under your service
- Set up alerts for service health
- Monitor database connections in MongoDB dashboard

## Scaling

The free tier on Render has limitations:
- Services spin down after inactivity
- Limited bandwidth and compute

To scale:
1. Upgrade to paid plans
2. Consider adding caching (Redis)
3. Optimize database queries

## Security Best Practices

1. Use strong, unique passwords for admin account
2. Enable Render's DDoS protection
3. Keep dependencies updated
4. Review and rotate secrets periodically
5. Use environment-specific OAuth credentials

## Support

For issues specific to:
- **Render**: Check [Render Documentation](https://render.com/docs)
- **MongoDB**: Check [MongoDB Documentation](https://docs.mongodb.com)
- **Application**: Review logs and open an issue in your repository
