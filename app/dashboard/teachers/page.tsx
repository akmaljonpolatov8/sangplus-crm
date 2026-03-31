"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { DataTable } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, CircleAlert } from "lucide-react";
import {
  ApiClientError,
  getApiErrorMessage,
  teachersAPI,
  usersAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";

interface TeacherRecord {
  id: string;
  username?: string;
  fullName?: string;
  isActive?: boolean;
  groupIds?: string[];
  groups?: Array<{ id: string; name?: string }>;
}

interface TeacherForm {
  id?: string;
  username: string;
  password: string;
  fullName: string;
  isActive: string;
  groupIdsText: string;
}

interface LoginCreateForm {
  fullName: string;
  username: string;
  password: string;
}

const initialForm: TeacherForm = {
  username: "",
  password: "",
  fullName: "",
  isActive: "true",
  groupIdsText: "",
};

function parseGroupIds(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function TeachersPage() {
  const router = useRouter();
  const { role } = useRole();
  const canAccess = hasAccess(role, "teachers");

  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<TeacherForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isCreatingLogin, setIsCreatingLogin] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [loginForm, setLoginForm] = useState<LoginCreateForm>({
    fullName: "",
    username: "",
    password: "",
  });
  const [loginFormError, setLoginFormError] = useState<string | null>(null);

  const loadTeachers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teachersAPI.list();
      setTeachers(Array.isArray(data) ? (data as TeacherRecord[]) : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard/attendance");
      return;
    }
    loadTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const openCreate = () => {
    setFormData(initialForm);
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEdit = (teacher: TeacherRecord) => {
    setFormData({
      id: teacher.id,
      username: teacher.username || "",
      password: "",
      fullName: teacher.fullName || "",
      isActive: String(Boolean(teacher.isActive)),
      groupIdsText:
        teacher.groupIds?.join(", ") ||
        (teacher.groups || []).map((g) => g.id).join(", "),
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const generatePassword = () => {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i += 1) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    setLoginForm((prev) => ({ ...prev, password }));
  };

  const openCreateLogin = (teacher?: TeacherRecord) => {
    const baseName = teacher?.fullName || "";
    const suggestedUsername =
      teacher?.username ||
      baseName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.|\.$/g, "")
        .slice(0, 24);

    setLoginForm({
      fullName: baseName,
      username: suggestedUsername || "teacher",
      password: "",
    });
    setCreatedCredentials(null);
    setLoginFormError(null);
    setIsLoginDialogOpen(true);
  };

  const submitCreateLogin = async () => {
    if (!loginForm.fullName.trim()) {
      setLoginFormError("O'qituvchi F.I.Sh ni kiriting");
      return;
    }
    if (!loginForm.username.trim()) {
      setLoginFormError("Login kiriting");
      return;
    }
    if (!loginForm.password.trim()) {
      setLoginFormError("Parol kiriting yoki avtomatik yarating");
      return;
    }

    setIsCreatingLogin(true);
    setLoginFormError(null);
    try {
      await usersAPI.create({
        fullName: loginForm.fullName.trim(),
        username: loginForm.username.trim(),
        password: loginForm.password,
        role: "TEACHER",
      });

      setCreatedCredentials({
        username: loginForm.username.trim(),
        password: loginForm.password,
      });
      await loadTeachers();
    } catch (err) {
      setLoginFormError(getApiErrorMessage(err));
    } finally {
      setIsCreatingLogin(false);
    }
  };

  const submitTeacher = async () => {
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const payload: Record<string, unknown> = {
        username: formData.username.trim(),
        fullName: formData.fullName.trim(),
        isActive: formData.isActive === "true",
        groupIds: parseGroupIds(formData.groupIdsText),
      };

      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      if (formData.id) {
        await teachersAPI.update(formData.id, payload);
      } else {
        if (!payload.password) {
          throw new Error("Yangi o'qituvchi uchun password majburiy");
        }
        await teachersAPI.create(payload);
      }

      setIsDialogOpen(false);
      await loadTeachers();
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        (err.status === 400 || err.status === 409) &&
        err.fieldErrors
      ) {
        setFieldErrors(err.fieldErrors);
      }
      setFormError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "username",
        header: "Username",
        render: (teacher: TeacherRecord) => (
          <span className="font-medium">{teacher.username || "-"}</span>
        ),
      },
      {
        key: "fullName",
        header: "F.I.Sh",
        render: (teacher: TeacherRecord) => (
          <span className="text-muted-foreground">
            {teacher.fullName || "-"}
          </span>
        ),
      },
      {
        key: "groups",
        header: "Guruhlar",
        render: (teacher: TeacherRecord) => (
          <span className="text-muted-foreground">
            {teacher.groups?.map((g) => g.name || g.id).join(", ") ||
              teacher.groupIds?.join(", ") ||
              "-"}
          </span>
        ),
      },
      {
        key: "isActive",
        header: "Holati",
        render: (teacher: TeacherRecord) => (
          <StatusBadge status={teacher.isActive ? "active" : "inactive"} />
        ),
      },
      {
        key: "actions",
        header: "Amallar",
        className: "text-right",
        render: (teacher: TeacherRecord) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(teacher)}>
                  <Pencil className="mr-2 size-4" />
                  Tahrirlash
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCreateLogin(teacher)}>
                  Login yaratish
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [],
  );

  if (!canAccess) return null;

  return (
    <div className="min-h-screen">
      <DashboardHeader title="O'qituvchilar" />

      <div className="space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {isLoading && (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        )}

        <DataTable
          data={teachers}
          columns={columns}
          searchPlaceholder="O'qituvchi qidirish..."
          addButtonLabel="O'qituvchi qo'shish"
          onAddClick={openCreate}
          showFilters={false}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi"}
            </DialogTitle>
            <DialogDescription>
              Backend contract: username, password, fullName, isActive,
              groupIds.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {formError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, username: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">
                Password {formData.id ? "(ixtiyoriy)" : ""}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="isActive">Is active (true/false)</Label>
              <Input
                id="isActive"
                value={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isActive: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="groupIdsText">Group IDs (vergul bilan)</Label>
              <Input
                id="groupIdsText"
                value={formData.groupIdsText}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    groupIdsText: e.target.value,
                  }))
                }
              />
            </div>

            {Object.keys(fieldErrors).map((key) => (
              <p key={key} className="text-xs text-destructive">
                {fieldErrors[key]}
              </p>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={submitTeacher} disabled={isSaving}>
              {isSaving ? (
                <CircleAlert className="mr-2 size-4 animate-spin" />
              ) : null}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login yaratish</DialogTitle>
            <DialogDescription>
              O'qituvchi uchun login va parol yarating.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {loginFormError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                {loginFormError}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="loginFullName">F.I.Sh</Label>
              <Input
                id="loginFullName"
                value={loginForm.fullName}
                onChange={(e) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    fullName: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="loginUsername">Login</Label>
              <Input
                id="loginUsername"
                value={loginForm.username}
                onChange={(e) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loginPassword">Parol</Label>
              <div className="flex gap-2">
                <Input
                  id="loginPassword"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePassword}
                >
                  Auto
                </Button>
              </div>
            </div>

            {createdCredentials && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
                <p className="font-semibold text-emerald-400">
                  Login yaratildi
                </p>
                <p>Username: {createdCredentials.username}</p>
                <p>Password: {createdCredentials.password}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLoginDialogOpen(false)}
            >
              Yopish
            </Button>
            <Button onClick={submitCreateLogin} disabled={isCreatingLogin}>
              {isCreatingLogin ? "Yaratilmoqda..." : "Yaratish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
