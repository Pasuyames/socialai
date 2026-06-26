"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, CalendarDays, CalendarClock, Settings, Bot, Zap, LifeBuoy, Sparkles } from "lucide-react";

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
    <aside className="w-64 border-r border-[#1A1A2E] bg-[#08080F] min-h-screen flex flex-col shrink-0 relative">
      {/* Subtle top glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#1A1A2E]">
        <div className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #6C5CE7, #00D2FF)", boxShadow: "0 0 20px rgba(108,92,231,0.5)" }}>
          <Zap size={16} className="text-white" />
          <div className="absolute inset-0 rounded-xl bg-white/10" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wide gradient-text">SocialAI</h1>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Ajans Otomasyonu</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group overflow-hidden ${
                active
                  ? "text-white"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              {/* Active background */}
              {active && (
                <div className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl" />
              )}
              {/* Hover background */}
              {!active && (
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.04] rounded-xl transition-colors duration-200" />
              )}

              <Icon
                size={17}
                className={`relative z-10 transition-colors duration-200 ${
                  active ? "text-primary" : "text-muted-foreground group-hover:text-white"
                }`}
              />
              <span className="relative z-10">{label}</span>
              {active && (
                <span className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                  style={{ boxShadow: "0 0 6px rgba(108,92,231,0.8)" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* AI status footer */}
      <div className="p-3 border-t border-[#1A1A2E]">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/10">
          <div className="relative w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Bot size={13} className="text-primary" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-[#08080F]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white leading-tight">20 Ajan Aktif</p>
            <p className="text-[10px] text-muted-foreground">Micro-Agent v1.0</p>
          </div>
          <Sparkles size={12} className="text-primary/60 shrink-0" />
        </div>
      </div>
    </aside>
  );
}
