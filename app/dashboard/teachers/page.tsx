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
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";

interface Teacher {
  id: string;
  name?: string | null;
  phone?: string | null;
  subject?: string | null;
  status?: "active" | "inactive" | null;
  groups?: number | null;
}

interface TeacherForm {
  id?: string;
  name: string;
  phone: string;
  subject: string;
}

const initialForm: TeacherForm = {
  name: "",
  phone: "",
  subject: "",
};

export default function TeachersPage() {
  const router = useRouter();
  const { role } = useRole();
  const canAccess = hasAccess(role, "teachers");

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<TeacherForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadTeachers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teachersAPI.list();
      setTeachers(Array.isArray(data) ? data : []);
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

  const handleAddNew = () => {
    setFormData(initialForm);
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (teacher: Teacher) => {
    setFormData({
      id: teacher.id,
      name: teacher.name || "",
      phone: teacher.phone || "",
      subject: teacher.subject || "",
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const submitTeacher = async () => {
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        subject: formData.subject.trim() || null,
      };

      if (formData.id) {
        await teachersAPI.update(formData.id, payload);
      } else {
        await teachersAPI.create(payload);
      }

      setIsDialogOpen(false);
      await loadTeachers();
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        (err.status === 400 || err.status === 409)
      ) {
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
      }
      setFormError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Ism familiya",
        render: (teacher: Teacher) => (
          <span className="font-medium text-foreground">
            {teacher.name || "-"}
          </span>
        ),
      },
      {
        key: "phone",
        header: "Telefon raqami",
        render: (teacher: Teacher) => (
          <span className="text-muted-foreground">{teacher.phone || "-"}</span>
        ),
      },
      {
        key: "subject",
        header: "Fan",
        render: (teacher: Teacher) => (
          <span className="text-muted-foreground">
            {teacher.subject || "-"}
          </span>
        ),
      },
      {
        key: "groups",
        header: "Guruhlar",
        render: (teacher: Teacher) => (
          <span className="text-muted-foreground">{teacher.groups ?? 0}</span>
        ),
      },
      {
        key: "status",
        header: "Holati",
        render: (teacher: Teacher) => (
          <StatusBadge status={teacher.status || "inactive"} />
        ),
      },
      {
        key: "actions",
        header: "Amallar",
        className: "text-right",
        render: (teacher: Teacher) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(teacher)}>
                  <Pencil className="mr-2 size-4" />
                  Tahrirlash
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
          onAddClick={handleAddNew}
          showFilters={false}
        />

        {!isLoading && teachers.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            O'qituvchilar topilmadi
          </p>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi"}
            </DialogTitle>
            <DialogDescription>
              Teacher create flow OWNER va MANAGER uchun ochiq.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {formError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="name">Ism familiya</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, name: e.target.value }))
                }
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, phone: e.target.value }))
                }
              />
              {fieldErrors.phone && (
                <p className="text-xs text-destructive">{fieldErrors.phone}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="subject">Fan</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, subject: e.target.value }))
                }
              />
              {fieldErrors.subject && (
                <p className="text-xs text-destructive">
                  {fieldErrors.subject}
                </p>
              )}
            </div>
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
    </div>
  );
}
