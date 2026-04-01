"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, UsersRound } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { DataTable } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import {
  extractList,
  getApiErrorMessage,
  groupsAPI,
  studentsAPI,
} from "@/lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";

interface GroupDetail {
  id: string;
  name?: string;
  subject?: string;
  scheduleDays?: string[];
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
  teacher?: {
    id?: string;
    fullName?: string;
  };
}

interface StudentRecord {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  parentName?: string;
  status?: "ACTIVE" | "INACTIVE" | "GRADUATED";
}

function studentStatusToBadge(
  value?: "ACTIVE" | "INACTIVE" | "GRADUATED",
): "active" | "inactive" | "graduated" {
  if (value === "ACTIVE") return "active";
  if (value === "GRADUATED") return "graduated";
  return "inactive";
}

function formatWeekdaysUzbek(days?: string[]): string {
  if (!days || days.length === 0) return "";
  return days.join(", ");
}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { role } = useRole();
  const canAccess = hasAccess(role, "groups");

  const groupId = params?.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!groupId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [groupPayload, studentsPayload] = await Promise.all([
        groupsAPI.get(groupId),
        studentsAPI.list({ groupId }),
      ]);

      setGroup(groupPayload as GroupDetail);
      setStudents(extractList<StudentRecord>(studentsPayload, ["students"]));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard/attendance");
      return;
    }

    loadData();
  }, [canAccess, loadData, router]);

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
        key: "status",
        header: "Holati",
        render: (student: StudentRecord) => (
          <StatusBadge status={studentStatusToBadge(student.status)} />
        ),
      },
    ],
    [],
  );

  if (!canAccess) return null;

  return (
    <div className="min-h-screen">
      <DashboardHeader title={group?.name ? `${group.name} guruhi` : "Guruh"} />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/groups")}
          >
            <ArrowLeft className="mr-2 size-4" />
            Guruhlarga qaytish
          </Button>
          <Button variant="ghost" onClick={loadData}>
            Yangilash
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {group && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Fan / Kurs</p>
              <p className="mt-1 font-medium text-foreground">
                {group.subject || "-"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">O&apos;qituvchi</p>
              <p className="mt-1 font-medium text-foreground">
                {group.teacher?.fullName || "-"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Dars kunlari</p>
              <p className="mt-1 font-medium text-foreground">
                {formatWeekdaysUzbek(group.scheduleDays) || "-"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                O&apos;quvchilar soni
              </p>
              <p className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-foreground">
                <UsersRound className="size-4 text-primary" />
                {students.length}
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        )}

        <DataTable
          data={students}
          columns={columns}
          searchPlaceholder="Guruh ichida o'quvchi qidirish..."
          showFilters={false}
        />
      </div>
    </div>
  );
}
