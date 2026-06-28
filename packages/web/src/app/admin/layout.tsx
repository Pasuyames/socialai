import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { ShieldCheck, Building2, LifeBuoy, LayoutDashboard, LogOut, ListChecks, Activity } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "superadmin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-[#050508]">
      {/* Admin Sidebar */}
      <aside className="w-56 shrink-0 bg-[#09090F] border-r border-[#1E1E2E] flex flex-col">
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-[#1E1E2E]">
          <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
            <ShieldCheck size={15} className="text-red-400" />
          </div>
          <span className="font-bold text-sm text-white">Admin Panel</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {[
            { href: "/admin",         icon: LayoutDashboard, label: "Genel Bakış" },
            { href: "/admin/orgs",    icon: Building2,       label: "Organizasyonlar" },
            { href: "/admin/tickets", icon: LifeBuoy,        label: "Destek Biletleri" },
            { href: "/admin/activity", icon: Activity,       label: "Aktivite (AgentLog)" },
            { href: "/admin/queues",  icon: ListChecks,     label: "Kuyruklar (Bull-Board)" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-[#1A1A2E] transition-colors">
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-[#1E1E2E]">
          <Link href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-[#1A1A2E] transition-colors">
            <LogOut size={15} />
            Dashboard'a Dön
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
