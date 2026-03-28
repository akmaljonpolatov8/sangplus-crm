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
  groupsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { formatCurrency } from "@/lib-frontend/utils";

interface Group {
  id: string;
  name?: string | null;
  teacher?: string | null;
  teacherName?: string | null;
  days?: string | null;
  time?: string | null;
  monthlyFee?: number | string | null;
  students?: number | null;
  status?: "active" | "inactive" | null;
}

interface GroupForm {
  id?: string;
  name: string;
  teacher: string;
  days: string;
  time: string;
  monthlyFee: string;
}

const initialForm: GroupForm = {
  name: "",
  teacher: "",
  days: "",
  time: "",
  monthlyFee: "",
};

export default function GroupsPage() {
  const router = useRouter();
  const { role } = useRole();
  const canAccess = hasAccess(role, "groups");
  const isOwner = role === "owner";

  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<GroupForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await groupsAPI.list();
      setGroups(Array.isArray(data) ? data : []);
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
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const handleAddNew = () => {
    setFormData(initialForm);
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (group: Group) => {
    setFormData({
      id: group.id,
      name: group.name || "",
      teacher: group.teacher || group.teacherName || "",
      days: group.days || "",
      time: group.time || "",
      monthlyFee: String(group.monthlyFee ?? ""),
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const submitGroup = async () => {
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        teacher: formData.teacher.trim() || null,
        days: formData.days.trim() || null,
        time: formData.time.trim() || null,
      };

      if (isOwner && formData.monthlyFee.trim()) {
        payload.monthlyFee = Number(formData.monthlyFee);
      }

      if (formData.id) {
        await groupsAPI.update(formData.id, payload);
      } else {
        await groupsAPI.create(payload);
      }

      setIsDialogOpen(false);
      await loadGroups();
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
        header: "Guruh nomi",
        render: (group: Group) => (
          <span className="font-medium text-foreground">
            {group.name || "-"}
          </span>
        ),
      },
      {
        key: "teacher",
        header: "O'qituvchi",
        render: (group: Group) => (
          <span className="text-muted-foreground">
            {group.teacherName || group.teacher || "-"}
          </span>
        ),
      },
      {
        key: "days",
        header: "Dars kunlari",
        render: (group: Group) => (
          <span className="text-muted-foreground">{group.days || "-"}</span>
        ),
      },
      {
        key: "time",
        header: "Dars vaqti",
        render: (group: Group) => (
          <span className="text-muted-foreground">{group.time || "-"}</span>
        ),
      },
      {
        key: "monthlyFee",
        header: "Oylik to'lov",
        render: (group: Group) => (
          <span className="text-muted-foreground">
            {group.monthlyFee == null ? "-" : formatCurrency(group.monthlyFee)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Holati",
        render: (group: Group) => (
          <StatusBadge status={group.status || "inactive"} />
        ),
      },
      {
        key: "actions",
        header: "Amallar",
        className: "text-right",
        render: (group: Group) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(group)}>
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
      <DashboardHeader title="Guruhlar" />

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
          data={groups}
          columns={columns}
          searchPlaceholder="Guruh qidirish..."
          addButtonLabel="Guruh qo'shish"
          onAddClick={handleAddNew}
          showFilters={false}
        />

        {!isLoading && groups.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Guruhlar topilmadi
          </p>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Guruhni tahrirlash" : "Yangi guruh"}
            </DialogTitle>
            <DialogDescription>
              `monthlyFee` MANAGER flow uchun majburiy emas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {formError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="name">Guruh nomi</Label>
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
              <Label htmlFor="teacher">O'qituvchi</Label>
              <Input
                id="teacher"
                value={formData.teacher}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, teacher: e.target.value }))
                }
              />
              {fieldErrors.teacher && (
                <p className="text-xs text-destructive">
                  {fieldErrors.teacher}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="days">Dars kunlari</Label>
                <Input
                  id="days"
                  value={formData.days}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, days: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="time">Dars vaqti</Label>
                <Input
                  id="time"
                  value={formData.time}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, time: e.target.value }))
                  }
                />
              </div>
            </div>

            {isOwner && (
              <div className="space-y-1">
                <Label htmlFor="monthlyFee">Monthly fee</Label>
                <Input
                  id="monthlyFee"
                  value={formData.monthlyFee}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, monthlyFee: e.target.value }))
                  }
                />
                {fieldErrors.monthlyFee && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.monthlyFee}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={submitGroup} disabled={isSaving}>
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
