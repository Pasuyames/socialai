"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2, CalendarDays, FileText, CheckCircle2, Activity, Clock,
  Loader2, ListChecks, CheckCheck, AlertTriangle, Cpu, Coins, ArrowUpRight,
  Sparkles, ImageIcon,
} from "lucide-react";
import { BentoGrid, BentoCard } from "@/components/ui/Bento";
import { AnimatedCounter, paraOndaligi } from "@/components/dashboard/AnimatedCounter";
import { StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface CockpitData {
  stats: { brands: number; plans: number; posts: number; approved: number };
  queue: {
    waiting: number; active: number; completed: number; failed: number;
    delayed: number; ok: boolean;
  };
  langfuse: { totalTokens: number; totalCostUsd: number; traces: number; fromDate: string } | null;
  logs: { id: number; agentName: string; action: string; createdAt: string }[];
  content: {
    id: number; brandName: string; topic: string; status: string;
    imagePath: string | null; scheduledAt: string | null;
  }[];
}

// ─── Ajan renk haritası (timeline rozetleri) ────────────────────────────────────

function agentAccent(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("visual") || n.includes("image") || n.includes("görsel")) return "168 85 247";
  if (n.includes("writer") || n.includes("content") || n.includes("copy"))  return "245 158 11";
  if (n.includes("editor") || n.includes("manager") || n.includes("pm"))    return "59 130 246";
  if (n.includes("data") || n.includes("research") || n.includes("brand"))  return "16 185 129";
  return "108 92 231";
}

// ─── Ana kokpit ─────────────────────────────────────────────────────────────────

export function DashboardCockpit({ data }: { data: CockpitData }) {
  const { stats, queue, langfuse, logs, content } = data;

  const statTiles = [
    { label: "Toplam Marka", value: stats.brands,   icon: Building2,    glow: "108 92 231", href: "/brands" },
    { label: "Aktif Plan",   value: stats.plans,    icon: CalendarDays, glow: "0 210 255",  href: "/plans" },
    { label: "Toplam İçerik", value: stats.posts,   icon: FileText,     glow: "236 72 153", href: "/plans" },
    { label: "Onaylanan",    value: stats.approved, icon: CheckCircle2, glow: "0 230 118",  href: "/plans" },
  ];

  const queueMetrics = [
    { label: "Bekleyen",   value: queue.waiting,   icon: ListChecks, glow: "148 163 184", pulse: false },
    { label: "İşleniyor",  value: queue.active,    icon: Loader2,    glow: "0 210 255",   pulse: queue.active > 0 },
    { label: "Tamamlanan", value: queue.completed, icon: CheckCheck, glow: "0 230 118",   pulse: false },
    { label: "Başarısız",  value: queue.failed,    icon: AlertTriangle, glow: "255 82 82", pulse: false },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Başlık */}
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-success/80">
              Sistem Çevrimiçi
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Ajans Kokpiti</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Üretim hattının nabzı — kuyruk, ajanlar ve maliyet tek ekranda
          </p>
        </div>
        <Link href="/brands/new">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-xl border border-primary/30 bg-gradient-to-r from-primary to-[#8b7cf0] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(108,92,231,0.7)]"
          >
            <Sparkles size={15} />
            Yeni Marka
          </motion.button>
        </Link>
      </div>

      {/* Üst şerit — 4 istatistik */}
      <BentoGrid>
        {statTiles.map((t) => (
          <BentoCard key={t.label} glow={t.glow} className="p-5">
            <Link href={t.href} className="block">
              <div className="mb-4 flex items-start justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: `rgb(${t.glow} / 0.12)` }}
                >
                  <t.icon size={18} style={{ color: `rgb(${t.glow})` }} />
                </div>
                <ArrowUpRight size={14} className="text-muted-foreground/40 transition-colors group-hover:text-white" />
              </div>
              <p className="text-3xl font-bold text-white">
                <AnimatedCounter value={t.value} />
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{t.label}</p>
            </Link>
          </BentoCard>
        ))}
      </BentoGrid>

      {/* Ana bento — kuyruk kokpiti + maliyet */}
      <BentoGrid className="lg:grid-cols-3">
        {/* BullMQ kuyruk kokpiti (geniş) */}
        <BentoCard glow="0 210 255" interactive={false} className="p-6 sm:col-span-2 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu size={16} className="text-accent" />
              <h3 className="text-sm font-semibold text-white">Üretim Kuyruğu</h3>
              <span className="text-[11px] text-muted-foreground">BullMQ · Redis</span>
            </div>
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                queue.ok
                  ? "border-success/20 bg-success/10 text-success"
                  : "border-danger/20 bg-danger/10 text-danger",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", queue.ok ? "bg-success" : "bg-danger")} />
              {queue.ok ? "Bağlı" : "Bağlantı yok"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {queueMetrics.map((m) => (
              <div
                key={m.label}
                className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <m.icon
                    size={14}
                    className={m.pulse ? "animate-spin" : ""}
                    style={{ color: `rgb(${m.glow})` }}
                  />
                  {m.pulse && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-white">
                  <AnimatedCounter value={m.value} />
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{m.label}</p>
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-6 -right-6 h-16 w-16 rounded-full opacity-20 blur-2xl"
                  style={{ background: `rgb(${m.glow})` }}
                />
              </div>
            ))}
          </div>

          {queue.delayed > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              + {queue.delayed} gecikmeli iş (yeniden deneme sırasında)
            </p>
          )}
        </BentoCard>

        {/* Langfuse maliyet / token */}
        <BentoCard glow="245 158 11" className="p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <Coins size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Gözlemlenebilirlik</h3>
          </div>

          {langfuse ? (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Maliyet (7g)</p>
                {/* Ondalık uyarlanabilir: sabit 2 basamakta $0,0000101 gibi
                    gerçek LLM maliyetleri "$0,00" görünüyordu (bkz. paraOndaligi). */}
                <p className="text-3xl font-bold text-white">
                  <AnimatedCounter
                    value={langfuse.totalCostUsd}
                    decimals={paraOndaligi(langfuse.totalCostUsd)}
                    prefix="$"
                  />
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-lg font-bold text-white">
                    <AnimatedCounter value={langfuse.totalTokens} />
                  </p>
                  <p className="text-[10px] text-muted-foreground">Token</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-lg font-bold text-white">
                    <AnimatedCounter value={langfuse.traces} />
                  </p>
                  <p className="text-[10px] text-muted-foreground">İz (trace)</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[140px] flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
                <Coins size={16} className="text-amber-400/70" />
              </div>
              <p className="text-xs text-muted-foreground">
                Langfuse metrikleri bağlı değil
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                LANGFUSE_* anahtarları ayarlandığında maliyet burada görünür
              </p>
            </div>
          )}
        </BentoCard>
      </BentoGrid>

      {/* Alt bento — ajan aktivitesi + son içerikler */}
      <BentoGrid className="lg:grid-cols-3">
        {/* Ajan aktivite akışı */}
        <BentoCard glow="108 92 231" interactive={false} className="p-6 sm:col-span-2 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-white">Ajan Aktiviteleri</h3>
            </div>
            <span className="rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              Canlı
            </span>
          </div>

          {logs.length > 0 ? (
            <div className="relative space-y-1">
              {/* Dikey timeline çizgisi */}
              <div aria-hidden className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-primary/40 via-white/[0.06] to-transparent" />
              {logs.map((log, i) => {
                const accent = agentAccent(log.agentName);
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="group relative flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <div
                      className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        background: `rgb(${accent} / 0.12)`,
                        borderColor: `rgb(${accent} / 0.25)`,
                      }}
                    >
                      <Activity size={12} style={{ color: `rgb(${accent})` }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-white">{log.agentName}</p>
                        <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground/60">
                          <Clock size={9} />
                          {new Date(log.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{log.action}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <Activity size={22} className="mb-2 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">Henüz aktivite yok</p>
            </div>
          )}
        </BentoCard>

        {/* Son içerikler / galeri */}
        <BentoCard glow="236 72 153" interactive={false} className="p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <ImageIcon size={16} className="text-pink-400" />
            <h3 className="text-sm font-semibold text-white">Son İçerikler</h3>
          </div>

          {content.length > 0 ? (
            <div className="space-y-2">
              {content.map((post) => (
                <Link
                  key={post.id}
                  href="/plans"
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-white/[0.12]"
                >
                  {post.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.imagePath} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-white/[0.08] object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                      <FileText size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">{post.brandName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{post.topic}</p>
                    <div className="mt-1"><StatusBadge status={post.status} /></div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <ImageIcon size={22} className="mb-2 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">İçerik üretildiğinde burada görünür</p>
            </div>
          )}
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
