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
import { MoreHorizontal, Pencil, CircleAlert } from "lucide-react";
import {
  ApiClientError,
  extractList,
  getApiErrorMessage,
  groupsAPI,
  studentsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { clearLegacyDashboardCache } from "@/lib-frontend/utils";

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
  fullName: string;
  phone: string;
  parentPhone: string;
  parentName: string;
  notes: string;
  status: "ACTIVE" | "INACTIVE" | "GRADUATED";
  groupIds: string[];
}

const initialForm: StudentForm = {
  fullName: "",
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

function splitFullName(value: string): { firstName: string; lastName: string } {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return { firstName: "", lastName: "" };
  const parts = normalized.split(" ");
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "-";
  return { firstName, lastName };
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
  const [formData, setFormData] = useState<StudentForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await studentsAPI.list();
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
    if (!canAccess) {
      router.replace("/dashboard/attendance");
      return;
    }
    clearLegacyDashboardCache();
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const openCreate = async () => {
    setFormData(initialForm);
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
    await loadGroups();
  };

  const openEdit = async (student: StudentRecord) => {
    setFormData({
      id: student.id,
      fullName: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
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
  };

  const submitStudent = async () => {
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});

    const { firstName, lastName } = splitFullName(formData.fullName);

    try {
      const payload = {
        firstName,
        lastName,
        phone: formData.phone.trim(),
        parentPhone: formData.parentPhone.trim() || null,
        parentName: formData.parentName.trim() || null,
        notes: formData.notes.trim() || null,
        status: formData.status,
        groupIds: formData.groupIds,
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
          onAddClick={openCreate}
          showFilters={false}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
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

            <div className="space-y-1">
              <Label htmlFor="fullName">Ism familiya</Label>
              <Input
                id="fullName"
                placeholder="Ismi va familiyasi"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                }
              />
              {fieldErrors.firstName && (
                <p className="text-xs text-destructive">
                  {fieldErrors.firstName}
                </p>
              )}
              {fieldErrors.lastName && (
                <p className="text-xs text-destructive">
                  {fieldErrors.lastName}
                </p>
              )}
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
              {fieldErrors.groupIds && (
                <p className="text-xs text-destructive">
                  {fieldErrors.groupIds}
                </p>
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
