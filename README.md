# SangPlus CRM Backend MVP

Backend for a learning center CRM built with Next.js App Router, TypeScript, Prisma, and PostgreSQL.

## What Is Ready

- Prisma schema
- Prisma client setup
- Auth with username + password
- Bootstrap route for first `OWNER`
- Role-based access for `OWNER`, `MANAGER`, `TEACHER`
- API routes for students, teachers, groups, lessons, attendance, and payments
- Overdue payment detection and reminder text logic

## Environment

Create `.env` from `.env.example`.

```bash
cp .env.example .env
```

Required variables:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sangplus_crm?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
```

## Setup

```bash
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

## Demo Users

These users are created by the seed script:

- `owner_sangplus` / `Owner123`
- `manager_sangplus` / `Manager123`
- `teacher_diyora` / `Teacher123`

## Useful Commands

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run lint
```
