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
SMS_PROVIDER="generic"
SMS_API_URL="https://your-sms-provider/send"
SMS_API_KEY="your-provider-api-key"
SMS_SENDER="SangPlus"

# Twilio only (if SMS_PROVIDER=twilio)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_FROM=""
```

If `SMS_API_URL` and `SMS_API_KEY` are not provided, reminder endpoint works in mock mode (logs only).

Supported providers: `twilio`, `eskiz`, `playmobile`, `generic`.
Detailed setup: [docs/sms-integration.md](docs/sms-integration.md)

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

- API contract: [docs/api-contract.md](docs/api-contract.md)
- Manual requests: [docs/manual-test.http](docs/manual-test.http)

## Excel Preparation

- Import guide: [docs/excel-import-guide.md](docs/excel-import-guide.md)
- Teacher template: [docs/templates/teachers.csv](docs/templates/teachers.csv)
- Group template: [docs/templates/groups.csv](docs/templates/groups.csv)
- Student template: [docs/templates/students.csv](docs/templates/students.csv)
- Student-group link template: [docs/templates/student_group_links.csv](docs/templates/student_group_links.csv)
