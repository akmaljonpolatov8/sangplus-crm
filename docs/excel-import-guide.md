# SangPlus CRM Excel Import Guide

This guide defines how teacher, student, group, and timetable data should be prepared before importing into the system manually or through future backend bulk-import endpoints.

## Recommended Import Order

1. `managers`
2. `teachers`
3. `groups`
4. `students`
5. `student_group_links`

This order avoids missing references during data entry.

## Option 1: Single Excel File With Multiple Sheets

Recommended sheet names:

1. `teachers`
2. `groups`
3. `students`
4. `student_group_links`

## Sheet: `teachers`

Required columns:

- `username`
- `password`
- `full_name`

Optional columns:

- `is_active`

Rules:

- `username` should be unique
- use simple values like `teacher_diyora`
- `is_active` can be `true` or `false`

## Sheet: `groups`

Required columns:

- `name`
- `subject`
- `schedule_days`
- `start_time`
- `end_time`
- `monthly_fee`
- `teacher_username`

Optional columns:

- `is_active`

Rules:

- `schedule_days` should be comma-separated
- example: `Dushanba,Chorshanba,Juma`
- `teacher_username` must match an existing teacher
- timetable for MVP is already stored through:
  - `scheduleDays`
  - `startTime`
  - `endTime`

## Sheet: `students`

Required columns:

- `first_name`
- `last_name`
- `parent_phone`

Optional columns:

- `phone`
- `parent_name`
- `notes`
- `status`

Rules:

- `status` should be one of:
  - `ACTIVE`
  - `INACTIVE`
  - `GRADUATED`

## Sheet: `student_group_links`

Required columns:

- `student_phone_or_parent_phone`
- `group_name`

Optional columns:

- `joined_at`

Rules:

- easiest stable match key is `parent_phone`
- `group_name` must match an existing group

## Recommended Data Rules

- Phone numbers should use one format only
  - example: `998901112233`
- Teacher usernames should be lowercase
- Group names should be unique
- Avoid merged cells and styled rows in Excel
- Keep one header row only
- Do not leave blank rows inside data

## Suggested Manual Import Workflow

1. Add managers manually from the system
2. Add teachers from the `teachers` sheet
3. Add groups from the `groups` sheet
4. Add students from the `students` sheet
5. Link students to groups using `student_group_links`

## Backend Import Command

This repo now includes a backend-side CLI importer for generated CSV files.

Run:

```bash
npm run import:generated
```

Default input directory:

```text
docs/generated-import
```

What it does:

- reuses existing teachers when possible
- creates or updates groups
- creates or updates students
- creates missing student-group links
- prints warnings for unresolved rows

Recommended flow:

1. Generate CSV files from the Excel workbook
2. Run `npm run db:seed` if base users are needed
3. Run `npm run import:generated`
