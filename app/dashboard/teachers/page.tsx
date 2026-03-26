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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

interface Teacher {
  id: string
  name: string
  phone: string
  subject: string
  status: "active" | "inactive"
  groups: number
}

const mockTeachers: Teacher[] = [
  { id: "1", name: "Dilshod Karimov", phone: "+998 90 123 45 67", subject: "Kimyo", status: "active", groups: 4 },
  { id: "2", name: "Nilufar Saidova", phone: "+998 91 234 56 78", subject: "Biologiya", status: "active", groups: 3 },
  { id: "3", name: "Ulugbek Tursunov", phone: "+998 93 345 67 89", subject: "Kimyo", status: "active", groups: 5 },
  { id: "4", name: "Madina Rahimova", phone: "+998 94 456 78 90", subject: "Biologiya", status: "inactive", groups: 0 },
  { id: "5", name: "Bekzod Aliyev", phone: "+998 95 567 89 01", subject: "Kimyo", status: "active", groups: 2 },
]

export default function TeachersPage() {
  const router = useRouter()
  const { role } = useRole()
  const [teachers] = useState<Teacher[]>(mockTeachers)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    subject: "",
  })

  // Check access
  const canAccess = hasAccess(role, "teachers")

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard/attendance")
    }
  }, [canAccess, router])

  if (!canAccess) {
    return null
  }

  const handleAddNew = () => {
    setEditingTeacher(null)
    setFormData({ name: "", phone: "", subject: "" })
    setIsDialogOpen(true)
  }

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher)
    setFormData({
      name: teacher.name,
      phone: teacher.phone,
      subject: teacher.subject,
    })
    setIsDialogOpen(true)
  }

  const columns = [
    {
      key: "name",
      header: "Ism familiya",
      render: (teacher: Teacher) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
            {teacher.name.split(" ").map(n => n[0]).join("")}
          </div>
          <span className="font-medium text-foreground">{teacher.name}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Telefon raqami",
      render: (teacher: Teacher) => (
        <span className="text-muted-foreground">{teacher.phone}</span>
      ),
    },
    {
      key: "subject",
      header: "Fan",
      render: (teacher: Teacher) => (
        <span className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
          {teacher.subject}
        </span>
      ),
    },
    {
      key: "groups",
      header: "Guruhlar",
      render: (teacher: Teacher) => (
        <span className="text-muted-foreground">{teacher.groups} ta guruh</span>
      ),
    },
    {
      key: "status",
      header: "Holati",
      render: (teacher: Teacher) => <StatusBadge status={teacher.status} />,
    },
    {
      key: "actions",
      header: "Amallar",
      className: "text-right",
      render: (teacher: Teacher) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(teacher)}>
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
      <DashboardHeader title="O'qituvchilar" />

      <div className="p-6">
        <DataTable
          data={teachers}
          columns={columns}
          searchPlaceholder="O'qituvchi qidirish..."
          addButtonLabel="O'qituvchi qo'shish"
          onAddClick={handleAddNew}
        />
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTeacher ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi qo'shish"}
            </DialogTitle>
            <DialogDescription>
              O&apos;qituvchi ma&apos;lumotlarini kiriting
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Ism familiya</Label>
              <Input
                id="name"
                placeholder="Ism familiyani kiriting"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-secondary/50 border-transparent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon raqami</Label>
              <Input
                id="phone"
                placeholder="+998 XX XXX XX XX"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-secondary/50 border-transparent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Fan</Label>
              <Select
                value={formData.subject}
                onValueChange={(value) => setFormData({ ...formData, subject: value })}
              >
                <SelectTrigger className="bg-secondary/50 border-transparent">
                  <SelectValue placeholder="Fanni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kimyo">Kimyo</SelectItem>
                  <SelectItem value="Biologiya">Biologiya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={() => setIsDialogOpen(false)}>
              {editingTeacher ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
