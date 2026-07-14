"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Building2, CalendarDays, CalendarClock,
  Settings, Bot, Zap, LifeBuoy, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/brands",    icon: Building2,       label: "Markalar" },
  { href: "/plans",     icon: CalendarDays,    label: "Planlar" },
  { href: "/calendar",  icon: CalendarClock,   label: "Takvim" },
  { href: "/support",   icon: LifeBuoy,        label: "Destek" },
  { href: "/settings",  icon: Settings,        label: "Ayarlar" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative flex min-h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#070710]">
      {/* Dikey ambient parıltı */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent"
      />

      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-5">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "linear-gradient(135deg, #6C5CE7, #00D2FF)",
            boxShadow: "0 0 24px rgba(108,92,231,0.55)",
          }}
        >
          <Zap size={16} className="text-white" />
          <div className="absolute inset-0 rounded-xl bg-white/10" />
        </motion.div>
        <div>
          <h1 className="gradient-text text-sm font-bold tracking-wide">SocialAI</h1>
          <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">Ajans Otomasyonu</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                active ? "text-white" : "text-muted-foreground hover:text-white",
              )}
            >
              {/* Kayan aktif arka plan (layoutId ile sayfalar arası akıcı geçiş) */}
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/20 to-primary/[0.06]"
                  style={{ boxShadow: "0 0 20px -6px rgba(108,92,231,0.5)" }}
                />
              )}
              {!active && (
                <div className="absolute inset-0 rounded-xl bg-white/0 transition-colors duration-200 group-hover:bg-white/[0.04]" />
              )}

              <Icon
                size={17}
                className={cn(
                  "relative z-10 transition-colors duration-200",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-white",
                )}
              />
              <span className="relative z-10">{label}</span>
              {active && (
                <motion.span
                  layoutId="sidebar-active-dot"
                  className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                  style={{ boxShadow: "0 0 8px rgba(108,92,231,0.9)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* AI durum footer */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/10 bg-primary/[0.05] px-3 py-2.5">
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Bot size={13} className="text-primary" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#070710] bg-success">
              <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-70" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium leading-tight text-white">20 Ajan Aktif</p>
            <p className="text-[10px] text-muted-foreground">Micro-Agent v1.0</p>
          </div>
          <Sparkles size={12} className="shrink-0 text-primary/60" />
        </div>
      </div>
    </aside>
  );
}
