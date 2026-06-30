import prisma from "@/lib/db";
import { Settings, Brain, Activity, Wifi, WifiOff, CheckCircle2, Clock } from "lucide-react";
import { auth } from "@/lib/auth";
import { agentLogOrgWhere } from "@/lib/agentLogScope";

export const dynamic = "force-dynamic";

const agents = [
  { name: "Project Manager",          role: "Yönetim",   status: "aktif",      color: "text-blue-400",   bg: "bg-blue-500/10",    glow: "rgba(59,130,246,0.3)" },
  { name: "Editor-in-Chief",          role: "Yönetim",   status: "aktif",      color: "text-blue-400",   bg: "bg-blue-500/10",    glow: "rgba(59,130,246,0.3)" },
  { name: "Data Miner",               role: "Araştırma",  status: "aktif",      color: "text-emerald-400", bg: "bg-emerald-500/10", glow: "rgba(16,185,129,0.3)" },
  { name: "Brand Strategist",         role: "Araştırma",  status: "aktif",      color: "text-emerald-400", bg: "bg-emerald-500/10", glow: "rgba(16,185,129,0.3)" },
  { name: "Tone of Voice Specialist", role: "Araştırma",  status: "aktif",      color: "text-emerald-400", bg: "bg-emerald-500/10", glow: "rgba(16,185,129,0.3)" },
  { name: "Data Analyst",             role: "Araştırma",  status: "aktif",      color: "text-emerald-400", bg: "bg-emerald-500/10", glow: "rgba(16,185,129,0.3)" },
  { name: "Marketing Director",       role: "İçerik",    status: "aktif",      color: "text-amber-400",  bg: "bg-amber-500/10",   glow: "rgba(245,158,11,0.3)" },
  { name: "Ideation Specialist",      role: "İçerik",    status: "aktif",      color: "text-amber-400",  bg: "bg-amber-500/10",   glow: "rgba(245,158,11,0.3)" },
  { name: "Copywriter",               role: "İçerik",    status: "aktif",      color: "text-amber-400",  bg: "bg-amber-500/10",   glow: "rgba(245,158,11,0.3)" },
  { name: "Engagement Specialist",    role: "İçerik",    status: "aktif",      color: "text-amber-400",  bg: "bg-amber-500/10",   glow: "rgba(245,158,11,0.3)" },
  { name: "Visual Researcher",        role: "Görsel",    status: "aktif",      color: "text-purple-400", bg: "bg-purple-500/10",  glow: "rgba(168,85,247,0.3)" },
  { name: "Prompt Engineer",          role: "Görsel",    status: "aktif",      color: "text-purple-400", bg: "bg-purple-500/10",  glow: "rgba(168,85,247,0.3)" },
  { name: "Image Generator",          role: "Görsel",    status: "aktif",      color: "text-purple-400", bg: "bg-purple-500/10",  glow: "rgba(168,85,247,0.3)" },
  { name: "Visual Inspector",         role: "Görsel",    status: "aktif",      color: "text-purple-400", bg: "bg-purple-500/10",  glow: "rgba(168,85,247,0.3)" },
  { name: "Content Scheduler",        role: "Operasyon", status: "aktif",      color: "text-pink-400",   bg: "bg-pink-500/10",    glow: "rgba(236,72,153,0.3)" },
  { name: "Report Generator",         role: "Operasyon", status: "aktif",      color: "text-pink-400",   bg: "bg-pink-500/10",    glow: "rgba(236,72,153,0.3)" },
  { name: "Client Liaison",           role: "Operasyon", status: "bekliyor",   color: "text-zinc-400",   bg: "bg-zinc-500/10",    glow: "none" },
  { name: "Publisher",                role: "Sistem",    status: "simülasyon", color: "text-zinc-400",   bg: "bg-zinc-500/10",    glow: "none" },
  { name: "Archivist",                role: "Sistem",    status: "aktif",      color: "text-zinc-300",   bg: "bg-zinc-500/10",    glow: "rgba(161,161,170,0.2)" },
];

const apis = [
  { name: "Gemini 2.5 Flash", desc: "Text Generation",  status: true,  color: "text-blue-400" },
  { name: "Imagen 4.0",       desc: "Image Generation", status: true,  color: "text-purple-400" },
  { name: "SQLite / Prisma",  desc: "Database",         status: true,  color: "text-emerald-400" },
  { name: "Instagram API",    desc: "Publisher",        status: false, color: "text-pink-400" },
];

const roleColors: Record<string, string> = {
  "Yönetim":   "text-blue-400",
  "Araştırma": "text-emerald-400",
  "İçerik":    "text-amber-400",
  "Görsel":    "text-purple-400",
  "Operasyon": "text-pink-400",
  "Sistem":    "text-zinc-400",
};

export default async function SettingsPage() {
  // AgentLog org'a göre filtrelenmeli — aksi halde her müşteri tüm sistemin
  // aktivitesini ve toplam sayısını görür (çok-kiracılı sızıntı).
  const session = await auth();
  const orgId   = session?.user ? parseInt((session.user as any).organizationId) : null;
  const scope   = await agentLogOrgWhere(orgId);

  const recentLogs = await prisma.agentLog.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 12 });
  const totalLogs  = await prisma.agentLog.count({ where: scope });

  const grouped = agents.reduce((acc, a) => {
    if (!acc[a.role]) acc[a.role] = [];
    acc[a.role].push(a);
    return acc;
  }, {} as Record<string, typeof agents>);

  const activeCount = agents.filter(a => a.status === "aktif").length;

  return (
    <div className="space-y-7 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center"
          style={{ boxShadow: "0 0 20px rgba(108,92,231,0.2)" }}>
          <Settings size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Sistem & Ajan Kadrosu</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="text-green-400 font-medium">{activeCount}</span> aktif ajan
            <span className="mx-2 text-muted-foreground/40">·</span>
            {totalLogs.toLocaleString()} toplam log
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent roster */}
        <div className="lg:col-span-2 space-y-6">
          {Object.entries(grouped).map(([role, list]) => (
            <div key={role}>
              <p className={`text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${roleColors[role] ?? "text-muted-foreground"}`}>
                <span className="w-4 h-px bg-current opacity-50" />
                {role}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {list.map((agent) => (
                  <div
                    key={agent.name}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#0C0C16] border border-[#1A1A2E] hover:border-[#2A2A3E] transition-all duration-150 group"
                  >
                    <div className={`w-8 h-8 rounded-lg ${agent.bg} flex items-center justify-center shrink-0`}>
                      <Brain size={13} className={agent.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{agent.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{agent.status}</p>
                    </div>
                    <div className="shrink-0">
                      {agent.status === "aktif" ? (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                        </span>
                      ) : agent.status === "simülasyon" ? (
                        <span className="w-2 h-2 rounded-full bg-yellow-400/60 inline-flex" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-zinc-600 inline-flex" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* API status */}
          <div className="rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-5">
            <div className="flex items-center gap-2 mb-5">
              <Activity size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-white">API Bağlantıları</h3>
            </div>
            <div className="space-y-3">
              {apis.map((api) => (
                <div key={api.name} className="flex items-center justify-between p-3 rounded-lg bg-[#0A0A14] border border-[#1A1A2E]">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg bg-[#12121E] flex items-center justify-center`}>
                      {api.status
                        ? <Wifi size={12} className={api.color} />
                        : <WifiOff size={12} className="text-zinc-500" />
                      }
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{api.name}</p>
                      <p className="text-[10px] text-muted-foreground">{api.desc}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                    api.status
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  }`}>
                    {api.status ? "Aktif" : "Pasif"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live logs */}
          <div className="rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="relative w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">Canlı Loglar</h3>
              </div>
              <span className="text-[10px] text-muted-foreground">{totalLogs} toplam</span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentLogs.length > 0 ? recentLogs.map((log) => (
                <div key={log.id} className="p-2.5 rounded-lg bg-[#0A0A14] border border-[#1A1A2E] hover:border-[#2A2A3E] transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-semibold text-accent truncate">{log.agentName}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0 ml-2">
                      <Clock size={9} />
                      {new Date(log.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{log.action}</p>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground text-center py-4">Henüz log yok.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
