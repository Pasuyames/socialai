import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db";
import { Activity, Filter, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { AutoRefresh } from "./AutoRefresh";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Durum artık AgentLog.status kolonundan geliyor (metin türetme yok).
// Geçerli değerler: SUCCESS | FAILED | NEEDS_HUMAN | INFO
const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: typeof XCircle }> = {
  FAILED:      { label: "Başarısız",     cls: "bg-red-500/15 text-red-400 border-red-500/30",       Icon: XCircle },
  NEEDS_HUMAN: { label: "İnsan Gerekli", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", Icon: AlertTriangle },
  SUCCESS:     { label: "Başarılı",      cls: "bg-green-500/15 text-green-400 border-green-500/30", Icon: CheckCircle2 },
  INFO:        { label: "Bilgi",         cls: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",    Icon: Info },
};

type SP = Record<string, string | undefined>;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SP> }) {
  // ── GÜVENLİK: tavizsiz superadmin ───────────────────────────────────────────
  const session = await auth();
  if ((session?.user as any)?.role !== "superadmin") redirect("/dashboard");

  const sp = await searchParams;
  const brandId = sp.brand ? parseInt(sp.brand) : undefined;
  const agent   = sp.agent ?? "";
  const status  = sp.status ?? "";
  const q       = sp.q ?? "";
  const page    = Math.max(1, parseInt(sp.page ?? "1") || 1);

  // ── Filtre seçenekleri (dropdown verileri) ──────────────────────────────────
  const [brands, agentRows] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.agentLog.findMany({ distinct: ["agentName"], select: { agentName: true }, orderBy: { agentName: "asc" } }),
  ]);

  // ── WHERE inşası (AND ile birleşik filtreler) ───────────────────────────────
  const and: any[] = [];
  if (agent) and.push({ agentName: agent });
  if (q)     and.push({ action: { contains: q } });
  // Durum filtresi artık doğrudan kolon üzerinden (hızlı, index'li)
  if (status && STATUS_BADGE[status]) and.push({ status });
  if (brandId && !isNaN(brandId)) {
    // Marka logları doğrudan (Brand) + plan/post id'leri üzerinden (Plan/Post)
    const [plans, posts] = await Promise.all([
      prisma.monthlyPlan.findMany({ where: { brandId }, select: { id: true } }),
      prisma.post.findMany({ where: { plan: { brandId } }, select: { id: true } }),
    ]);
    and.push({
      OR: [
        { targetType: "Brand", targetId: brandId },
        { targetType: "Plan", targetId: { in: plans.map((p) => p.id) } },
        { targetType: "Post", targetId: { in: posts.map((p) => p.id) } },
      ],
    });
  }
  const where = and.length ? { AND: and } : {};

  // ── Veri (sayfalı — tüm DB çekilmez) ────────────────────────────────────────
  const [total, logs] = await Promise.all([
    prisma.agentLog.count({ where }),
    prisma.agentLog.findMany({
      where,
      orderBy: { id: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Sayfalama linki için mevcut filtreleri koru
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (brandId) params.set("brand", String(brandId));
    if (agent)  params.set("agent", agent);
    if (status) params.set("status", status);
    if (q)      params.set("q", q);
    params.set("page", String(p));
    return `/admin/activity?${params.toString()}`;
  };

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
          <Activity size={18} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Aktivite Akışı (AgentLog)</h1>
          <p className="text-xs text-muted-foreground">Tüm ajan eylemleri — canlı denetim izi</p>
        </div>
        {/* Otomatik yenileme — varsayılan KAPALI (denetim ekranı okunurken
            listenin altından kayması istenmez), sekme arka plandayken durur. */}
        <div className="ml-auto">
          <AutoRefresh />
        </div>
      </div>

      {/* Filtre barı (native GET form — page param yok → filtre değişince sayfa 1'e döner) */}
      <form method="get" className="flex flex-wrap items-end gap-3 bg-[#0C0C14] border border-[#1E1E2E] rounded-xl p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <Filter size={14} /> Filtre
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Marka
          <select name="brand" defaultValue={brandId ? String(brandId) : ""}
            className="bg-[#111119] border border-[#26263A] rounded-md px-2.5 py-1.5 text-sm text-white min-w-[140px]">
            <option value="">Tümü</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Ajan
          <select name="agent" defaultValue={agent}
            className="bg-[#111119] border border-[#26263A] rounded-md px-2.5 py-1.5 text-sm text-white min-w-[180px]">
            <option value="">Tümü</option>
            {agentRows.map((a) => <option key={a.agentName} value={a.agentName}>{a.agentName}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Durum
          <select name="status" defaultValue={status}
            className="bg-[#111119] border border-[#26263A] rounded-md px-2.5 py-1.5 text-sm text-white min-w-[130px]">
            <option value="">Tümü</option>
            <option value="FAILED">Başarısız</option>
            <option value="NEEDS_HUMAN">İnsan Gerekli</option>
            <option value="SUCCESS">Başarılı</option>
            <option value="INFO">Bilgi</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground flex-1 min-w-[160px]">
          Ara (eylem metni)
          <input name="q" defaultValue={q} placeholder="örn: görsel, prompt, hata..."
            className="bg-[#111119] border border-[#26263A] rounded-md px-2.5 py-1.5 text-sm text-white" />
        </label>

        <button type="submit"
          className="bg-accent/90 hover:bg-accent text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors">
          Uygula
        </button>
        <Link href="/admin/activity"
          className="text-xs text-muted-foreground hover:text-white px-2 py-1.5">Temizle</Link>
      </form>

      {/* Özet */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Toplam <span className="text-white font-medium">{total.toLocaleString("tr-TR")}</span> kayıt</span>
        <span>Sayfa {page} / {totalPages}</span>
      </div>

      {/* Tablo */}
      <div className="bg-[#0C0C14] border border-[#1E1E2E] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-[#1E1E2E] bg-[#101019]">
              <th className="px-4 py-2.5 font-medium w-[120px]">Zaman</th>
              <th className="px-4 py-2.5 font-medium w-[110px]">Durum</th>
              <th className="px-4 py-2.5 font-medium w-[200px]">Ajan</th>
              <th className="px-4 py-2.5 font-medium w-[90px]">Hedef</th>
              <th className="px-4 py-2.5 font-medium">Eylem</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Kayıt bulunamadı.</td></tr>
            )}
            {logs.map((log) => {
              const { label, cls, Icon } = STATUS_BADGE[log.status] ?? STATUS_BADGE.INFO;
              return (
                <tr key={log.id} className="border-b border-[#15151F] hover:bg-[#101019] transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmt(log.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
                      <Icon size={11} /> {label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-300 truncate max-w-[200px]" title={log.agentName}>{log.agentName}</td>
                  <td className="px-4 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">{log.targetType}#{log.targetId}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-200">{log.action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sayfalama */}
      <div className="flex items-center justify-center gap-2">
        {page > 1
          ? <Link href={qs(page - 1)} className="px-3 py-1.5 text-sm rounded-md border border-[#26263A] text-zinc-300 hover:bg-[#1A1A2E]">← Önceki</Link>
          : <span className="px-3 py-1.5 text-sm rounded-md border border-[#1A1A26] text-zinc-600">← Önceki</span>}
        <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
        {page < totalPages
          ? <Link href={qs(page + 1)} className="px-3 py-1.5 text-sm rounded-md border border-[#26263A] text-zinc-300 hover:bg-[#1A1A2E]">Sonraki →</Link>
          : <span className="px-3 py-1.5 text-sm rounded-md border border-[#1A1A26] text-zinc-600">Sonraki →</span>}
      </div>
    </div>
  );
}
