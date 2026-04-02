"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { DataTable } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Pencil, CircleAlert, Trash2 } from "lucide-react";
import {
  ApiClientError,
  extractList,
  getApiErrorMessage,
  groupsAPI,
  teachersAPI,
  usersAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { toast } from "@/hooks/use-toast";

interface TeacherRecord {
  id: string;
  username?: string;
  fullName?: string;
  isActive?: boolean;
  groupIds?: string[];
  groups?: Array<{ id: string; name?: string }>;
}

interface GroupRecord {
  id: string;
  name?: string;
  subject?: string;
  isActive?: boolean;
}

interface TeacherForm {
  id?: string;
  username: string;
  password: string;
  fullName: string;
  isActive: boolean;
  groupIds: string[];
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
  isActive: true,
  groupIds: [],
};

export default function TeachersPage() {
  const router = useRouter();
  const { role } = useRole();
  const canAccess = hasAccess(role, "teachers");

  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [formData, setFormData] = useState<TeacherForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  const loadTeachers = async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teachersAPI.list({
        search: search?.trim() || undefined,
      });
      setTeachers(extractList<TeacherRecord>(data, ["teachers"]));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const data = await groupsAPI.list();
      setGroups(extractList<GroupRecord>(data, ["groups"]));
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!canAccess) return;
    loadTeachers(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, debouncedSearch]);

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard/attendance");
      return;
    }
    loadTeachers(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const openCreate = async () => {
    setFormData(initialForm);
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
    await loadGroups();
  };

  const openEdit = async (teacher: TeacherRecord) => {
    setFormData({
      id: teacher.id,
      username: teacher.username || "",
      password: "",
      fullName: teacher.fullName || "",
      isActive: teacher.isActive ?? true,
      groupIds: teacher.groupIds || (teacher.groups || []).map((g) => g.id),
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
    await loadGroups();
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
      toast({ title: "Login muvaffaqiyatli yaratildi" });
      await loadTeachers(debouncedSearch);
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
        isActive: formData.isActive,
        groupIds: formData.groupIds,
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
      toast({
        title: formData.id
          ? "O'qituvchi ma'lumotlari saqlandi"
          : "Yangi o'qituvchi qo'shildi",
      });
      await loadTeachers(debouncedSearch);
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

  const deleteTeacher = async () => {
    if (!formData.id) return;

    setIsDeleting(true);
    setFormError(null);

    try {
      await teachersAPI.delete(formData.id);
      toast({ title: "O'qituvchi o'chirildi" });
      setIsDeleteConfirmOpen(false);
      setIsDialogOpen(false);
      setFormData(initialForm);
      await loadTeachers(debouncedSearch);
    } catch (err) {
      toast({
        title: "O'qituvchini o'chirib bo'lmadi",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
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
          onSearch={setSearchInput}
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
                placeholder="Logini kiriting"
                value={formData.username}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, username: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">
                Parol {formData.id ? "(ixtiyoriy)" : ""}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={
                  formData.id
                    ? "Yeni parol kiriting / bo'sh qoldiring"
                    : "Parolni kiriting"
                }
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="fullName">To'liq ismi</Label>
              <Input
                id="fullName"
                placeholder="O'qituvchining to'liq ismini kiriting"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Holati</Label>
              <Select
                value={formData.isActive ? "true" : "false"}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    isActive: value === "true",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Holati tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Faol</SelectItem>
                  <SelectItem value="false">Nofaol</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Guruhlar {isLoadingGroups && "(yuklanmoqda...)"}</Label>
              {groups.length > 0 ? (
                <div className="max-h-40 space-y-2 overflow-y-auto border rounded p-2">
                  {groups.map((group) => {
                    const isSelected = formData.groupIds.includes(group.id);
                    return (
                      <label
                        key={group.id}
                        className="flex items-center gap-2 rounded border px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            setFormData((prev) => ({
                              ...prev,
                              groupIds: checked
                                ? [...prev.groupIds, group.id]
                                : prev.groupIds.filter((id) => id !== group.id),
                            }));
                          }}
                        />
                        <span>{group.name || group.id}</span>
                      </label>
                    );
                  })}
                </div>
              ) : isLoadingGroups ? (
                <p className="text-xs text-muted-foreground">Yuklanmoqda...</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Guruhlar mavjud emas
                </p>
              )}
            </div>

            {Object.keys(fieldErrors).map((key) => (
              <p key={key} className="text-xs text-destructive">
                {fieldErrors[key]}
              </p>
            ))}
          </div>

          <DialogFooter>
            {role === "owner" && formData.id ? (
              <Button
                variant="destructive"
                onClick={() => setIsDeleteConfirmOpen(true)}
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? (
                  <CircleAlert className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                O&apos;chirish
              </Button>
            ) : null}
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

      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              O&apos;qituvchini o&apos;chirish
            </AlertDialogTitle>
            <AlertDialogDescription>
              Haqiqatan ham o&apos;chirmoqchimisiz? Bu amalni qaytarib
              bo&apos;lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Bekor qilish
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteTeacher}
              disabled={isDeleting}
            >
              Ha, o&apos;chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login yaratish</DialogTitle>
            <DialogDescription>
              O&apos;qituvchi uchun login va parol yarating.
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
