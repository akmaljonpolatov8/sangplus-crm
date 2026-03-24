# SangPlus CRM API Contract

Base URL:

```text
/api
```

## Common Rules

### Headers

```http
Content-Type: application/json
Authorization: Bearer <token>
```

`Authorization` faqat protected endpointlar uchun kerak.

### Roles

- `OWNER`: full access
- `MANAGER`: management access, no financial amounts
- `TEACHER`: lesson and attendance only

### Response Format

Every endpoint returns the same envelope:

Success:

```json
{
  "success": true,
  "message": "Students fetched successfully",
  "data": [],
  "error": null
}
```

Error:

```json
{
  "success": false,
  "message": "Student not found",
  "data": null,
  "error": "Student not found"
}
```

Validation / database style error:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "error": {
    "message": "Validation failed",
    "details": {
      "status": [
        "Invalid option"
      ]
    }
  }
}
```

## Auth

### `POST /api/auth/login`

Required role:

- none

Request body:

```json
{
  "username": "teacher_diyora",
  "password": "Teacher123"
}
```

Success response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<token>",
    "user": {
      "id": "cm9teacher1",
      "username": "teacher_diyora",
      "fullName": "Diyora Xasanova",
      "role": "TEACHER"
    }
  },
  "error": null
}
```

Error example:

```json
{
  "success": false,
  "message": "Invalid username or password",
  "data": null,
  "error": "Invalid username or password"
}
```

### `GET /api/auth/me`

Required role:

- `OWNER`
- `MANAGER`
- `TEACHER`

Success response:

```json
{
  "success": true,
  "message": "Current user fetched successfully",
  "data": {
    "id": "cm9manager1",
    "username": "manager_sangplus",
    "fullName": "Nodira Karimova",
    "role": "MANAGER",
    "isActive": true
  },
  "error": null
}
```

### `POST /api/auth/change-password`

Required role:

- `OWNER`
- `MANAGER`
- `TEACHER`

Request body:

```json
{
  "currentPassword": "Teacher123",
  "newPassword": "Teacher456"
}
```

Success response:

```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "id": "cm9teacher1",
    "passwordChanged": true
  },
  "error": null
}
```

### `POST /api/users/[id]/reset-password`

Required role:

- `OWNER`

Request body:

```json
{
  "newPassword": "Teacher789"
}
```

Success response:

```json
{
  "success": true,
  "message": "User password reset successfully",
  "data": {
    "id": "cm9teacher1",
    "username": "teacher_diyora",
    "role": "TEACHER",
    "passwordReset": true
  },
  "error": null
}
```

## Students

### `GET /api/students`

Required role:

- `OWNER`
- `MANAGER`
- `TEACHER`

Query params:

- `search`
- `status`: `ACTIVE | INACTIVE | GRADUATED`
- `groupId`

Success response:

```json
{
  "success": true,
  "message": "Students fetched successfully",
  "data": [
    {
      "id": "cm9student1",
      "firstName": "Malika",
      "lastName": "Tursunova",
      "phone": "998901112233",
      "parentPhone": "998901110001",
      "parentName": "Dilfuza opa",
      "notes": "Tibbiyot yo'nalishiga tayyorlanmoqda",
      "status": "ACTIVE",
      "createdAt": "2026-03-24T10:00:00.000Z",
      "updatedAt": "2026-03-24T10:00:00.000Z",
      "groups": [
        {
          "groupId": "cm9group1",
          "group": {
            "name": "Bio-1"
          }
        }
      ]
    }
  ],
  "error": null
}
```

### `POST /api/students`

Required role:

- `OWNER`
- `MANAGER`

Request body:

```json
{
  "firstName": "Shahzoda",
  "lastName": "Nematova",
  "phone": "998901112255",
  "parentPhone": "998901110003",
  "parentName": "Gulnora opa",
  "notes": "Kimyo faniga qiziqadi",
  "status": "ACTIVE",
  "groupIds": ["cm9group1", "cm9group2"]
}
```

### `PATCH /api/students/[id]`

Required role:

- `OWNER`
- `MANAGER`

Request body:

```json
{
  "phone": "998901119999",
  "notes": "Med-Intensivga ham qo'shildi",
  "groupIds": ["cm9group1", "cm9group3"]
}
```

### `DELETE /api/students/[id]`

Required role:

- `OWNER`
- `MANAGER`

Behavior:

- soft delete
- student `INACTIVE` bo'ladi

Success response:

```json
{
  "success": true,
  "message": "Student deleted successfully",
  "data": {
    "id": "cm9student1",
    "deleted": true
  },
  "error": null
}
```

## Teachers

### `GET /api/teachers`

Required role:

- `OWNER`
- `MANAGER`

Query params:

- `search`
- `isActive`: `true | false`

Success response:

```json
{
  "success": true,
  "message": "Teachers fetched successfully",
  "data": [
    {
      "id": "cm9teacher1",
      "username": "teacher_diyora",
      "fullName": "Diyora Xasanova",
      "role": "TEACHER",
      "isActive": true,
      "createdAt": "2026-03-24T09:00:00.000Z",
      "groups": [
        {
          "id": "cm9group1",
          "name": "Bio-1",
          "subject": "Biologiya",
          "isActive": true
        }
      ]
    }
  ],
  "error": null
}
```

### `POST /api/teachers`

Required role:

- `OWNER`

Request body:

```json
{
  "username": "teacher_sardor",
  "password": "Teacher123",
  "fullName": "Sardor Islomov",
  "isActive": true,
  "groupIds": ["cm9group1", "cm9group2"]
}
```

### `PATCH /api/teachers/[id]`

Required role:

- `OWNER`

Request body:

```json
{
  "fullName": "Diyora Xasanova",
  "password": "NewTeacher123",
  "groupIds": ["cm9group3"],
  "isActive": true
}
```

### `DELETE /api/teachers/[id]`

Required role:

- `OWNER`

Behavior:

- soft delete
- teacher `isActive = false`
- groups are unassigned

## Groups

### `GET /api/groups`

Required role:

- `OWNER`
- `MANAGER`
- `TEACHER`

Query params:

- `teacherId`
- `isActive`: `true | false`

Success response for `OWNER`:

```json
{
  "success": true,
  "message": "Groups fetched successfully",
  "data": [
    {
      "id": "cm9group1",
      "name": "Bio-1",
      "subject": "Biologiya",
      "scheduleDays": ["Dushanba", "Chorshanba", "Juma"],
      "startTime": "16:00",
      "endTime": "18:00",
      "monthlyFee": "450000",
      "isActive": true,
      "teacher": {
        "id": "cm9teacher1",
        "fullName": "Diyora Xasanova",
        "username": "teacher_diyora"
      },
      "_count": {
        "students": 12,
        "lessons": 18
      }
    }
  ],
  "error": null
}
```

Note:

- `OWNER` sees `monthlyFee`
- `MANAGER` and `TEACHER` do not receive `monthlyFee`

### `POST /api/groups`

Required role:

- `OWNER`
- `MANAGER`

Request body:

```json
{
  "name": "Kimyo-2",
  "subject": "Kimyo",
  "scheduleDays": ["Seshanba", "Payshanba", "Shanba"],
  "startTime": "15:30",
  "endTime": "17:30",
  "monthlyFee": 480000,
  "teacherId": "cm9teacher1",
  "isActive": true
}
```

### `PATCH /api/groups/[id]`

Required role:

- `OWNER`
- `MANAGER`

### `DELETE /api/groups/[id]`

Required role:

- `OWNER`
- `MANAGER`

Behavior:

- soft delete
- group `isActive = false`

## Lessons

### `POST /api/lessons/start`

Required role:

- `OWNER`
- `TEACHER`

Request body:

```json
{
  "groupId": "cm9group1",
  "lessonDate": "2026-03-24",
  "notes": "Genetika bo'yicha amaliy dars"
}
```

Success response:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {
    "id": "cm9lesson1",
    "lessonDate": "2026-03-24T00:00:00.000Z",
    "startedAt": "2026-03-24T11:30:00.000Z",
    "notes": "Genetika bo'yicha amaliy dars",
    "group": {
      "id": "cm9group1",
      "name": "Bio-1"
    },
    "startedBy": {
      "id": "cm9teacher1",
      "fullName": "Diyora Xasanova"
    }
  },
  "error": null
}
```

## Attendance

### `GET /api/attendance`

Required role:

- `OWNER`
- `MANAGER`
- `TEACHER`

Query params:

- `lessonId`
- `groupId`
- `lessonDate`

### `POST /api/attendance`

Required role:

- `OWNER`
- `TEACHER`

Request body:

```json
{
  "lessonId": "cm9lesson1",
  "entries": [
    {
      "studentId": "cm9student1",
      "status": "PRESENT"
    },
    {
      "studentId": "cm9student2",
      "status": "LATE",
      "notes": "10 daqiqa kechikdi"
    }
  ]
}
```

Success response:

```json
{
  "success": true,
  "message": "Attendance saved successfully",
  "data": [
    {
      "id": "cm9attendance1",
      "status": "PRESENT",
      "notes": null,
      "student": {
        "id": "cm9student1",
        "firstName": "Malika",
        "lastName": "Tursunova"
      }
    }
  ],
  "error": null
}
```

## Payments

### Visibility Rules

- `OWNER` can access payment endpoints and see full amounts
- `MANAGER` can access only `GET /api/payments` and sees status-only payment data
- `TEACHER` cannot access payment endpoints

### `GET /api/payments`

Required role:

- `OWNER`
- `MANAGER`

Query params:

- `studentId`
- `groupId`
- `status`: `UNPAID | PARTIAL | PAID | OVERDUE`
- `billingMonth`
- `overdueOnly`: `true | false`

Success response for `OWNER`:

```json
{
  "success": true,
  "message": "Payments fetched successfully",
  "data": [
    {
      "id": "cm9payment1",
      "billingMonth": "2026-03-01T00:00:00.000Z",
      "dueDate": "2026-03-15T00:00:00.000Z",
      "status": "PARTIAL",
      "paidAt": "2026-03-10T09:00:00.000Z",
      "notes": null,
      "amount": "450000",
      "paidAmount": "200000",
      "student": {
        "id": "cm9student2",
        "firstName": "Javohir",
        "lastName": "Rasulov",
        "parentPhone": "998901110002"
      },
      "group": {
        "id": "cm9group1",
        "name": "Bio-1"
      },
      "reminderText": null
    }
  ],
  "error": null
}
```

Success response for `MANAGER`:

```json
{
  "success": true,
  "message": "Payments fetched successfully",
  "data": [
    {
      "id": "cm9payment2",
      "billingMonth": "2026-02-01T00:00:00.000Z",
      "dueDate": "2026-02-15T00:00:00.000Z",
      "status": "OVERDUE",
      "student": {
        "id": "cm9student3",
        "firstName": "Shahzoda",
        "lastName": "Nematova",
        "parentPhone": "998901110003"
      },
      "group": {
        "id": "cm9group1",
        "name": "Bio-1"
      },
      "reminderText": "Hurmatli ota-ona, SangPlus o'quv markazidan eslatma. Shahzoda Nematova (Bio-1) bo'yicha to'lov kechiktirilgan. To'lovni imkon qadar tezroq amalga oshirishingizni so'raymiz."
    }
  ],
  "error": null
}
```

Important:

- `MANAGER` response does not include `amount`
- `MANAGER` response does not include `paidAmount`
- `MANAGER` response does not include `paidAt`
- `MANAGER` response does not include `notes`

### `POST /api/payments`

Required role:

- `OWNER`

Request body:

```json
{
  "studentId": "cm9student1",
  "groupId": "cm9group1",
  "billingMonth": "2026-03-01",
  "amount": 450000,
  "paidAmount": 450000,
  "notes": "Naqd to'landi"
}
```

### `PATCH /api/payments/[id]`

Required role:

- `OWNER`

Request body:

```json
{
  "paidAmount": 300000,
  "notes": "Qisman to'lov qilindi"
}
```

Success response:

```json
{
  "success": true,
  "message": "Payment updated successfully",
  "data": {
    "id": "cm9payment1",
    "billingMonth": "2026-03-01T00:00:00.000Z",
    "dueDate": "2026-03-15T00:00:00.000Z",
    "status": "PARTIAL",
    "paidAt": "2026-03-24T12:10:00.000Z",
    "notes": "Qisman to'lov qilindi",
    "amount": "450000",
    "paidAmount": "300000",
    "student": {
      "id": "cm9student2",
      "firstName": "Javohir",
      "lastName": "Rasulov",
      "parentPhone": "998901110002"
    },
    "group": {
      "id": "cm9group1",
      "name": "Bio-1"
    },
    "reminderText": null
  },
  "error": null
}
```

### `DELETE /api/payments/[id]`

Required role:

- `OWNER`

## Common Error Examples

Unauthorized:

```json
{
  "success": false,
  "message": "Authorization token is required",
  "data": null,
  "error": "Authorization token is required"
}
```

Forbidden:

```json
{
  "success": false,
  "message": "You do not have access to this resource",
  "data": null,
  "error": "You do not have access to this resource"
}
```

Not found:

```json
{
  "success": false,
  "message": "Payment not found",
  "data": null,
  "error": "Payment not found"
}
```
