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
import { MoreHorizontal, CircleAlert, Trash2 } from "lucide-react";
import {
  ApiClientError,
  extractList,
  getApiErrorMessage,
  groupsAPI,
  studentsAPI,
} from "@/lib-frontend/api-client";
import { useRole } from "@/lib-frontend/role-context";
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
  fullName: string;
  phone: string;
  parentPhone: string;
  parentName: string;
  notes: string;
  status: "ACTIVE" | "INACTIVE" | "GRADUATED";
  groupId: string; // Single group for teacher
}

const initialForm: StudentForm = {
  fullName: "",
  phone: "",
  parentPhone: "",
  parentName: "",
  notes: "",
  status: "ACTIVE",
  groupId: "",
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

export default function TeacherStudentsPage() {
  const router = useRouter();
  const { role } = useRole();

  // Check if user is a teacher
  useEffect(() => {
    if (role && role !== "teacher") {
      router.replace("/dashboard");
    }
  }, [role, router]);

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [formData, setFormData] = useState<StudentForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("");
  const [studentToRemove, setStudentToRemove] = useState<StudentRecord | null>(
    null,
  );

  const loadStudents = async (search?: string, groupId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await studentsAPI.list({
        search: search?.trim() || undefined,
        groupId: groupId || undefined,
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
    try {
      const data = await groupsAPI.list();
      setGroups(extractList<GroupRecord>(data, ["groups"]));
      // Set first group as default if available
      const groups = extractList<GroupRecord>(data, ["groups"]);
      if (groups.length > 0 && !selectedGroupFilter) {
        setSelectedGroupFilter(groups[0].id);
      }
    } catch (err) {
      console.error("Failed to load groups:", err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    clearLegacyDashboardCache();
    loadGroups();
    loadStudents(debouncedSearch, selectedGroupFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedGroupFilter]);

  const openCreate = async () => {
    setFormData({
      ...initialForm,
      groupId: selectedGroupFilter || (groups.length > 0 ? groups[0].id : ""),
    });
    setFieldErrors({});
    setFormError(null);
    setIsDialogOpen(true);
  };

  const submitStudent = async () => {
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});

    const { firstName, lastName } = splitFullName(formData.fullName);

    try {
      if (!formData.groupId) {
        setFormError("Iltimos, guruhi tanlang");
        setIsSaving(false);
        return;
      }

      const payload = {
        firstName,
        lastName,
        phone: formData.phone.trim(),
        parentPhone: formData.parentPhone.trim() || null,
        parentName: formData.parentName.trim() || null,
        notes: formData.notes.trim() || null,
        status: formData.status,
        groupIds: [formData.groupId],
      };

      await studentsAPI.create(payload);

      setIsDialogOpen(false);
      toast({
        title: "Yangi o'quvchi qo'shildi",
      });
      await loadStudents(debouncedSearch, selectedGroupFilter);
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

  const removeStudentFromGroup = async (student: StudentRecord) => {
    if (!selectedGroupFilter) return;

    setIsRemoving(true);
    setFormError(null);

    try {
      await studentsAPI.removeFromGroup(student.id, selectedGroupFilter);
      toast({
        title: "O'quvchi guruhdan chiqarildi ✓",
      });
      setIsRemoveConfirmOpen(false);
      setStudentToRemove(null);
      await loadStudents(debouncedSearch, selectedGroupFilter);
    } catch (err) {
      toast({
        title: "Xatolik yuz berdi",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
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
        key: "groups",
        header: "Guruh",
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
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    setStudentToRemove(student);
                    setIsRemoveConfirmOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 size-4" />
                  O&apos;chirish
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [],
  );

  if (role && role !== "teacher") return null;

  return (
    <div className="min-h-screen w-full">
      <DashboardHeader title="O'quvchilar" />

      <div className="w-full space-y-4 px-4 py-4 sm:p-6">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Group Filter */}
        {groups.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="group-filter" className="whitespace-nowrap">
              Guruh filtri:
            </Label>
            <Select
              value={selectedGroupFilter}
              onValueChange={setSelectedGroupFilter}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Guruhni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name || group.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {/* Add Student Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-md rounded-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Yangi o&apos;quvchi</DialogTitle>
            <DialogDescription>
              O&apos;quvchining ismi, telefon raqami va boshqa
              ma&apos;lumotlarini kiriting
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

            <div className="space-y-1">
              <Label htmlFor="group-select">Guruh</Label>
              <Select
                value={formData.groupId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, groupId: value }))
                }
              >
                <SelectTrigger id="group-select">
                  <SelectValue placeholder="Guruhni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name || group.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.groupIds && (
                <p className="text-xs text-destructive">
                  {fieldErrors.groupIds}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
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

      {/* Remove from Group Confirmation Dialog */}
      <AlertDialog
        open={isRemoveConfirmOpen}
        onOpenChange={setIsRemoveConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              O&apos;quvchini guruhdan chiqarishni xohlaysizmi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O&apos;quvchi tizimdan o&apos;chirilmaydi, faqat guruhdan
              chiqariladi
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>
              Bekor qilish
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeStudentFromGroup(studentToRemove!)}
              disabled={isRemoving}
            >
              Ha, chiqarish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
