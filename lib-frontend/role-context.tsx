"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type UserRole = "owner" | "manager" | "teacher";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  userName: string;
  setUserName: (name: string) => void;
  isLoaded: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

// Helper to get initial value from sessionStorage (client-side only)
function getInitialRole(): UserRole {
  if (typeof window !== "undefined") {
    const saved = sessionStorage.getItem("sangplus_role") as UserRole | null;
    if (saved) return saved;
  }
  return "owner";
}

function getInitialUserName(): string {
  if (typeof window !== "undefined") {
    const saved = sessionStorage.getItem("sangplus_username");
    if (saved) return saved;
  }
  return "Foydalanuvchi";
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("owner");
  const [userName, setUserNameState] = useState<string>("Foydalanuvchi");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from sessionStorage on mount (client-side only)
  useEffect(() => {
    const savedRole = getInitialRole();
    const savedName = getInitialUserName();
    setRoleState(savedRole);
    setUserNameState(savedName);
    setIsLoaded(true);
  }, []);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    sessionStorage.setItem("sangplus_role", newRole);
  };

  const setUserName = (name: string) => {
    setUserNameState(name);
    sessionStorage.setItem("sangplus_username", name);
  };

  return (
    <RoleContext.Provider
      value={{ role, setRole, userName, setUserName, isLoaded }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}

// Role labels in Uzbek
export const roleLabels: Record<UserRole, string> = {
  owner: "Egasi",
  manager: "Menejer",
  teacher: "O'qituvchi",
};

// Role descriptions in Uzbek
export const roleDescriptions: Record<UserRole, string> = {
  owner: "To'liq boshqaruv",
  manager: "Nazorat va boshqaruv",
  teacher: "Dars va davomat",
};

// Role badge styles
export const roleBadgeStyles: Record<UserRole, string> = {
  owner: "bg-primary/20 text-primary border-primary/30",
  manager: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  teacher: "bg-chart-4/20 text-chart-4 border-chart-4/30",
};

// Check if user has access to a specific feature
export function hasAccess(role: UserRole, feature: string): boolean {
  const accessMap: Record<string, UserRole[]> = {
    dashboard: ["owner", "manager"],
    teachers: ["owner", "manager"],
    students: ["owner", "manager"],
    groups: ["owner", "manager"],
    lessons: ["owner", "manager", "teacher"],
    attendance: ["owner", "manager", "teacher"],
    payments: ["owner", "manager"],
    "payments-amounts": ["owner"], // Only owner can see payment amounts
    "start-lesson": ["teacher"],
  };

  return accessMap[feature]?.includes(role) ?? false;
}
