import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { ProtectedRoute } from "@/lib-frontend/protected-route";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <DashboardSidebar />
        <main className="pl-64">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
