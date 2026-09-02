import type { Metadata } from "next";
import "./globals.css";
import { NextAuthProvider } from "@/components/Providers";

export const metadata: Metadata = {
  title: "SIT Pune Hostel Room Allocation",
  description: "Advanced AI-powered hostel allocation system for SIT Pune students.",
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
