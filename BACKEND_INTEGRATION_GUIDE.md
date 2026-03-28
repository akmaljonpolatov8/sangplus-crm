# 🔗 Backend Integration Guide - SangPlus CRM Frontend

## Frontend Info
- **Repo**: https://github.com/akmaljonpolatov8/sangplus-crm
- **Branch**: `frontend-shukrullo`
- **Tech Stack**: Next.js 16.2 + TypeScript + React + Radix UI
- **State Management**: React Context API (Role-based auth)
- **Form Handling**: React Hook Form + Zod
- **Storage**: sessionStorage for auth tokens

---

## 📌 Quick Start for Backend Developer

### 1. Frontend Structure You Need to Know
```
Login → Role Selection → Dashboard (based on role)

Roles:
- Owner: Full access to all modules
- Manager: Manage students, teachers, payments
- Teacher: View attendance only
```

### 2. Required Backend Services

#### A. Authentication Service
**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "username": "string",
  "password": "string",
  "role": "owner|manager|teacher"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_123",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "owner"
  }
}
```

**Error** (401):
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

#### B. Dashboard Data Service
**Endpoints needed for dashboard cards**:

```
GET /api/dashboard/stats
GET /api/students
GET /api/teachers
GET /api/groups
GET /api/attendance
GET /api/payments
```

**Example Response Format for Stats**:
```json
{
  "totalStudents": 150,
  "totalTeachers": 12,
  "totalGroups": 8,
  "monthlyPayments": 2500000,
  "attendanceRate": 94.5
}
```

---

## 🔧 Frontend Files Needing Backend Connection

### Priority 1 - CRITICAL (Login)
**File**: `app/page.tsx`

**Current Code** (lines 55-75):
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  
  // Currently: Mock login
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  setRole(selectedRole as UserRole);
  setUserName(formData.username || "Foydalanuvchi");
  
  router.push("/dashboard");
};
```

**What to Replace With**:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.username,
        password: formData.password,
        role: selectedRole,
      }),
    });
    
    if (!response.ok) throw new Error('Login failed');
    
    const data = await response.json();
    
    // Store token
    sessionStorage.setItem('sangplus_token', data.token);
    sessionStorage.setItem('sangplus_role', selectedRole);
    sessionStorage.setItem('sangplus_username', data.user.username);
    
    setRole(selectedRole as UserRole);
    setUserName(data.user.username);
    
    if (selectedRole === 'teacher') {
      router.push('/dashboard/attendance');
    } else {
      router.push('/dashboard');
    }
  } catch (error) {
    // Show error toast
    console.error('Login error:', error);
    setIsLoading(false);
  }
};
```

---

### Priority 2 - HIGH (Dashboard Stats)
**File**: `app/dashboard/page.tsx` (lines ~30-60)

**What Needs Changing**:
- Replace `recentActivity` mock data with API call to `/api/activity`
- Replace `StatCard` hardcoded values with real data from `/api/dashboard/stats`

**Example Implementation**:
```typescript
'use client';

import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchStats = async () => {
      const token = sessionStorage.getItem('sangplus_token');
      const response = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      setStats(data);
      setLoading(false);
    };
    
    fetchStats();
  }, []);
  
  // Rest of component
}
```

---

### Priority 3 - MEDIUM (Data Tables)
**Files**: 
- `app/dashboard/students/page.tsx`
- `app/dashboard/teachers/page.tsx`
- `app/dashboard/groups/page.tsx`
- `app/dashboard/payments/page.tsx`
- `app/dashboard/attendance/page.tsx`

**Component**: `components/dashboard/data-table.tsx`

**What Needs**:
- Fetch data from respective endpoints
- Column headers and data mapping already configured
- Just needs API integration (see example above)

---

## 🔐 Authorization Flow

### Token Management
1. **Store after login**: `sessionStorage.setItem('sangplus_token', token)`
2. **Include in requests**: `headers: { 'Authorization': 'Bearer {token}' }`
3. **On logout**: `sessionStorage.removeItem('sangplus_token')`
4. **On token expiry**: Redirect to login

### Role-Based Access Control
Already implemented in `lib-frontend/role-context.tsx` - use `hasAccess()` helper:

```typescript
import { useRole, hasAccess } from '@/lib-frontend/role-context';

// In component
const { role } = useRole();

if (!hasAccess(role, 'view-students')) {
  return <div>Access Denied</div>;
}
```

---

## 📝 Suggested Backend API Structure

```
/api/auth
  POST /login          # ✅ NEEDED FIRST
  POST /logout
  POST /refresh-token
  GET /me

/api/dashboard
  GET /stats           # ✅ NEEDED
  GET /activity

/api/students
  GET /                # ✅ NEEDED
  POST /
  PUT /:id
  DELETE /:id

/api/teachers
  GET /                # ✅ NEEDED
  POST /
  PUT /:id
  DELETE /:id

/api/groups
  GET /                # ✅ NEEDED
  POST /

/api/payments
  GET /                # ✅ NEEDED
  POST /

/api/attendance
  GET /                # ✅ NEEDED
  POST /
  PUT /:id
```

---

## 🚀 Frontend Environment Setup

Add to `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Then in frontend code:
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

---

## ⚠️ Important Notes for Backend Developer

1. **CORS**: Frontend runs on `localhost:3000`, backend should allow this
2. **Token Format**: Best to use JWT tokens (recommended)
3. **Error Messages**: Send clear error messages in response
4. **Status Codes**: Use proper HTTP status codes (401 for unauthorized, 400 for bad request, etc.)
5. **Data Format**: Keep responses consistent JSON format
6. **Timestamps**: Return ISO 8601 format for dates
7. **Pagination**: Consider pagination for data tables (students, teachers, etc.)

---

## 🎯 Next Steps

1. **Backend dev** writes `/api/auth/login` endpoint
2. **Frontend dev** tests login with backend
3. **Backend dev** writes dashboard `/api/dashboard/stats`
4. **Frontend dev** updates dashboard pages with real data
5. **Continue** with other endpoints

---

## 📞 Frontend Locations Summary

| Feature | File | Line | Status |
|---------|------|------|--------|
| Login Page | `app/page.tsx` | 55-75 | 🔴 Ready for integration |
| Dashboard | `app/dashboard/page.tsx` | 1-50 | 🟡 Partial integration |
| Students | `app/dashboard/students/page.tsx` | TBD | 🔴 Mock data |
| Teachers | `app/dashboard/teachers/page.tsx` | TBD | 🔴 Mock data |
| Groups | `app/dashboard/groups/page.tsx` | TBD | 🔴 Mock data |
| Payments | `app/dashboard/payments/page.tsx` | TBD | 🔴 Mock data |
| Attendance | `app/dashboard/attendance/page.tsx` | TBD | 🟡 Partial |
