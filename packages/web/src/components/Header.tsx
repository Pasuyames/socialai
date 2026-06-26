"use client";

import { usePathname } from "next/navigation";
import { Bell, User, ChevronRight, LogOut, Settings } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/brands":    "Markalar",
  "/plans":     "Planlar",
  "/calendar":  "Takvim",
  "/settings":  "Ayarlar",
  "/support":   "Destek",
};

const planColors: Record<string, string> = {
  starter: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  pro:     "bg-primary/15 text-primary border-primary/20",
  agency:  "bg-accent/15 text-accent border-accent/20",
};

function getBreadcrumb(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let path = "";
  for (const part of parts) {
    path += "/" + part;
    const label = pageTitles[path] ?? (part.match(/^\d+$/) ? `#${part}` : part.charAt(0).toUpperCase() + part.slice(1));
    crumbs.push({ label, href: path });
  }
  return crumbs;
}

export default function Header() {
  const pathname  = usePathname();
  const crumbs    = getBreadcrumb(pathname);
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = session?.user?.name ?? "Yönetici";
  const orgPlan     = (session?.user as any)?.organizationPlan ?? "starter";
  const initial     = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-14 border-b border-[#1A1A2E] bg-[#08080F]/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 sticky top-0 z-10">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={13} className="text-muted-foreground/50" />}
            <span className={i === crumbs.length - 1
              ? "text-white font-medium"
              : "text-muted-foreground hover:text-white transition-colors"}>
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-muted-foreground hover:text-white transition-colors relative">
          <Bell size={15} />
        </button>

        <div className="w-px h-5 bg-[#1A1A2E] mx-1" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.05] transition-colors"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #6C5CE7, #00D2FF)" }}>
              {initial}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium text-white leading-tight">{displayName}</p>
              <p className={`text-[10px] px-1.5 rounded-full border capitalize leading-tight inline-block mt-0.5 ${planColors[orgPlan] ?? planColors.starter}`}>
                {orgPlan}
              </p>
            </div>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 w-48 bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden animate-fade-in">
                <div className="px-4 py-2.5 border-b border-[#1E1E2E]">
                  <p className="text-xs font-medium text-white truncate">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{session?.user?.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-muted-foreground hover:text-white hover:bg-white/[0.04] transition-colors mt-1"
                >
                  <Settings size={13} />
                  Ayarlar
                </button>
                <button
                  onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={13} />
                  Çıkış Yap
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
