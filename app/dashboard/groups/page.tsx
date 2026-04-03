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
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import {
  clearLegacyDashboardCache,
  formatCurrency,
} from "@/lib-frontend/utils";
import { toast } from "@/hooks/use-toast";

interface GroupRecord {
  id: string;
  name?: string;
  subject?: string;
  scheduleDays?: string[];
  startTime?: string;
  endTime?: string;
  monthlyFee?: number | string;
  teacherId?: string;
  teacher?: { id?: string; fullName?: string };
  isActive?: boolean;
  _count?: {
    students?: number;
    lessons?: number;
  };
}

interface TeacherItem {
  id: string;
  fullName?: string;
  isActive?: boolean;
}

interface GroupForm {
  id?: string;
  name: string;
  subject: string;
  scheduleDays: string[];
  startTime: string;
  endTime: string;
  monthlyFee: string;
  teacherId: string;
  isActive: boolean;
}

const HAFTA_KUNLARI = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
] as const;

const initialForm: GroupForm = {
  name: "",
  subject: "",
  scheduleDays: [],
  startTime: "",
  endTime: "",
  monthlyFee: "",
  teacherId: "",
  isActive: true,
};

export default function GroupsPage() {
  const router = useRouter();
  const { role } = useRole();
  const canAccess = hasAccess(role, "groups");

  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [formData, setFormData] = useState<GroupForm>(initialForm);
  const [groupToDelete, setGroupToDelete] = useState<GroupRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const loadData = async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [groupsData, teachersData] = await Promise.all([
        groupsAPI.list({ search: search?.trim() || undefined }),
        teachersAPI.list(),
      ]);
      setGroups(extractList<GroupRecord>(groupsData, ["groups"]));
      setTeachers(
        extractList<TeacherItem>(teachersData, ["teachers"]).filter(
          (teacher) => teacher.isActive !== false,
        ),
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
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
    loadData(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, debouncedSearch]);

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard/attendance");
      return;
    }
    clearLegacyDashboardCache();
    loadData(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const openCreate = () => {
    setFormData(initialForm);
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEdit = (group: GroupRecord) => {
    setFormData({
      id: group.id,
      name: group.name || "",
      subject: group.subject || "",
      scheduleDays: group.scheduleDays || [],
      startTime: group.startTime || "",
      endTime: group.endTime || "",
      monthlyFee: String(group.monthlyFee ?? ""),
      teacherId: group.teacherId || group.teacher?.id || "",
      isActive: Boolean(group.isActive),
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) errors.name = "Guruh nomini kiriting";
    if (!formData.teacherId) errors.teacherId = "O'qituvchini tanlang";
    if (formData.scheduleDays.length === 0)
      errors.scheduleDays = "Kamida bitta dars kunini tanlang";

    const monthlyFee = Number(formData.monthlyFee);
    if (
      !formData.monthlyFee.trim() ||
      Number.isNaN(monthlyFee) ||
      monthlyFee <= 0
    ) {
      errors.monthlyFee = "Oylik to'lov to'g'ri kiritilishi shart";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitGroup = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setFormError(null);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        subject: formData.subject.trim() || null,
        scheduleDays: formData.scheduleDays,
        startTime: formData.startTime.trim() || null,
        endTime: formData.endTime.trim() || null,
        teacherId: formData.teacherId,
        isActive: formData.isActive,
        monthlyFee: Number(formData.monthlyFee),
      };

      if (formData.id) {
        await groupsAPI.update(formData.id, payload);
        toast({ title: "Guruh yangilandi ✓" });
      } else {
        await groupsAPI.create(payload);
        toast({ title: "Yangi guruh qo'shildi" });
      }

      setIsDialogOpen(false);
      await loadData(debouncedSearch);
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

  const openDeleteConfirm = (group: GroupRecord) => {
    setGroupToDelete(group);
    setIsDeleteConfirmOpen(true);
  };

  const deleteGroup = async () => {
    if (!groupToDelete?.id) return;

    setIsDeleting(true);
    try {
      await groupsAPI.delete(groupToDelete.id);
      setGroups((prev) => prev.filter((item) => item.id !== groupToDelete.id));
      setIsDeleteConfirmOpen(false);
      setGroupToDelete(null);
      toast({
        title: "Guruh muvaffaqiyatli o'chirildi ✓",
      });
    } catch (err) {
      toast({
        title: "Guruhni o'chirib bo'lmadi",
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
        key: "name",
        header: "Guruh",
        render: (group: GroupRecord) => (
          <button
            type="button"
            className="font-medium text-left text-foreground transition-colors duration-200 hover:text-primary"
            onClick={() => router.push(`/dashboard/groups/${group.id}`)}
          >
            {group.name || "-"}
          </button>
        ),
      },
      {
        key: "subject",
        header: "Fan",
        render: (group: GroupRecord) => (
          <span className="text-muted-foreground">{group.subject || "-"}</span>
        ),
      },
      {
        key: "schedule",
        header: "Dars kunlari",
        render: (group: GroupRecord) => (
          <span className="text-muted-foreground">
            {(group.scheduleDays || []).join(", ") || "-"}
          </span>
        ),
      },
      {
        key: "teacher",
        header: "O'qituvchi",
        render: (group: GroupRecord) => (
          <span className="text-muted-foreground">
            {group.teacher?.fullName || "-"}
          </span>
        ),
      },
      {
        key: "monthlyFee",
        header: "Oylik to'lov",
        render: (group: GroupRecord) => (
          <span className="text-muted-foreground">
            {group.monthlyFee == null ? "-" : formatCurrency(group.monthlyFee)}
          </span>
        ),
      },
      {
        key: "studentCount",
        header: "O'quvchilar",
        render: (group: GroupRecord) => (
          <span className="text-muted-foreground">
            {group._count?.students ?? 0}
          </span>
        ),
      },
      {
        key: "isActive",
        header: "Holati",
        render: (group: GroupRecord) => (
          <StatusBadge status={group.isActive ? "active" : "inactive"} />
        ),
      },
      {
        key: "actions",
        header: "Amallar",
        className: "text-right",
        render: (group: GroupRecord) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(group)}>
                  <Pencil className="mr-2 size-4" />
                  Tahrirlash
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openDeleteConfirm(group)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  O'chirish
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [router],
  );

  if (!canAccess) return null;

  return (
    <div className="min-h-screen w-full">
      <DashboardHeader title="Guruhlar" />

      <div className="w-full space-y-4 px-4 py-4 sm:p-6">
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
          addButtonLabel="Yangi guruh"
          onAddClick={openCreate}
          onSearch={setSearchInput}
          showFilters={false}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-xl rounded-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Guruhni tahrirlash" : "Yangi guruh"}
            </DialogTitle>
            <DialogDescription>
              Barcha maydonlarni to&apos;g&apos;ri to&apos;ldiring va saqlang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="name">Guruh nomi</Label>
              <Input
                id="name"
                placeholder="Masalan: Nodirjon Group"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="subject">Fan</Label>
              <Input
                id="subject"
                placeholder="Masalan: Matematika"
                value={formData.subject}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, subject: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Dars kunlari</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {HAFTA_KUNLARI.map((day) => {
                  const checked = formData.scheduleDays.includes(day);
                  return (
                    <label
                      key={day}
                      className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) => {
                          setFormData((prev) => {
                            const nextDays = nextChecked
                              ? [...prev.scheduleDays, day]
                              : prev.scheduleDays.filter(
                                  (item) => item !== day,
                                );
                            return { ...prev, scheduleDays: nextDays };
                          });
                        }}
                      />
                      <span>{day}</span>
                    </label>
                  );
                })}
              </div>
              {fieldErrors.scheduleDays && (
                <p className="text-xs text-destructive">
                  {fieldErrors.scheduleDays}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="startTime">Boshlanish vaqti</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      startTime: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endTime">Tugash vaqti</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      endTime: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="monthlyFee">Oylik to&apos;lov</Label>
              <Input
                id="monthlyFee"
                inputMode="decimal"
                placeholder="Masalan: 400000"
                value={formData.monthlyFee}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    monthlyFee: e.target.value,
                  }))
                }
              />
              {fieldErrors.monthlyFee && (
                <p className="text-xs text-destructive">
                  {fieldErrors.monthlyFee}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>O&apos;qituvchi</Label>
              <Select
                value={formData.teacherId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, teacherId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="O'qituvchini tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.fullName || teacher.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.teacherId && (
                <p className="text-xs text-destructive">
                  {fieldErrors.teacherId}
                </p>
              )}
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Faol</SelectItem>
                  <SelectItem value="false">Nofaol</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={(open) => {
          setIsDeleteConfirmOpen(open);
          if (!open) {
            setGroupToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Guruhni o'chirish</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <CircleAlert className="size-4 text-destructive" />
                Ogohlantirish
              </span>
              <span className="block">
                &laquo;{groupToDelete?.name || "Tanlangan guruh"}&raquo;
                guruhini o'chirishni xohlaysizmi?
              </span>
              <span className="block">
                Bu guruhga tegishli barcha darslar, davomat va to'lov
                ma'lumotlari ham o'chiriladi.
              </span>
              <span className="block font-semibold text-destructive">
                Bu amalni qaytarib bo'lmaydi!
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Bekor qilish
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={deleteGroup}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ha, o'chirish
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
