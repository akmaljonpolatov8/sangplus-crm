"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { DataTable } from "@/components/dashboard/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage, lessonsAPI } from "../../../lib-frontend/api-client";
import { hasAccess, useRole } from "@/lib-frontend/role-context";
import { toYMD } from "@/lib-frontend/utils";

interface Lesson {
  id: string;
  group?: { name?: string | null };
  teacher?: { fullName?: string | null };
  groupName?: string | null;
  teacherName?: string | null;
  lessonDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  room?: string | null;
  status?: string | null;
}

export default function LessonsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = useRole();
  const canAccess = hasAccess(role, "lessons");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lessonDate = searchParams.get("lessonDate") || toYMD(new Date());

  const setLessonDate = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("lessonDate", toYMD(value));
    else params.delete("lessonDate");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const loadLessons = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await lessonsAPI.list({ lessonDate });
      const list = Array.isArray(data) ? data : [];
      setLessons(
        list.map((item: Lesson) => ({
          ...item,
          groupName: item.groupName || item.group?.name || "-",
          teacherName: item.teacherName || item.teacher?.fullName || "-",
        })),
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard");
      return;
    }
    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, lessonDate]);

  if (!canAccess) return null;

  const columns = [
    {
      key: "groupName",
      header: "Guruh",
      render: (lesson: Lesson) => lesson.groupName || "-",
    },
    {
      key: "teacherName",
      header: "O'qituvchi",
      render: (lesson: Lesson) => lesson.teacherName || "-",
    },
    {
      key: "lessonDate",
      header: "Sana",
      render: (lesson: Lesson) => toYMD(lesson.lessonDate) || "-",
    },
    {
      key: "time",
      header: "Vaqt",
      render: (lesson: Lesson) =>
        lesson.startTime || lesson.endTime
          ? `${lesson.startTime || "--:--"} - ${lesson.endTime || "--:--"}`
          : "-",
    },
    {
      key: "room",
      header: "Xona",
      render: (lesson: Lesson) => lesson.room || "-",
    },
    {
      key: "status",
      header: "Holat",
      render: (lesson: Lesson) => lesson.status || "-",
    },
  ];

  return (
    <div className="min-h-screen">
      <DashboardHeader title="Darslar" />

      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="grid gap-2 p-4 md:max-w-sm">
            <Label htmlFor="lessonDate">lessonDate (YYYY-MM-DD)</Label>
            <Input
              id="lessonDate"
              type="date"
              value={lessonDate}
              onChange={(e) => setLessonDate(e.target.value)}
            />
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        )}

        <DataTable
          data={lessons}
          columns={columns}
          searchPlaceholder="Dars qidirish..."
          showFilters={false}
        />

        {!isLoading && lessons.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Darslar topilmadi
          </p>
        )}
      </div>
    </div>
  );
}
