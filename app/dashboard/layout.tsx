import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { ProtectedRoute } from "@/lib-frontend/protected-route";
import { SidebarProvider } from "@/lib-frontend/sidebar-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="min-h-screen bg-background">
          <DashboardSidebar />
          <main className="w-full lg:pl-64">{children}</main>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
