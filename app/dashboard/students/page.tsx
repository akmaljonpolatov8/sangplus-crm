"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { MoreHorizontal, Pencil, CircleAlert, Trash2, X } from "lucide-react";
import {
  ApiClientError,
  extractList,
  getApiErrorMessage,
  groupsAPI,
  studentsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { clearLegacyDashboardCache } from "@/lib-frontend/utils";
import { toast } from "@/hooks/use-toast";

interface StudentRecord {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  parentPhone?: string;
  parentName?: string;
  notes?: string;
  status?: "ACTIVE" | "INACTIVE" | "GRADUATED";
  groups?: Array<{ id: string; name?: string }>;
}

interface RawStudentRecord extends Omit<StudentRecord, "groups"> {
  groups?: Array<{
    id?: string;
    groupId?: string;
    name?: string;
    group?: { name?: string };
  }>;
}

interface GroupRecord {
  id: string;
  name?: string;
  subject?: string;
  isActive?: boolean;
}

interface StudentForm {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  parentPhone: string;
  parentName: string;
  notes: string;
  status: "ACTIVE" | "INACTIVE" | "GRADUATED";
  groupIds: string[];
}

const initialForm: StudentForm = {
  firstName: "",
  lastName: "",
  phone: "",
  parentPhone: "",
  parentName: "",
  notes: "",
  status: "ACTIVE",
  groupIds: [],
};

function studentStatusToBadge(
  value?: "ACTIVE" | "INACTIVE" | "GRADUATED",
): "active" | "inactive" | "graduated" {
  if (value === "ACTIVE") return "active";
  if (value === "GRADUATED") return "graduated";
  return "inactive";
}

export default function StudentsPage() {
  const router = useRouter();
  const { role } = useRole();
  const canAccess = hasAccess(role, "students");

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [formData, setFormData] = useState<StudentForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const loadStudents = async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await studentsAPI.list({
        search: search?.trim() || undefined,
      });
      const list = extractList<RawStudentRecord>(data, ["students"]);
      setStudents(
        list.map((student) => ({
          ...student,
          groups: (student.groups || []).map((group) => ({
            id: String(group.id ?? group.groupId ?? ""),
            name: group.name ?? group.group?.name,
          })),
        })),
      );
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
    loadStudents(debouncedSearch);
  }, [canAccess, debouncedSearch]);

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard/attendance");
      return;
    }
    clearLegacyDashboardCache();
    loadStudents(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const openCreate = async () => {
    setFormData(initialForm);
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
    await loadGroups();
  };

  const openEdit = useCallback(async (student: StudentRecord) => {
    setFormData({
      id: student.id,
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      phone: student.phone || "",
      parentPhone: student.parentPhone || "",
      parentName: student.parentName || "",
      notes: student.notes || "",
      status: student.status || "ACTIVE",
      groupIds: (student.groups || []).map((g) => g.id),
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
    await loadGroups();
  }, []);

  const submitStudent = async () => {
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});

    try {
      if (!formData.firstName.trim()) {
        setFormError("Ismi maydonini to'ldiring");
        setIsSaving(false);
        return;
      }

      if (!formData.lastName.trim()) {
        setFormError("Familiyasi maydonini to'ldiring");
        setIsSaving(false);
        return;
      }

      if (!formData.phone.trim()) {
        setFormError("Telefon raqam maydonini to'ldiring");
        setIsSaving(false);
        return;
      }

      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        parentPhone: formData.parentPhone.trim() || undefined,
        parentName: formData.parentName.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        status: formData.status,
        groupIds: formData.groupIds,
      };

      if (formData.id) {
        await studentsAPI.update(formData.id, payload);
      } else {
        await studentsAPI.create(payload);
      }

      setIsDialogOpen(false);
      toast({
        title: formData.id
          ? "O'quvchi ma'lumotlari saqlandi"
          : "Yangi o'quvchi qo'shildi",
      });
      await loadStudents(debouncedSearch);
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

  const deleteStudent = async () => {
    if (!formData.id) return;

    setIsDeleting(true);
    setFormError(null);

    try {
      await studentsAPI.delete(formData.id);
      toast({
        title: "O'quvchi o'chirildi",
      });
      setIsDeleteConfirmOpen(false);
      setIsDialogOpen(false);
      setFormData(initialForm);
      await loadStudents(debouncedSearch);
    } catch (err) {
      toast({
        title: "O'quvchini o'chirib bo'lmadi",
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
        key: "fullName",
        header: "Ism familiya",
        render: (student: StudentRecord) => (
          <span className="font-medium text-foreground">
            {`${student.firstName || ""} ${student.lastName || ""}`.trim() ||
              "-"}
          </span>
        ),
      },
      {
        key: "phone",
        header: "Telefon",
        render: (student: StudentRecord) => (
          <span className="text-muted-foreground">{student.phone || "-"}</span>
        ),
      },
      {
        key: "parentName",
        header: "Ota-ona",
        render: (student: StudentRecord) => (
          <span className="text-muted-foreground">
            {student.parentName || "-"}
          </span>
        ),
      },
      {
        key: "groups",
        header: "Guruhlar",
        render: (student: StudentRecord) => (
          <span className="text-muted-foreground">
            {(student.groups || []).map((g) => g.name || g.id).join(", ") ||
              "-"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Holati",
        render: (student: StudentRecord) => (
          <StatusBadge status={studentStatusToBadge(student.status)} />
        ),
      },
      {
        key: "actions",
        header: "Amallar",
        className: "text-right",
        render: (student: StudentRecord) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(student)}>
                  <Pencil className="mr-2 size-4" />
                  Tahrirlash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [openEdit],
  );

  if (!canAccess) return null;

  return (
    <div className="min-h-screen w-full">
      <DashboardHeader title="O'quvchilar" />

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
          data={students}
          columns={columns}
          searchPlaceholder="O'quvchi qidirish..."
          addButtonLabel="O'quvchi qo'shish"
          onAddClick={openCreate}
          onSearch={setSearchInput}
          showFilters={false}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-md rounded-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "O'quvchini tahrirlash" : "Yangi o'quvchi"}
            </DialogTitle>
            <DialogDescription>
              Backend payload: firstName, lastName, groupIds va boshqa
              maydonlar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {formError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="firstName">Ismi</Label>
                <Input
                  id="firstName"
                  placeholder="Ismi"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                />
                {fieldErrors.firstName && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.firstName}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName">Familiyasi</Label>
                <Input
                  id="lastName"
                  placeholder="Familiyasi"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                />
                {fieldErrors.lastName && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                placeholder="+998XXXXXXXXX"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
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
                placeholder="+998XXXXXXXXX (ixtiyoriy)"
                value={formData.parentPhone}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    parentPhone: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="parentName">Ota-ona ismi</Label>
              <Input
                id="parentName"
                placeholder="(ixtiyoriy)"
                value={formData.parentName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    parentName: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Izoh</Label>
              <Input
                id="notes"
                placeholder="(ixtiyoriy)"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: value as "ACTIVE" | "INACTIVE" | "GRADUATED",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Statusni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Faol</SelectItem>
                  <SelectItem value="INACTIVE">Nofaol</SelectItem>
                  <SelectItem value="GRADUATED">Bitirgan</SelectItem>
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
              {formData.groupIds.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {formData.groupIds.map((groupId) => {
                    const groupName =
                      groups.find((group) => group.id === groupId)?.name ||
                      "Noma'lum guruh";
                    return (
                      <button
                        key={groupId}
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground transition-colors duration-200 hover:bg-secondary/80"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            groupIds: prev.groupIds.filter(
                              (id) => id !== groupId,
                            ),
                          }))
                        }
                      >
                        <span>{groupName}</span>
                        <X className="size-3" />
                      </button>
                    );
                  })}
                </div>
              )}
              {fieldErrors.groupIds && (
                <p className="text-xs text-destructive">
                  {fieldErrors.groupIds}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            {formData.id ? (
              <Button
                variant="destructive"
                onClick={() => setIsDeleteConfirmOpen(true)}
                disabled={isDeleting || isSaving}
              >
                {isDeleting ? (
                  <CircleAlert className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                O&apos;chirish
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isDeleting || isSaving}
            >
              Bekor qilish
            </Button>
            <Button onClick={submitStudent} disabled={isSaving || isDeleting}>
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
            <AlertDialogTitle>O&apos;quvchini o&apos;chirish</AlertDialogTitle>
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
              onClick={deleteStudent}
              disabled={isDeleting}
            >
              Ha, o&apos;chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
