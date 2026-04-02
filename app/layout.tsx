import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/toaster";
import { RoleProvider } from "@/lib-frontend/role-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "SangPlus CRM - O'quv markazi boshqaruv tizimi",
  description: "SangPlus o'quv markazi uchun zamonaviy boshqaruv tizimi",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <RoleProvider>
          {children}
          <Toaster />
        </RoleProvider>
        <Analytics />
      </body>
    </html>
  );
}
