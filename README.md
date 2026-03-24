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
npm run typecheck
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
npm run typecheck
```

## Manual Testing

- API contract: [api-contract.md](/c:/Users/Akmaljon/sangplus-crm/docs/api-contract.md)
- Manual requests: [manual-test.http](/c:/Users/Akmaljon/sangplus-crm/docs/manual-test.http)

## Excel Preparation

- Import guide: [excel-import-guide.md](/c:/Users/Akmaljon/sangplus-crm/docs/excel-import-guide.md)
- Teacher template: [teachers.csv](/c:/Users/Akmaljon/sangplus-crm/docs/templates/teachers.csv)
- Group template: [groups.csv](/c:/Users/Akmaljon/sangplus-crm/docs/templates/groups.csv)
- Student template: [students.csv](/c:/Users/Akmaljon/sangplus-crm/docs/templates/students.csv)
- Student-group link template: [student_group_links.csv](/c:/Users/Akmaljon/sangplus-crm/docs/templates/student_group_links.csv)
