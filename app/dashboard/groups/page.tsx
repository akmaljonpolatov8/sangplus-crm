"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/header"
import { useRole, hasAccess } from "@/lib/role-context"
import { DataTable } from "@/components/dashboard/data-table"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Trash2, Users, Calendar, Clock } from "lucide-react"

interface Group {
  id: string
  name: string
  teacher: string
  days: string
  time: string
  monthlyFee: string
  students: number
  status: "active" | "inactive"
}

const mockGroups: Group[] = [
  { id: "1", name: "Kimyo 101", teacher: "Dilshod Karimov", days: "Du, Cho, Ju", time: "09:00 - 10:30", monthlyFee: "350,000", students: 12, status: "active" },
  { id: "2", name: "Kimyo 102", teacher: "Ulugbek Tursunov", days: "Se, Pay, Sha", time: "14:00 - 15:30", monthlyFee: "350,000", students: 10, status: "active" },
  { id: "3", name: "Biologiya 201", teacher: "Nilufar Saidova", days: "Du, Cho, Ju", time: "11:00 - 12:30", monthlyFee: "300,000", students: 15, status: "active" },
  { id: "4", name: "Biologiya 202", teacher: "Nilufar Saidova", days: "Se, Pay, Sha", time: "16:00 - 17:30", monthlyFee: "300,000", students: 8, status: "active" },
  { id: "5", name: "Kimyo 103", teacher: "Bekzod Aliyev", days: "Du, Cho, Ju", time: "18:00 - 19:30", monthlyFee: "350,000", students: 6, status: "inactive" },
]

export default function GroupsPage() {
  const router = useRouter()
  const { role } = useRole()
  const [groups] = useState<Group[]>(mockGroups)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    teacher: "",
    days: "",
    time: "",
    monthlyFee: "",
  })

  // Check access
  const canAccess = hasAccess(role, "groups")

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard/attendance")
    }
  }, [canAccess, router])

  if (!canAccess) {
    return null
  }

  const handleAddNew = () => {
    setEditingGroup(null)
    setFormData({ name: "", teacher: "", days: "", time: "", monthlyFee: "" })
    setIsDialogOpen(true)
  }

  const handleEdit = (group: Group) => {
    setEditingGroup(group)
    setFormData({
      name: group.name,
      teacher: group.teacher,
      days: group.days,
      time: group.time,
      monthlyFee: group.monthlyFee,
    })
    setIsDialogOpen(true)
  }

  const columns = [
    {
      key: "name",
      header: "Guruh nomi",
      render: (group: Group) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-chart-4/20">
            <Users className="size-5 text-chart-4" />
          </div>
          <div>
            <span className="font-medium text-foreground">{group.name}</span>
            <p className="text-xs text-muted-foreground">{group.students} ta o&apos;quvchi</p>
          </div>
        </div>
      ),
    },
    {
      key: "teacher",
      header: "O'qituvchi",
      render: (group: Group) => (
        <span className="text-foreground">{group.teacher}</span>
      ),
    },
    {
      key: "days",
      header: "Dars kunlari",
      render: (group: Group) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="size-4" />
          {group.days}
        </div>
      ),
    },
    {
      key: "time",
      header: "Dars vaqti",
      render: (group: Group) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4" />
          {group.time}
        </div>
      ),
    },
    {
      key: "monthlyFee",
      header: "Oylik to'lov",
      render: (group: Group) => (
        <span className="font-medium text-foreground">{group.monthlyFee} so&apos;m</span>
      ),
    },
    {
      key: "status",
      header: "Holati",
      render: (group: Group) => <StatusBadge status={group.status} />,
    },
    {
      key: "actions",
      header: "Amallar",
      className: "text-right",
      render: (group: Group) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(group)}>
                <Pencil className="mr-2 size-4" />
                Tahrirlash
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 size-4" />
                O&apos;chirish
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen">
      <DashboardHeader title="Guruhlar" />

      <div className="p-6">
        <DataTable
          data={groups}
          columns={columns}
          searchPlaceholder="Guruh qidirish..."
          addButtonLabel="Guruh qo'shish"
          onAddClick={handleAddNew}
        />
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Guruhni tahrirlash" : "Yangi guruh qo'shish"}
            </DialogTitle>
            <DialogDescription>
              Guruh ma&apos;lumotlarini kiriting
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Guruh nomi</Label>
              <Input
                id="name"
                placeholder="Masalan: Kimyo 101"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-secondary/50 border-transparent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacher">O&apos;qituvchi</Label>
              <Select
                value={formData.teacher}
                onValueChange={(value) => setFormData({ ...formData, teacher: value })}
              >
                <SelectTrigger className="bg-secondary/50 border-transparent">
                  <SelectValue placeholder="O'qituvchini tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dilshod Karimov">Dilshod Karimov</SelectItem>
                  <SelectItem value="Nilufar Saidova">Nilufar Saidova</SelectItem>
                  <SelectItem value="Ulugbek Tursunov">Ulugbek Tursunov</SelectItem>
                  <SelectItem value="Bekzod Aliyev">Bekzod Aliyev</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="days">Dars kunlari</Label>
                <Select
                  value={formData.days}
                  onValueChange={(value) => setFormData({ ...formData, days: value })}
                >
                  <SelectTrigger className="bg-secondary/50 border-transparent">
                    <SelectValue placeholder="Kunlarni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Du, Cho, Ju">Du, Cho, Ju</SelectItem>
                    <SelectItem value="Se, Pay, Sha">Se, Pay, Sha</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Dars vaqti</Label>
                <Input
                  id="time"
                  placeholder="09:00 - 10:30"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="bg-secondary/50 border-transparent"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyFee">Oylik to&apos;lov (so&apos;m)</Label>
              <Input
                id="monthlyFee"
                placeholder="350,000"
                value={formData.monthlyFee}
                onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                className="bg-secondary/50 border-transparent"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={() => setIsDialogOpen(false)}>
              {editingGroup ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
