# Vercel + Prisma + Neon Setup

Use this setup for production on Vercel.

## 1) Environment Variables in Vercel

Add these variables in Vercel Dashboard -> Project -> Settings -> Environment Variables:

- DATABASE_URL
- DIRECT_URL
- AUTH_SECRET

Set them for `Production` (and optionally Preview/Development if needed).

## 2) Correct Neon Connection String Format

### DATABASE_URL (pooled, for app runtime)

Use Neon pooled connection (connection pooling ON, usually port 6432):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6432/DB_NAME?sslmode=require"
```

### DIRECT_URL (non-pooled, for migrations)

Use Neon direct connection (usually port 5432):

```env
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=require"
```

### AUTH_SECRET

Use a long random secret:

```env
AUTH_SECRET="replace-with-a-long-random-secret"
```

PowerShell example to generate one:

```powershell
[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
```

## 3) Deploy

Push code, then deploy on Vercel.

Build command is already configured in `package.json`:

```json
"build": "prisma generate && next build"
```

## 4) Run migrations after first deploy

Run this from your local terminal once (using production DIRECT_URL):

```powershell
$env:DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=require"; npx prisma migrate deploy
```

If needed, run seed as well:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:6432/DB_NAME?sslmode=require"; npx prisma db seed
```

## 5) Quick Checklist

- `DATABASE_URL` uses pooled URL and ends with `?sslmode=require`
- `DIRECT_URL` uses direct URL and ends with `?sslmode=require`
- `AUTH_SECRET` exists in Vercel
- Redeploy after changing environment variables
- Check Vercel Function logs for `/api/auth/login` on errors
