# SangPlus CRM

A CRM for managing teachers, students, groups, attendance, and payments.
Built with **Next.js 16 (App Router)**, **TypeScript**, **Prisma**, and **PostgreSQL**.

---

## Tech Stack

| Layer      | Technology              |
|------------|-------------------------|
| Framework  | Next.js 16 (App Router) |
| Language   | TypeScript              |
| Database   | PostgreSQL               |
| ORM        | Prisma                  |
| Auth       | JWT (bcryptjs + jsonwebtoken) |
| Validation | Zod                     |
| Styling    | Tailwind CSS            |

---

## Roles & Permissions

| Action                    | OWNER | MANAGER | TEACHER          |
|---------------------------|-------|---------|------------------|
| Manage teachers           | ✅    | ✅      | ❌               |
| Manage students           | ✅    | ✅      | ❌ (read own group) |
| Manage groups             | ✅    | ✅      | read own groups  |
| Start lesson session      | ✅    | ✅      | own groups only  |
| Mark attendance           | ✅    | ✅      | own groups only  |
| View / create payments    | ✅    | ✅ (no amount) | ❌        |
| View payment amounts      | ✅    | ❌      | ❌               |
| View overdue list         | ✅    | ✅ (no debt amount) | ❌     |

---

## Setup

### 1. Clone & install dependencies

```bash
git clone https://github.com/akmaljonpolatov8/sangplus-crm.git
cd sangplus-crm
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL` – your PostgreSQL connection string
- `JWT_SECRET` – a long random secret (e.g. `openssl rand -hex 32`)

### 3. Run database migrations

```bash
# Apply migrations (creates tables)
npm run db:migrate

# OR for production / CI environments
npm run db:migrate:deploy
```

### 4. Seed the database (optional)

Creates an initial `owner` user with password `owner123`.

```bash
npm run db:seed
```

> ⚠️ Change the owner password immediately after first login in production.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Overview

All API responses use a consistent shape:

```json
// Success
{ "data": ... }

// Error
{ "error": { "message": "...", "code": "..." } }
```

### Authentication

All `/api/*` routes (except `/api/auth/login`) require:
```
Authorization: Bearer <jwt_token>
```

**POST /api/auth/login**
```json
// Request
{ "username": "owner", "password": "owner123" }

// Response
{ "data": { "token": "...", "user": { "id": "...", "username": "...", "role": "OWNER" } } }
```

### Endpoints

| Method | Path                          | Description                     |
|--------|-------------------------------|---------------------------------|
| POST   | `/api/auth/login`             | Login – returns JWT             |
| GET    | `/api/students`               | List students                   |
| POST   | `/api/students`               | Create student                  |
| GET    | `/api/students/[id]`          | Get student detail              |
| PATCH  | `/api/students/[id]`          | Update student                  |
| GET    | `/api/teachers`               | List teachers                   |
| POST   | `/api/teachers`               | Create teacher + user account   |
| GET    | `/api/teachers/[id]`          | Get teacher detail              |
| PATCH  | `/api/teachers/[id]`          | Update teacher                  |
| GET    | `/api/groups`                 | List groups                     |
| POST   | `/api/groups`                 | Create group                    |
| GET    | `/api/groups/[id]`            | Get group detail                |
| PATCH  | `/api/groups/[id]`            | Update group                    |
| POST   | `/api/groups/[id]/students`   | Add students to group           |
| POST   | `/api/sessions/start`         | Start a lesson session          |
| POST   | `/api/attendance/mark`        | Mark student attendance         |
| GET    | `/api/payments`               | List payments (amount masked for non-OWNER) |
| POST   | `/api/payments`               | Record a payment                |
| GET    | `/api/overdue`                | List students with overdue months |

---

## Project Structure

```
app/
  api/
    auth/login/route.ts     # POST login
    students/
      route.ts              # GET list, POST create
      [id]/route.ts         # GET, PATCH
    teachers/
      route.ts
      [id]/route.ts
    groups/
      route.ts
      [id]/route.ts
      [id]/students/route.ts  # POST add students
    sessions/start/route.ts   # POST start session
    attendance/mark/route.ts  # POST mark attendance
    payments/route.ts         # GET list, POST create
    overdue/route.ts          # GET overdue list
  (dashboard)/              # UI pages (frontend – protected by middleware)
  (auth)/                   # Login page
src/
  lib/
    prisma.ts               # Prisma client singleton
    auth.ts                 # JWT + password helpers
    rbac.ts                 # Role-based access control helpers
prisma/
  schema.prisma             # Database schema
  seed.ts                   # Seed script
middleware.ts               # Route protection
```

---

## Available Scripts

```bash
npm run dev               # Start dev server
npm run build             # Production build
npm run lint              # Lint code
npm run db:generate       # Regenerate Prisma client
npm run db:migrate        # Run migrations (dev)
npm run db:migrate:deploy # Run migrations (production)
npm run db:push           # Push schema without migration
npm run db:studio         # Open Prisma Studio
npm run db:seed           # Seed initial data
```
