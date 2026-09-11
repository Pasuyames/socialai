import Link from "next/link";
import { CalendarDays, Plus, FileText, Sparkles } from "lucide-react";
import prisma from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getScope } from "@/lib/session";

export const dynamic = "force-dynamic";

const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

export default async function PlansPage() {
  // Fail-closed kapsam: kimlik belirsizse veri yok (bkz. lib/session.ts getScope)
  const { orgId, seesAll } = await getScope();

  const plans = await prisma.monthlyPlan.findMany({
    where: seesAll ? {} : { brand: { organizationId: orgId! } },
    include: { brand: true, posts: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Aylık Planlar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{plans.length} plan mevcut</p>
        </div>
        <Link href="/plans/new">
          <Button size="sm"><Plus size={15} /> Yeni Plan</Button>
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-10">
          <EmptyState
            icon={<CalendarDays size={28} />}
            title="Henüz plan oluşturulmadı"
            description="Bir marka için aylık içerik planı başlatın, ajanlar gerisini halleder."
            href="/plans/new"
            actionLabel="İlk Planı Oluştur"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const approved  = plan.posts.filter(p => ["approved","published","client_review"].includes(p.status)).length;
            const progress  = plan.posts.length > 0 ? Math.round((approved / plan.posts.length) * 100) : 0;
            const isRunning = plan.status === "generating" || plan.status === "planning";

            return (
              <Link key={plan.id} href={`/plans/${plan.id}`} className="group block">
                <div className="relative rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-5 transition-all duration-200 hover:border-accent/30 hover:shadow-[0_0_20px_rgba(0,210,255,0.1)] h-full overflow-hidden">
                  {/* Gradient top stripe */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  {/* Running shimmer */}
                  {isRunning && (
                    <div className="absolute inset-0 shimmer pointer-events-none rounded-xl" />
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/10 flex items-center justify-center">
                      <CalendarDays size={17} className="text-accent" />
                    </div>
                    <StatusBadge status={plan.status} />
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-accent transition-colors">
                    {plan.brand.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Sparkles size={11} className="text-accent/50" />
                    {MONTHS[plan.month - 1]} {plan.year}
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <FileText size={11} />
                        {plan.posts.length} içerik
                      </span>
                      <span className="font-medium text-white">{approved} onaylı</span>
                    </div>

                    {plan.posts.length > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">İlerleme</span>
                          <span className="text-white font-semibold tabular-nums">{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-[#1A1A2E] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              background: "linear-gradient(90deg, #6C5CE7, #00D2FF)",
                              boxShadow: progress > 0 ? "0 0 8px rgba(0,210,255,0.4)" : "none",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#1A1A2E] text-[11px] text-muted-foreground">
                    {new Date(plan.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
