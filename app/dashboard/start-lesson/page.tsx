"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/header"
import { useRole } from "@/lib/role-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlayCircle, Users, Clock, BookOpen, CheckCircle } from "lucide-react"

const teacherGroups = [
  { id: "1", name: "Kimyo 101", students: 12, time: "09:00 - 10:30", room: "201-xona" },
  { id: "2", name: "Kimyo 102", students: 15, time: "11:00 - 12:30", room: "201-xona" },
  { id: "3", name: "Kimyo 103", students: 10, time: "14:00 - 15:30", room: "203-xona" },
]

export default function StartLessonPage() {
  const router = useRouter()
  const { role, userName } = useRole()
  const [selectedGroup, setSelectedGroup] = useState<string>("")
  const [isStarted, setIsStarted] = useState(false)

  // Only teachers can access this page
  useEffect(() => {
    if (role !== "teacher") {
      router.replace("/dashboard")
    }
  }, [role, router])

  if (role !== "teacher") {
    return null
  }

  const handleStartLesson = () => {
    if (!selectedGroup) return
    setIsStarted(true)
    // In real app, would navigate to attendance page for this group
    setTimeout(() => {
      router.push("/dashboard/attendance")
    }, 1500)
  }

  const selectedGroupData = teacherGroups.find(g => g.id === selectedGroup)

  return (
    <div className="min-h-screen">
      <DashboardHeader title="Darsni boshlash" />

      <div className="p-6 space-y-6">
        {/* Welcome Message */}
        <Card className="rounded-2xl border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/20">
                <BookOpen className="size-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Xush kelibsiz, {userName}!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Darsni boshlash uchun guruhni tanlang
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Group Selection */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Guruhni tanlang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="h-12 bg-secondary/50 border-transparent">
                <SelectValue placeholder="Guruhni tanlang..." />
              </SelectTrigger>
              <SelectContent>
                {teacherGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{group.name}</span>
                      <span className="text-muted-foreground">({group.students} o&apos;quvchi)</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Selected Group Info */}
            {selectedGroupData && (
              <div className="rounded-xl bg-secondary/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Guruh nomi:</span>
                  <span className="font-medium text-foreground">{selectedGroupData.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">O&apos;quvchilar soni:</span>
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <span className="font-medium text-foreground">{selectedGroupData.students} ta</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Dars vaqti:</span>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-chart-2" />
                    <span className="font-medium text-foreground">{selectedGroupData.time}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Xona:</span>
                  <span className="font-medium text-foreground">{selectedGroupData.room}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Start Button */}
        <Button
          onClick={handleStartLesson}
          disabled={!selectedGroup || isStarted}
          className="h-14 w-full text-lg font-semibold gap-3"
        >
          {isStarted ? (
            <>
              <CheckCircle className="size-6" />
              Dars boshlandi!
            </>
          ) : (
            <>
              <PlayCircle className="size-6" />
              Darsni boshlash
            </>
          )}
        </Button>

        {/* Today's Schedule */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Bugungi jadval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teacherGroups.map((group, index) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between rounded-xl bg-secondary/30 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{group.name}</p>
                      <p className="text-sm text-muted-foreground">{group.room}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{group.time}</p>
                    <p className="text-sm text-muted-foreground">{group.students} o&apos;quvchi</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
