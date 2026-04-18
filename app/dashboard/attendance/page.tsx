"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  attendanceAPI,
  extractList,
  getApiErrorMessage,
  groupsAPI,
  lessonsAPI,
} from "@/lib-frontend/api-client";
import { useRole } from "@/lib-frontend/role-context";
import { clearLegacyDashboardCache, cn, toYMD } from "@/lib-frontend/utils";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | null;

const ATTENDANCE_STATUS_MAP: Record<string, Exclude<AttendanceStatus, null>> = {
  PRESENT: "present",
  ABSENT: "absent",
  LATE: "late",
  EXCUSED: "excused",
  present: "present",
  absent: "absent",
  late: "late",
  excused: "excused",
};

const ATTENDANCE_OPTIONS: Array<{
  value: Exclude<AttendanceStatus, null>;
  label: string;
}> = [
  { value: "present", label: "Keldi" },
  { value: "absent", label: "Kelmadi" },
  { value: "late", label: "Kechikdi" },
  { value: "excused", label: "Sababli" },
];

const STATUS_LABELS: Record<Exclude<AttendanceStatus, null>, string> = {
  present: "Keldi",
  absent: "Kelmadi",
  late: "Kechikdi",
  excused: "Sababli",
};

const ATTENDANCE_PILL_STYLES: Record<
  Exclude<AttendanceStatus, null>,
  {
    icon: string;
    activeClassName: string;
  }
> = {
  present: {
    icon: "✅",
    activeClassName:
      "border-[#00C853] bg-[#00C853] text-white shadow-[0_0_0_1px_rgba(0,200,83,0.35),0_0_22px_rgba(0,200,83,0.45)]",
  },
  absent: {
    icon: "❌",
    activeClassName:
      "border-[#FF3B30] bg-[#FF3B30] text-white shadow-[0_0_0_1px_rgba(255,59,48,0.35),0_0_22px_rgba(255,59,48,0.4)]",
  },
  late: {
    icon: "⏰",
    activeClassName:
      "border-[#FFB300] bg-[#FFB300] text-white shadow-[0_0_0_1px_rgba(255,179,0,0.35),0_0_22px_rgba(255,179,0,0.35)]",
  },
  excused: {
    icon: "📋",
    activeClassName:
      "border-[#2979FF] bg-[#2979FF] text-white shadow-[0_0_0_1px_rgba(41,121,255,0.35),0_0_22px_rgba(41,121,255,0.4)]",
  },
};

function normalizeAttendanceStatus(value: unknown): AttendanceStatus {
  if (!value) return null;
  return ATTENDANCE_STATUS_MAP[String(value)] || null;
}

function toApiAttendanceStatus(value: AttendanceStatus) {
  if (!value) return null;
  return value.toUpperCase();
}

interface AttendanceStudent {
  id: string;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
}

interface GroupItem {
  id: string;
  name?: string;
}

interface LessonItem {
  id: string;
  groupId?: string;
  lessonDate?: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = useRole();

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const groupId = searchParams.get("groupId") || "";
  const lessonDate = toYMD(searchParams.get("lessonDate")) || toYMD(new Date());

  const updateParams = (next: { groupId?: string; lessonDate?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextGroupId = next.groupId ?? groupId;
    const nextLessonDate = next.lessonDate ?? lessonDate;

    if (nextGroupId) params.set("groupId", nextGroupId);
    else params.delete("groupId");

    if (nextLessonDate) params.set("lessonDate", toYMD(nextLessonDate));
    else params.delete("lessonDate");

    router.replace(`${pathname}?${params.toString()}`);
  };

  const resolveLessonId = async (): Promise<string> => {
    const lessons = await lessonsAPI.list({
      groupId,
      lessonDate: toYMD(lessonDate),
    });
    const lessonList = extractList<LessonItem>(lessons, ["lessons"]);

    const matched =
      lessonList.find((item) => item.groupId === groupId) || lessonList[0];
    if (matched?.id) return matched.id;

    const created = await lessonsAPI.create({
      groupId,
      lessonDate: toYMD(lessonDate),
    });

    const createdData =
      created && typeof created === "object" && "data" in created
        ? ((created as Record<string, unknown>).data as Record<string, unknown>)
        : created;

    if (createdData && typeof createdData === "object" && "id" in createdData) {
      return String((createdData as Record<string, unknown>).id);
    }

    throw new Error("Lesson yaratib bo'lmadi");
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const groupsData = await groupsAPI.list();
      setGroups(extractList<GroupItem>(groupsData, ["groups"]));

      if (!groupId) {
        setStudents([]);
        return;
      }

      const attendance = await attendanceAPI.list({
        groupId,
        lessonDate: toYMD(lessonDate),
      });
      const attendanceList = extractList<Record<string, unknown>>(attendance, [
        "entries",
        "attendance",
        "students",
      ]);

      setStudents(
        attendanceList.map((item) => {
          const nestedStudent =
            item.student && typeof item.student === "object"
              ? (item.student as Record<string, unknown>)
              : null;
          const nestedName = nestedStudent
            ? String(
                nestedStudent.fullName ||
                  `${nestedStudent.firstName || ""} ${nestedStudent.lastName || ""}`.trim(),
              )
            : "";

          const studentId = String(
            nestedStudent?.id ?? item.studentId ?? item.id ?? "",
          );
          const studentName =
            nestedName || String(item.studentName ?? item.name ?? "Noma'lum");

          return {
            id: String(item.id ?? studentId ?? `${studentName}-attendance`),
            studentId,
            studentName,
            status: normalizeAttendanceStatus(item.status),
          };
        }),
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    clearLegacyDashboardCache();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, lessonDate]);

  const setStatus = (id: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === id ? { ...student, status } : student,
      ),
    );
  };

  const saveAttendance = async () => {
    if (!groupId) {
      setError("Avval guruhni tanlang");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const lessonId = await resolveLessonId();

      const hasUnselected = students.some((student) => !student.status);
      if (hasUnselected) {
        setError("Har bir o'quvchi uchun davomat holatini tanlang");
        setIsSaving(false);
        return;
      }

      await attendanceAPI.create({
        lessonId,
        entries: students.map((student) => ({
          studentId: student.studentId,
          status: toApiAttendanceStatus(student.status),
        })),
      });
      await load();
      setSuccessMessage("Davomat muvaffaqiyatli saqlandi");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const stats = useMemo(
    () => ({
      present: students.filter((student) => student.status === "present")
        .length,
      absent: students.filter((student) => student.status === "absent").length,
      late: students.filter((student) => student.status === "late").length,
      excused: students.filter((student) => student.status === "excused")
        .length,
      total: students.length,
    }),
    [students],
  );

  const completion = useMemo(() => {
    const completed = students.filter(
      (student) => student.status !== null,
    ).length;
    const total = students.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }, [students]);

  const selectedGroupName =
    groups.find((group) => group.id === groupId)?.name || "Guruh tanlanmagan";

  const formattedDate = new Intl.DateTimeFormat("uz-UZ", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(lessonDate));

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

    return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "?";
  };

  return (
    <div className="min-h-screen w-full bg-[#0F1117] text-slate-100">
      <DashboardHeader
        title={role === "teacher" ? "Davomat" : "Davomat boshqaruvi"}
      />

      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 pb-32 sm:space-y-6 sm:px-6 sm:py-6">
        {error && (
          <div className="rounded-xl border border-[#FF3B30]/40 bg-[#FF3B30]/10 p-3 text-sm text-[#FF8A80]">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-[#00C853]/40 bg-[#00C853]/10 p-3 text-sm text-[#7EF9A3]">
            {successMessage}
          </div>
        )}

        {isLoading && <p className="text-sm text-slate-400">Yuklanmoqda...</p>}

        <Card className="border-white/10 bg-[#121725] shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Davomat paneli
                </p>
                <h2 className="mt-1 text-lg sm:text-2xl font-semibold text-white">
                  {selectedGroupName}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  {formattedDate}
                </p>
                <p className="mt-2 text-xs tracking-wide text-slate-500">
                  Belgilanganlar: {completion.completed}/{completion.total}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
                <div className="rounded-xl border border-[#00C853]/35 bg-[#00C853]/10 px-3 sm:px-4 py-2 sm:py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#7EF9A3]">
                    Jami
                  </p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-white">
                    {stats.total}
                  </p>
                </div>
                <div className="rounded-xl border border-[#00C853]/35 bg-[#00C853]/10 px-3 sm:px-4 py-2 sm:py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#7EF9A3]">
                    Keldi
                  </p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-white">
                    {stats.present}
                  </p>
                </div>
                <div className="rounded-xl border border-[#FF3B30]/35 bg-[#FF3B30]/10 px-3 sm:px-4 py-2 sm:py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#FF9C95]">
                    Kelmadi
                  </p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-white">
                    {stats.absent}
                  </p>
                </div>
                <div className="rounded-xl border border-[#FFB300]/35 bg-[#FFB300]/10 px-3 sm:px-4 py-2 sm:py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#FFD54F]">
                    Kechikdi
                  </p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-white">
                    {stats.late}
                  </p>
                </div>
                <div className="rounded-xl border border-[#2979FF]/35 bg-[#2979FF]/10 px-3 sm:px-4 py-2 sm:py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#64B5F6]">
                    Sababli
                  </p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-white">
                    {stats.excused}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>To&apos;ldirish jarayoni</span>
                <span>{completion.percentage}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#0B0F1A]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00C853] via-[#00E676] to-[#7EF9A3] transition-all duration-200 ease-in-out"
                  style={{ width: `${completion.percentage}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  Guruh
                </p>
                <Select
                  value={groupId}
                  onValueChange={(value) => updateParams({ groupId: value })}
                >
                  <SelectTrigger className="h-11 w-full border-white/12 bg-[#0B0F1A] text-slate-100 text-sm transition-all duration-200 ease-in-out hover:border-white/30">
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name || "Noma'lum guruh"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  Dars sanasi
                </p>
                <Input
                  type="date"
                  value={lessonDate}
                  className="h-11 w-full border-white/12 bg-[#0B0F1A] text-slate-100 text-sm transition-all duration-200 ease-in-out hover:border-white/30"
                  onChange={(event) =>
                    updateParams({ lessonDate: event.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#121725]">
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-base sm:text-lg text-white">
              O&apos;quvchilar ro&apos;yxati
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 sm:space-y-3 sm:px-6">
            {students.map((student, index) => (
              <div
                key={student.id}
                className="rounded-2xl border border-white/10 bg-[#0B0F1A] p-3 sm:p-4 transition-all duration-200 ease-in-out hover:border-white/20"
              >
                <div className="flex flex-col gap-3 sm:gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#171D2B] text-xs sm:text-sm font-semibold text-slate-100">
                      {getInitials(student.studentName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">#{index + 1}</p>
                      <p className="text-sm sm:text-base font-medium text-white truncate">
                        {student.studentName}
                      </p>
                      {student.status && (
                        <p className="mt-1 text-xs text-slate-400">
                          Holati: {STATUS_LABELS[student.status]}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    {ATTENDANCE_OPTIONS.map((option) => {
                      const isActive = student.status === option.value;
                      const optionTheme = ATTENDANCE_PILL_STYLES[option.value];

                      return (
                        <button
                          key={`${student.id}-${option.value}`}
                          type="button"
                          onClick={() => setStatus(student.id, option.value)}
                          className={cn(
                            "inline-flex items-center justify-center gap-1 sm:gap-2 rounded-full border px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all duration-200 ease-in-out",
                            isActive
                              ? optionTheme.activeClassName
                              : "border-white/14 bg-transparent text-slate-400 hover:border-white/35 hover:text-slate-200",
                          )}
                          aria-pressed={isActive}
                        >
                          <span className="text-sm">{optionTheme.icon}</span>
                          <span className="hidden sm:inline">
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-30">
          <div className="rounded-2xl border border-[#00C853]/25 bg-[#0F1117]/90 p-3 backdrop-blur-md">
            <Button
              onClick={saveAttendance}
              disabled={isSaving || isLoading}
              className="h-11 sm:h-12 w-full rounded-xl bg-gradient-to-r from-[#00C853] to-[#00E676] text-base font-semibold text-white shadow-[0_12px_32px_rgba(0,200,83,0.34)] transition-all duration-200 ease-in-out hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving
                ? "Saqlanmoqda..."
                : `Davomatni saqlash (${stats.total})`}
            </Button>
            <p className="mt-2 text-center text-xs text-slate-400">
              {completion.completed === completion.total && completion.total > 0
                ? "Hammasi tayyor - saqlash mumkin"
                : "Barcha o'quvchilar uchun holat tanlang"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
