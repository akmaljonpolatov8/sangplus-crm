"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, Eye, EyeOff, Loader2, Crown, Settings, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useRole, type UserRole } from "@/lib/role-context"

type LoginRole = "owner" | "manager" | "teacher"

const roles: { id: LoginRole; label: string; description: string; icon: typeof Crown }[] = [
  { id: "owner", label: "Egasi", description: "To'liq boshqaruv", icon: Crown },
  { id: "manager", label: "Manager", description: "Nazorat va boshqaruv", icon: Settings },
  { id: "teacher", label: "O'qituvchi", description: "Dars va davomat", icon: BookOpen },
]

export default function LoginPage() {
  const router = useRouter()
  const { setRole, setUserName } = useRole()
  const [selectedRole, setSelectedRole] = useState<LoginRole>("owner")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simulate login - set the role and username
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    setRole(selectedRole as UserRole)
    setUserName(formData.username || "Foydalanuvchi")
    
    // Redirect based on role
    if (selectedRole === "teacher") {
      router.push("/dashboard/attendance")
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background decorations */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 size-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 size-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
            <FlaskConical className="size-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">SangPlus CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">O&apos;quv markazi boshqaruv tizimi</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-foreground">Tizimga kirish</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Davom etish uchun ma&apos;lumotlaringizni kiriting
            </p>
          </div>

          {/* Role Selector */}
          <div className="mb-6">
            <p className="mb-3 text-center text-sm text-muted-foreground">Rolingizni tanlang</p>
            <div className="grid grid-cols-3 gap-3">
              {roles.map((role) => {
                const Icon = role.icon
                const isSelected = selectedRole === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all duration-300 ease-out",
                      "border-2 hover:border-primary/50",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                        : "border-transparent bg-secondary/50 hover:bg-secondary"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-lg transition-all duration-300",
                        isSelected
                          ? "bg-primary text-primary-foreground scale-110"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium transition-colors duration-300",
                        isSelected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {role.label}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] leading-tight transition-all duration-300 text-center",
                        isSelected ? "text-primary/80" : "text-muted-foreground"
                      )}
                    >
                      {role.description}
                    </span>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 size-3 rounded-full bg-primary animate-in zoom-in-50 duration-200" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">
                Foydalanuvchi nomi
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Foydalanuvchi nomingizni kiriting"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="h-11 bg-secondary/50 border-transparent focus-visible:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Parol
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Parolingizni kiriting"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="h-11 bg-secondary/50 pr-10 border-transparent focus-visible:border-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Kirish...
                </>
              ) : (
                <>Kirish ({roles.find((r) => r.id === selectedRole)?.label})</>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          &copy; 2026 SangPlus. Barcha huquqlar himoyalangan.
        </p>
      </div>
    </div>
  )
}
