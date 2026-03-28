"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { useRole } from "@/lib-frontend/role-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, Users, Play, Save, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib-frontend/utils";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | null;

interface Student {
  id: string;
  name: string;
  status: AttendanceStatus;
}

const mockStudents: Student[] = [
  { id: "1", name: "Aziza Karimova", status: null },
  { id: "2", name: "Bobur Aliyev", status: null },
  { id: "3", name: "Jasur Toshmatov", status: null },
  { id: "4", name: "Malika Rahimova", status: null },
  { id: "5", name: "Sardor Umarov", status: null },
  { id: "6", name: "Dilnoza Yusupova", status: null },
  { id: "7", name: "Akmal Nazarov", status: null },
  { id: "8", name: "Kamola Abdullayeva", status: null },
];

const groups = [
  {
    id: "1",
    name: "Kimyo 101",
    teacher: "Dilshod Karimov",
    time: "09:00 - 10:30",
  },
  {
    id: "2",
    name: "Kimyo 102",
    teacher: "Ulugbek Tursunov",
    time: "14:00 - 15:30",
  },
  {
    id: "3",
    name: "Biologiya 201",
    teacher: "Nilufar Saidova",
    time: "11:00 - 12:30",
  },
  {
    id: "4",
    name: "Biologiya 202",
    teacher: "Nilufar Saidova",
    time: "16:00 - 17:30",
  },
];

const statusConfig = {
  present: {
    label: "Keldi",
    className: "bg-success text-success-foreground hover:bg-success/90",
  },
  absent: {
    label: "Kelmadi",
    className: "bg-destructive text-white hover:bg-destructive/90",
  },
  late: {
    label: "Kechikdi",
    className: "bg-warning text-warning-foreground hover:bg-warning/90",
  },
  excused: {
    label: "Sababli",
    className: "bg-chart-2 text-white hover:bg-chart-2/90",
  },
};

export default function AttendancePage() {
  const { role } = useRole();
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [lessonStarted, setLessonStarted] = useState(false);
  const [students, setStudents] = useState<Student[]>(mockStudents);

  // Teachers see a simpler view focused on their own groups
  const isTeacher = role === "teacher";

  const currentGroup = groups.find((g) => g.id === selectedGroup);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, status: s.status === status ? null : status }
          : s,
      ),
    );
  };

  const handleStartLesson = () => {
    setLessonStarted(true);
  };

  const handleSaveAttendance = () => {
    // Save logic would go here
    alert("Davomat saqlandi!");
  };

  const attendanceStats = {
    present: students.filter((s) => s.status === "present").length,
    absent: students.filter((s) => s.status === "absent").length,
    late: students.filter((s) => s.status === "late").length,
    excused: students.filter((s) => s.status === "excused").length,
    total: students.length,
  };

  return (
    <div className="min-h-screen">
      <DashboardHeader
        title={isTeacher ? "Davomat - Dars sessiyasi" : "Davomat"}
      />

      <div className="p-6 space-y-6">
        {/* Group Selector */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">
              Guruhni tanlang
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="h-12 bg-secondary/50 border-transparent text-base">
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        <div className="flex items-center gap-3">
                          <Users className="size-4 text-muted-foreground" />
                          <span>{group.name}</span>
                          <span className="text-muted-foreground">
                            ({group.time})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentGroup && !lessonStarted && (
                <Button
                  size="lg"
                  onClick={handleStartLesson}
                  className="gap-2 h-12"
                >
                  <Play className="size-5" />
                  Darsni boshlash
                </Button>
              )}
            </div>

            {currentGroup && (
              <div className="mt-6 flex flex-wrap items-center gap-6 rounded-xl bg-secondary/30 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-primary" />
                  <span className="text-muted-foreground">Guruh:</span>
                  <span className="font-medium text-foreground">
                    {currentGroup.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-chart-2" />
                  <span className="text-muted-foreground">Vaqt:</span>
                  <span className="font-medium text-foreground">
                    {currentGroup.time}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-chart-4" />
                  <span className="text-muted-foreground">Sana:</span>
                  <span className="font-medium text-foreground">
                    {new Date().toLocaleDateString("uz-UZ")}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance List */}
        {selectedGroup && lessonStarted && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-success/10 p-4 text-center">
                <p className="text-2xl font-bold text-success">
                  {attendanceStats.present}
                </p>
                <p className="text-sm text-muted-foreground">Keldi</p>
              </div>
              <div className="rounded-xl bg-destructive/10 p-4 text-center">
                <p className="text-2xl font-bold text-destructive">
                  {attendanceStats.absent}
                </p>
                <p className="text-sm text-muted-foreground">Kelmadi</p>
              </div>
              <div className="rounded-xl bg-warning/10 p-4 text-center">
                <p className="text-2xl font-bold text-warning">
                  {attendanceStats.late}
                </p>
                <p className="text-sm text-muted-foreground">Kechikdi</p>
              </div>
              <div className="rounded-xl bg-chart-2/10 p-4 text-center">
                <p className="text-2xl font-bold text-chart-2">
                  {attendanceStats.excused}
                </p>
                <p className="text-sm text-muted-foreground">Sababli</p>
              </div>
            </div>

            {/* Student List */}
            <Card className="rounded-2xl">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-base font-semibold">
                  O&apos;quvchilar ro&apos;yxati ({students.length} ta)
                </CardTitle>
                <Button onClick={handleSaveAttendance} className="gap-2">
                  <Save className="size-4" />
                  Davomatni saqlash
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {students.map((student, index) => (
                    <div
                      key={student.id}
                      className="flex flex-col gap-4 rounded-xl bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-sm font-medium text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                            {student.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <span className="font-medium text-foreground">
                            {student.name}
                          </span>
                        </div>
                        {student.status && (
                          <CheckCircle2 className="size-5 text-success" />
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(statusConfig) as AttendanceStatus[]).map(
                          (status) => {
                            if (!status) return null;
                            const config = statusConfig[status];
                            const isSelected = student.status === status;
                            return (
                              <Button
                                key={status}
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() =>
                                  handleStatusChange(student.id, status)
                                }
                                className={cn(
                                  "min-w-[80px]",
                                  isSelected && config.className,
                                )}
                              >
                                {config.label}
                              </Button>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Empty State */}
        {!selectedGroup && (
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
                <Users className="size-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                Guruhni tanlang
              </h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Davomat belgilash uchun avval guruhni tanlang
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
