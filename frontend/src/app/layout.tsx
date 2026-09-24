import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "@/components/Providers";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "RoomFit — Roommates matched by compatibility, not chance",
  description:
    "RoomFit turns a lifestyle questionnaire into roommate groupings that actually get along — multi-tenant hostel allocation, matched by compatibility.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="bg-[#faf9f7] text-stone-800 min-h-screen antialiased">
        <NextAuthProvider>{children}</NextAuthProvider>
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
