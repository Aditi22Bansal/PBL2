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
        {/* K8s rolling-update/rollback demo marker - purely visual proof of
            which image build is currently serving traffic, nothing else
            reads this. See docs/k8s-deployment.md. */}
        <div className="fixed bottom-2 right-2 z-[9999] bg-black/70 text-white text-[10px] font-mono px-2 py-1 rounded-md pointer-events-none">
          v1.1
        </div>
      </body>
    </html>
  );
}
