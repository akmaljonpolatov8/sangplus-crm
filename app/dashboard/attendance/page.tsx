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
} from "@/lib-frontend/api-client";
import { useRole } from "@/lib-frontend/role-context";
import { toYMD } from "@/lib-frontend/utils";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | null;

interface AttendanceStudent {
  id: string;
  studentId?: string | null;
  studentName?: string | null;
  name?: string | null;
  status: AttendanceStatus;
}

interface GroupItem {
  id: string;
  name?: string | null;
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

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [groupsData, attendanceData] = await Promise.all([
        groupsAPI.list(),
        attendanceAPI.list({
          groupId: groupId || undefined,
          lessonDate: lessonDate || undefined,
        }),
      ]);

      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setStudents(
        Array.isArray(attendanceData)
          ? attendanceData.map((item) => ({
              id: String(item.id ?? item.studentId ?? crypto.randomUUID()),
              studentId: item.studentId || null,
              studentName: item.studentName || item.name || null,
              name: item.name || item.studentName || null,
              status: item.status || null,
            }))
          : [],
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
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === status ? null : status } : s,
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

    try {
      await attendanceAPI.create({
        groupId,
        lessonDate: toYMD(lessonDate),
        entries: students.map((s) => ({
          studentId: s.studentId || s.id,
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
      <DashboardHeader
        title={role === "teacher" ? "Davomat" : "Davomat boshqaruvi"}
      />

      <div className="space-y-6 p-6">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Filterlar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Guruh</Label>
              <Select
                value={groupId}
                onValueChange={(value) => updateParams({ groupId: value })}
              >
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
              <Input
                type="date"
                value={lessonDate}
                onChange={(e) => updateParams({ lessonDate: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card>
            <CardContent className="p-3 text-sm">
              Jami: {stats.total}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-sm text-success">
              Keldi: {stats.present}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-sm text-destructive">
              Kelmadi: {stats.absent}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-sm">
              Kechikdi: {stats.late}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-sm">
              Sababli: {stats.excused}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>O'quvchilar ro'yxati</CardTitle>
            <Button onClick={saveAttendance} disabled={isSaving || isLoading}>
              {isSaving ? "Saqlanmoqda..." : "Davomatni saqlash"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {students.map((student, i) => (
              <div key={student.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">
                    {i + 1}. {student.studentName || student.name || "Noma'lum"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {student.studentId || "-"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={
                      student.status === "present" ? "default" : "outline"
                    }
                    onClick={() => setStatus(student.id, "present")}
                  >
                    Keldi
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      student.status === "absent" ? "default" : "outline"
                    }
                    onClick={() => setStatus(student.id, "absent")}
                  >
                    Kelmadi
                  </Button>
                  <Button
                    size="sm"
                    variant={student.status === "late" ? "default" : "outline"}
                    onClick={() => setStatus(student.id, "late")}
                  >
                    Kechikdi
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      student.status === "excused" ? "default" : "outline"
                    }
                    onClick={() => setStatus(student.id, "excused")}
                  >
                    Sababli
                  </Button>
                </div>
              </div>
            ))}

            {!isLoading && students.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Davomat ma'lumotlari topilmadi
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
