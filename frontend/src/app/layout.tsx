import type { Metadata } from "next";
import "./globals.css";
import { NextAuthProvider } from "@/components/Providers";

export const metadata: Metadata = {
  title: "RoomFit — Hostel Room Allocation",
  description: "Multi-tenant hostel roommate allocation, matched by compatibility.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`bg-stone-50 text-stone-800 min-h-screen antialiased`}>
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
