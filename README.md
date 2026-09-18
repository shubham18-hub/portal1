# Launchpad Portal

Production task portal for student cohorts: admin-managed tasks, student login, PDF submissions, and grading.

## Local setup

1. Copy `.env.example` to `.env` and fill in its values.
2. Run `npm install`, `npm run db:migrate`, `npm run db:seed`, then `npm start`.
3. Open `http://localhost:10000`.

## Render deployment

Push this repository to GitHub, then create a Render **Blueprint** from `render.yaml`. Set `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH` in Render’s environment settings. The blueprint provisions a web service, Render Postgres database, and persistent PDF disk.

Generate a bcrypt hash with:

```bash
node -e "import('bcryptjs').then(({default:b})=>console.log(b.hashSync('your-password',12)))"
```

The persistent disk supports one web instance. Move uploads to Cloudflare R2 before horizontal scaling.
