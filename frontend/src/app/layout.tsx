import type { Metadata } from "next";
import "./globals.css";
import { NextAuthProvider } from "@/components/Providers";

export const metadata: Metadata = {
  title: "RoomSync — Hostel Room Allocation",
  description: "Advanced AI-powered hostel allocation system for your institution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`bg-slate-950 text-slate-50 min-h-screen antialiased`}>
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}
