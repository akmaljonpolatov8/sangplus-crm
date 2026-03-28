"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  attendanceAPI,
  getApiErrorMessage,
  groupsAPI,
  lessonsAPI,
} from "@/lib-frontend/api-client";
import { useRole } from "@/lib-frontend/role-context";
import { toYMD } from "@/lib-frontend/utils";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | null;

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

  const groupId = searchParams.get("groupId") || "";
  const lessonDate = searchParams.get("lessonDate") || toYMD(new Date());

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
    const lessons = await lessonsAPI.list({ groupId, lessonDate: toYMD(lessonDate) });
    const lessonList = Array.isArray(lessons) ? (lessons as LessonItem[]) : [];

    const matched = lessonList.find((item) => item.groupId === groupId) || lessonList[0];
    if (matched?.id) return matched.id;

    const created = await lessonsAPI.create({ groupId, lessonDate: toYMD(lessonDate) });
    if (created && typeof created === "object" && "id" in (created as Record<string, unknown>)) {
      return String((created as Record<string, unknown>).id);
    }

    throw new Error("Lesson yaratib bo'lmadi");
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const groupsData = await groupsAPI.list();
      setGroups(Array.isArray(groupsData) ? (groupsData as GroupItem[]) : []);

      if (!groupId) {
        setStudents([]);
        return;
      }

      const lessonId = await resolveLessonId();
      const attendance = await attendanceAPI.list({ lessonId });
      const attendanceList = Array.isArray(attendance)
        ? (attendance as Array<Record<string, unknown>>)
        : [];

      setStudents(
        attendanceList.map((item) => ({
          id: String(item.id ?? item.studentId ?? `${item.studentName ?? "unknown"}`),
          studentId: String(item.studentId ?? item.id ?? ""),
          studentName: String(item.studentName ?? item.name ?? "Noma'lum"),
          status: (item.status as AttendanceStatus) || null,
        })),
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, lessonDate]);

  const setStatus = (id: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: s.status === status ? null : status } : s)),
    );
  };

  const saveAttendance = async () => {
    if (!groupId) {
      setError("Avval guruhni tanlang");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const lessonId = await resolveLessonId();
      await attendanceAPI.create({
        lessonId,
        entries: students.map((s) => ({
          studentId: s.studentId,
          status: s.status,
        })),
      });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const stats = useMemo(
    () => ({
      present: students.filter((s) => s.status === "present").length,
      absent: students.filter((s) => s.status === "absent").length,
      late: students.filter((s) => s.status === "late").length,
      excused: students.filter((s) => s.status === "excused").length,
      total: students.length,
    }),
    [students],
  );

  return (
    <div className="min-h-screen">
      <DashboardHeader title={role === "teacher" ? "Davomat" : "Davomat boshqaruvi"} />

      <div className="space-y-6 p-6">
        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        {isLoading && <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>}

        <Card>
          <CardHeader>
            <CardTitle>Filterlar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Guruh</Label>
              <Select value={groupId} onValueChange={(value) => updateParams({ groupId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Guruhni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name || "Noma'lum guruh"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>lessonDate (YYYY-MM-DD)</Label>
              <Input type="date" value={lessonDate} onChange={(e) => updateParams({ lessonDate: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card><CardContent className="p-3 text-sm">Jami: {stats.total}</CardContent></Card>
          <Card><CardContent className="p-3 text-sm text-success">Keldi: {stats.present}</CardContent></Card>
          <Card><CardContent className="p-3 text-sm text-destructive">Kelmadi: {stats.absent}</CardContent></Card>
          <Card><CardContent className="p-3 text-sm">Kechikdi: {stats.late}</CardContent></Card>
          <Card><CardContent className="p-3 text-sm">Sababli: {stats.excused}</CardContent></Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>O'quvchilar ro'yxati</CardTitle>
            <Button onClick={saveAttendance} disabled={isSaving || isLoading}>
              {isSaving ? "Saqlanmoqda..." : "Davomatni saqlash"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {students.map((student, index) => (
              <div key={student.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{index + 1}. {student.studentName}</span>
                  <span className="text-xs text-muted-foreground">{student.studentId}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={student.status === "present" ? "default" : "outline"} onClick={() => setStatus(student.id, "present")}>Keldi</Button>
                  <Button size="sm" variant={student.status === "absent" ? "default" : "outline"} onClick={() => setStatus(student.id, "absent")}>Kelmadi</Button>
                  <Button size="sm" variant={student.status === "late" ? "default" : "outline"} onClick={() => setStatus(student.id, "late")}>Kechikdi</Button>
                  <Button size="sm" variant={student.status === "excused" ? "default" : "outline"} onClick={() => setStatus(student.id, "excused")}>Sababli</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
