"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Search, ChevronDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useRole,
  roleLabels,
  roleBadgeStyles,
} from "@/lib-frontend/role-context";
import { authAPI, getApiErrorMessage } from "@/lib-frontend/api-client";
import Link from "next/link";

interface DashboardHeaderProps {
  title: string;
}

export function DashboardHeader({ title }: DashboardHeaderProps) {
  const { role, userName, setUserName, isLoaded } = useRole();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  const [fullName, setFullName] = useState(userName);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!isProfileOpen) {
      return;
    }
    setFullName(userName);
    setProfileError(null);
    setProfileMessage(null);
  }, [isProfileOpen, userName]);

  useEffect(() => {
    const token = sessionStorage.getItem("sangplus_token");
    if (!token) {
      return;
    }

    let cancelled = false;

    authAPI
      .getCurrentUser()
      .then((user) => {
        if (!cancelled && user?.fullName) {
          setUserName(user.fullName);
        }
      })
      .catch(() => {
        // Silent fail: header should stay responsive even if profile fetch fails.
      });

    return () => {
      cancelled = true;
    };
  }, [setUserName]);

  const passwordRulesPassed = useMemo(() => {
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[^A-Za-z\d]/.test(newPassword);
    return newPassword.length >= 8 && hasUpper && hasLower && hasNumber && hasSpecial;
  }, [newPassword]);

  async function handleSaveProfile() {
    setProfileError(null);
    setProfileMessage(null);

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setProfileError("Ism kamida 2 ta belgidan iborat bo'lishi kerak");
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated = await authAPI.updateProfile(trimmedName);
      setUserName(updated.fullName);
      setProfileMessage("Profil ma'lumotlari muvaffaqiyatli yangilandi");
    } catch (error) {
      setProfileError(getApiErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Barcha maydonlarni to'ldiring");
      return;
    }

    if (!passwordRulesPassed) {
      setPasswordError(
        "Yangi parol kamida 8 ta belgi, katta-kichik harf, raqam va maxsus belgi bo'lishi kerak",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Yangi parol va tasdiq paroli bir xil bo'lishi kerak");
      return;
    }

    setIsSavingPassword(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setPasswordMessage("Parol muvaffaqiyatli o'zgartirildi");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(getApiErrorMessage(error));
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>

        <div className="flex items-center gap-4">
          {/* Search - only for owner and manager */}
          {isLoaded && (role === "owner" || role === "manager") && (
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Qidirish..."
                className="w-64 bg-secondary/50 pl-9 border-transparent focus-visible:border-border"
              />
            </div>
          )}

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-5 text-muted-foreground" />
            <span className="absolute right-1 top-1 flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3 px-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                  {userName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="hidden text-left md:block">
                  <p className="text-sm font-medium text-foreground">
                    {userName}
                  </p>
                  <Badge variant="outline" className={roleBadgeStyles[role]}>
                    {roleLabels[role]}
                  </Badge>
                </div>
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mening profilim</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setIsProfileOpen(true);
                }}
              >
                Profil sozlamalari
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setPasswordError(null);
                  setPasswordMessage(null);
                  setIsPasswordOpen(true);
                }}
              >
                Parolni o&apos;zgartirish
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="text-destructive">
                <Link
                  href="/"
                  onClick={() => {
                    sessionStorage.removeItem("sangplus_token");
                    sessionStorage.removeItem("sangplus_role");
                    sessionStorage.removeItem("sangplus_username");
                  }}
                >
                  Chiqish
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profil sozlamalari</DialogTitle>
            <DialogDescription>
              Ismingizni yangilang. Bu nom panelning yuqori qismida ko&apos;rinadi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="fullName">To&apos;liq ism</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Masalan: Akmaljon Karimov"
              maxLength={100}
            />
          </div>

          {profileError && (
            <p className="text-sm text-destructive">{profileError}</p>
          )}
          {profileMessage && (
            <p className="text-sm text-emerald-500">{profileMessage}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsProfileOpen(false)}
              disabled={isSavingProfile}
            >
              Bekor qilish
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saqlanmoqda...
                </>
              ) : (
                "Saqlash"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Parolni o&apos;zgartirish</DialogTitle>
            <DialogDescription>
              Xavfsizlik uchun kuchli yangi parol tanlang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Joriy parol</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Yangi parol</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Yangi parolni tasdiqlang</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Kamida 8 belgi, katta va kichik harf, raqam hamda maxsus belgi bo&apos;lishi kerak.
            </p>
          </div>

          {passwordError && (
            <p className="text-sm text-destructive">{passwordError}</p>
          )}
          {passwordMessage && (
            <p className="text-sm text-emerald-500">{passwordMessage}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPasswordOpen(false)}
              disabled={isSavingPassword}
            >
              Bekor qilish
            </Button>
            <Button onClick={handleChangePassword} disabled={isSavingPassword}>
              {isSavingPassword ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Yangilanmoqda...
                </>
              ) : (
                "Parolni yangilash"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
