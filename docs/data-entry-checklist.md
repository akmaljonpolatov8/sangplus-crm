# SangPlus CRM Data Entry Checklist

Use this order to prepare the system for real usage. After these steps, daily work can continue through the existing backend APIs.

## 1. Create the first owner

- Use `POST /api/setup/bootstrap-owner`
- This is only for the first system setup

## 2. Create managers

- Use `POST /api/managers`
- Create the people who will maintain groups, students, and teacher details

## 3. Create teachers

- Use `POST /api/teachers`
- Add:
  - `username`
  - `password`
  - `fullName`

## 4. Create groups with timetable data

- Use `POST /api/groups`
- Each group should include:
  - `name`
  - `subject`
  - `scheduleDays`
  - `startTime`
  - `endTime`
  - `teacherId`
  - `monthlyFee`

Timetable is already handled through group fields. A separate timetable module is not required for the MVP.

## 5. Create students

- Use `POST /api/students`
- Add:
  - `firstName`
  - `lastName`
  - `phone`
  - `parentPhone`
  - `parentName`
  - `notes`

## 6. Assign students to groups

- Use `POST /api/students` with `groupIds`
- Or update later with `PATCH /api/students/[id]`

## 7. Start daily operations

After the setup above:

- `TEACHER` can start lessons
- `TEACHER` can mark attendance
- `MANAGER` can maintain student details
- `MANAGER` can maintain teacher profile details and group assignment
- `OWNER` controls finance and managers

## Recommended Real-World Setup Order

1. `OWNER`
2. `MANAGER`
3. `TEACHER`
4. `GROUPS`
5. `STUDENTS`
6. `GROUP ASSIGNMENT`
7. `ATTENDANCE`
8. `PAYMENTS`
