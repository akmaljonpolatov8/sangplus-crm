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
  studentsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";

interface Student {
  id: string;
  name?: string | null;
  phone?: string | null;
  parentPhone?: string | null;
  group?: string | null;
  groupName?: string | null;
  status?: "active" | "inactive" | null;
}

interface StudentForm {
  id?: string;
  name: string;
  phone: string;
  parentPhone: string;
  group: string;
}

const initialForm: StudentForm = {
  name: "",
  phone: "",
  parentPhone: "",
  group: "",
};

export default function StudentsPage() {
  const router = useRouter();
  const { role } = useRole();
  const canAccess = hasAccess(role, "students");

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<StudentForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await studentsAPI.list();
      setStudents(Array.isArray(data) ? data : []);
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
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const handleAddNew = () => {
    setFormData(initialForm);
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (student: Student) => {
    setFormData({
      id: student.id,
      name: student.name || "",
      phone: student.phone || "",
      parentPhone: student.parentPhone || "",
      group: student.group || student.groupName || "",
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const submitStudent = async () => {
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        parentPhone: formData.parentPhone.trim() || null,
        group: formData.group.trim() || null,
      };

      if (formData.id) {
        await studentsAPI.update(formData.id, payload);
      } else {
        await studentsAPI.create(payload);
      }

      setIsDialogOpen(false);
      await loadStudents();
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
        render: (student: Student) => (
          <span className="font-medium text-foreground">
            {student.name || "-"}
          </span>
        ),
      },
      {
        key: "phone",
        header: "Telefon",
        render: (student: Student) => (
          <span className="text-muted-foreground">{student.phone || "-"}</span>
        ),
      },
      {
        key: "parentPhone",
        header: "Ota-ona raqami",
        render: (student: Student) => (
          <span className="text-muted-foreground">
            {student.parentPhone || "-"}
          </span>
        ),
      },
      {
        key: "group",
        header: "Guruh",
        render: (student: Student) => (
          <span className="text-muted-foreground">
            {student.groupName || student.group || "-"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Holati",
        render: (student: Student) => (
          <StatusBadge status={student.status || "inactive"} />
        ),
      },
      {
        key: "actions",
        header: "Amallar",
        className: "text-right",
        render: (student: Student) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(student)}>
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
      <DashboardHeader title="O'quvchilar" />

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
          data={students}
          columns={columns}
          searchPlaceholder="O'quvchi qidirish..."
          addButtonLabel="O'quvchi qo'shish"
          onAddClick={handleAddNew}
          showFilters={false}
        />

        {!isLoading && students.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            O'quvchilar topilmadi
          </p>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "O'quvchini tahrirlash" : "Yangi o'quvchi"}
            </DialogTitle>
            <DialogDescription>
              Ma'lumotlarni API response asosida saqlaydi.
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
              <Label htmlFor="parentPhone">Ota-ona telefoni</Label>
              <Input
                id="parentPhone"
                value={formData.parentPhone}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, parentPhone: e.target.value }))
                }
              />
              {fieldErrors.parentPhone && (
                <p className="text-xs text-destructive">
                  {fieldErrors.parentPhone}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="group">Guruh</Label>
              <Input
                id="group"
                value={formData.group}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, group: e.target.value }))
                }
              />
              {fieldErrors.group && (
                <p className="text-xs text-destructive">{fieldErrors.group}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={submitStudent} disabled={isSaving}>
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
