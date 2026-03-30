"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "./role-context";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "owner" | "manager" | "teacher";
}

export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { role, isLoaded } = useRole();

  useEffect(() => {
    if (!isLoaded) return;

    // Check if user is authenticated (has token)
    const token = sessionStorage.getItem("sangplus_token");

    if (!token) {
      // Redirect to login if no token
      router.push("/");
      return;
    }

    // Check role-based access if required
    if (requiredRole && role !== requiredRole) {
      // Redirect to appropriate dashboard based on role
      if (role === "teacher") {
        router.push("/dashboard/attendance");
      } else {
        router.push("/dashboard");
      }
    }
  }, [isLoaded, role, router, requiredRole]);

  // Don't render anything until auth is checked
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      </div>
    );
  }

  // Check if user has valid token
  const token = sessionStorage.getItem("sangplus_token");
  if (!token) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
