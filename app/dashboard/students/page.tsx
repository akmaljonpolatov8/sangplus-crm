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
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react"

interface Student {
  id: string
  name: string
  phone: string
  parentPhone: string
  group: string
  status: "active" | "inactive"
}

const mockStudents: Student[] = [
  { id: "1", name: "Aziza Karimova", phone: "+998 90 111 22 33", parentPhone: "+998 90 444 55 66", group: "Kimyo 101", status: "active" },
  { id: "2", name: "Bobur Aliyev", phone: "+998 91 222 33 44", parentPhone: "+998 91 555 66 77", group: "Biologiya 201", status: "active" },
  { id: "3", name: "Jasur Toshmatov", phone: "+998 93 333 44 55", parentPhone: "+998 93 666 77 88", group: "Kimyo 101", status: "active" },
  { id: "4", name: "Malika Rahimova", phone: "+998 94 444 55 66", parentPhone: "+998 94 777 88 99", group: "Biologiya 201", status: "inactive" },
  { id: "5", name: "Sardor Umarov", phone: "+998 95 555 66 77", parentPhone: "+998 95 888 99 00", group: "Kimyo 102", status: "active" },
  { id: "6", name: "Dilnoza Yusupova", phone: "+998 97 666 77 88", parentPhone: "+998 97 999 00 11", group: "Biologiya 202", status: "active" },
  { id: "7", name: "Akmal Nazarov", phone: "+998 99 777 88 99", parentPhone: "+998 99 000 11 22", group: "Kimyo 102", status: "active" },
  { id: "8", name: "Kamola Abdullayeva", phone: "+998 90 888 99 00", parentPhone: "+998 90 111 22 33", group: "Kimyo 101", status: "active" },
]

export default function StudentsPage() {
  const router = useRouter()
  const { role } = useRole()
  const [students] = useState<Student[]>(mockStudents)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    parentPhone: "",
    group: "",
  })

  // Check access
  const canAccess = hasAccess(role, "students")

  useEffect(() => {
    if (!canAccess) {
      router.replace("/dashboard/attendance")
    }
  }, [canAccess, router])

  if (!canAccess) {
    return null
  }

  const handleAddNew = () => {
    setEditingStudent(null)
    setFormData({ name: "", phone: "", parentPhone: "", group: "" })
    setIsDialogOpen(true)
  }

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    setFormData({
      name: student.name,
      phone: student.phone,
      parentPhone: student.parentPhone,
      group: student.group,
    })
    setIsDialogOpen(true)
  }

  const columns = [
    {
      key: "name",
      header: "Ism familiya",
      render: (student: Student) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-chart-2/20 text-sm font-medium text-chart-2">
            {student.name.split(" ").map(n => n[0]).join("")}
          </div>
          <span className="font-medium text-foreground">{student.name}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Telefon",
      render: (student: Student) => (
        <span className="text-muted-foreground">{student.phone}</span>
      ),
    },
    {
      key: "parentPhone",
      header: "Ota-ona raqami",
      render: (student: Student) => (
        <span className="text-muted-foreground">{student.parentPhone}</span>
      ),
    },
    {
      key: "group",
      header: "Guruh",
      render: (student: Student) => (
        <span className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
          {student.group}
        </span>
      ),
    },
    {
      key: "status",
      header: "Holati",
      render: (student: Student) => <StatusBadge status={student.status} />,
    },
    {
      key: "actions",
      header: "Amallar",
      className: "text-right",
      render: (student: Student) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="mr-2 size-4" />
                Ko&apos;rish
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEdit(student)}>
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
      <DashboardHeader title="O'quvchilar" />

      <div className="p-6">
        <DataTable
          data={students}
          columns={columns}
          searchPlaceholder="O'quvchi qidirish..."
          addButtonLabel="O'quvchi qo'shish"
          onAddClick={handleAddNew}
        />
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStudent ? "O'quvchini tahrirlash" : "Yangi o'quvchi qo'shish"}
            </DialogTitle>
            <DialogDescription>
              O&apos;quvchi ma&apos;lumotlarini kiriting
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
              <Label htmlFor="parentPhone">Ota-ona telefon raqami</Label>
              <Input
                id="parentPhone"
                placeholder="+998 XX XXX XX XX"
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                className="bg-secondary/50 border-transparent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group">Guruh</Label>
              <Select
                value={formData.group}
                onValueChange={(value) => setFormData({ ...formData, group: value })}
              >
                <SelectTrigger className="bg-secondary/50 border-transparent">
                  <SelectValue placeholder="Guruhni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kimyo 101">Kimyo 101</SelectItem>
                  <SelectItem value="Kimyo 102">Kimyo 102</SelectItem>
                  <SelectItem value="Biologiya 201">Biologiya 201</SelectItem>
                  <SelectItem value="Biologiya 202">Biologiya 202</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={() => setIsDialogOpen(false)}>
              {editingStudent ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
