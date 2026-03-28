"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  Crown,
  Settings,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib-frontend/utils";
import { useRole, type UserRole } from "@/lib-frontend/role-context";
import { authAPI, getApiErrorMessage } from "@/lib-frontend/api-client";

type LoginRole = "owner" | "manager" | "teacher";

const roles: {
  id: LoginRole;
  label: string;
  icon: typeof Crown;
}[] = [
  { id: "owner", label: "Egasi", icon: Crown },
  {
    id: "manager",
    label: "Manager",
    icon: Settings,
  },
  {
    id: "teacher",
    label: "O'qituvchi",
    icon: BookOpen,
  },
];

function toUserRole(role: string): UserRole {
  const normalized = role.trim().toLowerCase();
  if (normalized === "owner" || normalized === "manager" || normalized === "teacher") {
    return normalized;
  }
  return "manager";
}

export default function LoginPage() {
  const router = useRouter();
  const { setRole, setUserName } = useRole();
  const logoSrc = "/sangplus-logo.png.jpeg";
  const [selectedRole, setSelectedRole] = useState<LoginRole>("owner");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.username.trim()) {
      setError("Foydalanuvchi nomini kiriting");
      return;
    }

    if (!formData.password) {
      setError("Parolni kiriting");
      return;
    }

    if (formData.password.length < 3) {
      setError("Parol kamida 3 ta belgi bo'lishi kerak");
      return;
    }

    setIsLoading(true);

    try {
      // Call backend API
      const response = await authAPI.login(
        formData.username.trim(),
        formData.password,
        selectedRole,
      );

      if (response?.token) {
        sessionStorage.setItem("sangplus_token", response.token);
      }

      const apiRole = toUserRole(response?.user?.role || selectedRole);

      // Store role and username from backend response
      setRole(apiRole);
      setUserName(response?.user?.username || formData.username.trim());

      // Clear form
      setFormData({ username: "", password: "" });

      // Redirect based on role
      if (apiRole === "teacher") {
        router.push("/dashboard/attendance");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

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
          <div className="relative h-36 w-36 sm:h-40 sm:w-40">
            <Image
              src={logoSrc}
              alt="SangPlus CRM logo"
              fill
              className="object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.45)]"
              priority
            />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            SangPlus CRM
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O&apos;quv markazi boshqaruv tizimi
          </p>
        </div>

        {/* Role Selector */}
        <div className="mb-6">
          <p className="mb-3 text-center text-sm text-muted-foreground">
            Rolingizni tanlang
          </p>
          <div className="grid grid-cols-3 gap-3">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
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
                      : "border-transparent bg-secondary/50 hover:bg-secondary",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg transition-all duration-300",
                      isSelected
                        ? "bg-primary text-primary-foreground scale-110"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium transition-colors duration-300",
                      isSelected ? "text-primary" : "text-foreground",
                    )}
                  >
                    {role.label}
                  </span>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 size-3 rounded-full bg-primary animate-in zoom-in-50 duration-200" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* UIVERSE Login Form */}
        <div className="uiverse-input-container">
          <div className="uiverse-input-content">
            <div style={{ padding: "1.2em", width: "100%", zIndex: 80 }}>
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Foydalanuvchi nomi"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="uiverse-input-is"
                    required
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Parol"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="uiverse-input-is"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-300 hover:text-cyan-100 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="uiverse-submit-button"
                  disabled={isLoading}
                  style={{ marginTop: "1em" }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="inline mr-2 size-4 animate-spin" />
                      Kirish...
                    </>
                  ) : (
                    <>Log in</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          &copy; 2026 SangPlus. Barcha huquqlar himoyalangan.
        </p>
      </div>
    </div>
  );
}
