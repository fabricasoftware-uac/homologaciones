import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "@/styles/index.css";

export const metadata: Metadata = {
  title: "homologaciones",
  description:
    "Facilitates academic deans in evaluating and approving student credit transfers by comparing external transcripts to internal curricula with clear insights.",
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
          <Sidebar />
          <main className="flex-1 flex flex-col min-w-0">
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-6 md:hidden">
              <span className="font-bold text-slate-900">TransfoEdu</span>
            </header>
            <div className="flex-1 overflow-auto">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
