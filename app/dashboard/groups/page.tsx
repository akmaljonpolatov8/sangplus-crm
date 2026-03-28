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
import { ApiClientError, getApiErrorMessage, groupsAPI } from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { formatCurrency } from "@/lib-frontend/utils";

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
}

interface GroupForm {
  id?: string;
  name: string;
  subject: string;
  scheduleDaysText: string;
  startTime: string;
  endTime: string;
  monthlyFee: string;
  teacherId: string;
  isActive: string;
}

const initialForm: GroupForm = {
  name: "",
  subject: "",
  scheduleDaysText: "",
  startTime: "",
  endTime: "",
  monthlyFee: "",
  teacherId: "",
  isActive: "true",
};

function parseScheduleDays(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function GroupsPage() {
  const router = useRouter();
  const { role } = useRole();
  const canAccess = hasAccess(role, "groups");
  const isOwner = role === "owner";

  const [groups, setGroups] = useState<GroupRecord[]>([]);
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
      setGroups(Array.isArray(data) ? (data as GroupRecord[]) : []);
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
      scheduleDaysText: (group.scheduleDays || []).join(", "),
      startTime: group.startTime || "",
      endTime: group.endTime || "",
      monthlyFee: String(group.monthlyFee ?? ""),
      teacherId: group.teacherId || group.teacher?.id || "",
      isActive: String(Boolean(group.isActive)),
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
        subject: formData.subject.trim() || null,
        scheduleDays: parseScheduleDays(formData.scheduleDaysText),
        startTime: formData.startTime.trim() || null,
        endTime: formData.endTime.trim() || null,
        teacherId: formData.teacherId.trim() || null,
        isActive: formData.isActive === "true",
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
      if (err instanceof ApiClientError && (err.status === 400 || err.status === 409) && err.fieldErrors) {
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
        key: "name",
        header: "Guruh",
        render: (group: GroupRecord) => <span className="font-medium">{group.name || "-"}</span>,
      },
      {
        key: "subject",
        header: "Fan",
        render: (group: GroupRecord) => <span className="text-muted-foreground">{group.subject || "-"}</span>,
      },
      {
        key: "schedule",
        header: "Jadval",
        render: (group: GroupRecord) => (
          <span className="text-muted-foreground">
            {(group.scheduleDays || []).join(", ") || "-"} {group.startTime || ""} {group.endTime ? `- ${group.endTime}` : ""}
          </span>
        ),
      },
      {
        key: "teacher",
        header: "O'qituvchi",
        render: (group: GroupRecord) => (
          <span className="text-muted-foreground">{group.teacher?.fullName || group.teacherId || "-"}</span>
        ),
      },
      {
        key: "monthlyFee",
        header: "Monthly fee",
        render: (group: GroupRecord) => (
          <span className="text-muted-foreground">{group.monthlyFee == null ? "-" : formatCurrency(group.monthlyFee)}</span>
        ),
      },
      {
        key: "isActive",
        header: "Holati",
        render: (group: GroupRecord) => <StatusBadge status={group.isActive ? "active" : "inactive"} />,
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
        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        {isLoading && <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>}

        <DataTable
          data={groups}
          columns={columns}
          searchPlaceholder="Guruh qidirish..."
          addButtonLabel="Guruh qo'shish"
          onAddClick={openCreate}
          showFilters={false}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{formData.id ? "Guruhni tahrirlash" : "Yangi guruh"}</DialogTitle>
            <DialogDescription>Backend contract: subject, scheduleDays, startTime, endTime, teacherId, isActive.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {formError && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{formError}</div>}

            <div className="space-y-1">
              <Label htmlFor="name">Nomi</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="subject">Fan</Label>
              <Input id="subject" value={formData.subject} onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="scheduleDaysText">Schedule days (vergul bilan)</Label>
              <Input id="scheduleDaysText" value={formData.scheduleDaysText} onChange={(e) => setFormData((prev) => ({ ...prev, scheduleDaysText: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="startTime">Start time</Label>
                <Input id="startTime" value={formData.startTime} onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endTime">End time</Label>
                <Input id="endTime" value={formData.endTime} onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))} />
              </div>
            </div>

            {isOwner && (
              <div className="space-y-1">
                <Label htmlFor="monthlyFee">Monthly fee</Label>
                <Input id="monthlyFee" value={formData.monthlyFee} onChange={(e) => setFormData((prev) => ({ ...prev, monthlyFee: e.target.value }))} />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="teacherId">Teacher ID</Label>
              <Input id="teacherId" value={formData.teacherId} onChange={(e) => setFormData((prev) => ({ ...prev, teacherId: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="isActive">Is active (true/false)</Label>
              <Input id="isActive" value={formData.isActive} onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.value }))} />
            </div>

            {Object.keys(fieldErrors).map((key) => (
              <p key={key} className="text-xs text-destructive">{fieldErrors[key]}</p>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Bekor qilish</Button>
            <Button onClick={submitGroup} disabled={isSaving}>
              {isSaving ? <CircleAlert className="mr-2 size-4 animate-spin" /> : null}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
