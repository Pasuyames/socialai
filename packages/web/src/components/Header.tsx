"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronRight, LogOut, Settings } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";

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
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#070710]/70 px-8 backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
      />

      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={13} className="text-muted-foreground/50" />}
            <span className={i === crumbs.length - 1
              ? "font-medium text-white"
              : "text-muted-foreground transition-colors hover:text-white"}>
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-white">
          <Bell size={15} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(0,210,255,0.8)]" />
        </button>

        <div className="mx-1 h-5 w-px bg-white/[0.08]" />

        {/* Kullanıcı menüsü */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-white/[0.05]"
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #6C5CE7, #00D2FF)" }}
            >
              {initial}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-medium leading-tight text-white">{displayName}</p>
              <p className={cn(
                "mt-0.5 inline-block rounded-full border px-1.5 text-[10px] capitalize leading-tight",
                planColors[orgPlan] ?? planColors.starter,
              )}>
                {orgPlan}
              </p>
            </div>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0C0C16]/95 py-1.5 shadow-2xl backdrop-blur-xl"
                >
                  <div className="border-b border-white/[0.06] px-4 py-2.5">
                    <p className="truncate text-xs font-medium text-white">{displayName}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{session?.user?.email}</p>
                  </div>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="mt-1 flex w-full items-center gap-2.5 px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    <Settings size={13} />
                    Ayarlar
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <LogOut size={13} />
                    Çıkış Yap
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
