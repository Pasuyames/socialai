import Link from "next/link";
import { Building2, Globe, Camera, Activity, Plus, CheckCircle } from "lucide-react";
import prisma from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getScope } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  // Fail-closed kapsam: kimlik belirsizse veri yok (bkz. lib/session.ts getScope)
  const { orgId, seesAll } = await getScope();
  const brands = await prisma.brand.findMany({
    where: seesAll ? {} : { organizationId: orgId! },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Markalar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{brands.length} marka kayıtlı</p>
        </div>
        <Link href="/brands/new">
          <Button size="sm"><Plus size={15} /> Yeni Marka</Button>
        </Link>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-10">
          <EmptyState
            icon={<Building2 size={28} />}
            title="Henüz marka eklenmedi"
            description="Ajanların çalışmaya başlaması için önce bir marka profili oluşturun."
            href="/brands/new"
            actionLabel="İlk Markayı Ekle"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {brands.map((brand) => (
            <Link key={brand.id} href={`/brands/${brand.id}`} className="group block">
              <div className="relative rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(108,92,231,0.12)] h-full overflow-hidden">
                {/* subtle gradient accent top */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary font-bold text-xl">
                    {brand.name.charAt(0).toUpperCase()}
                  </div>
                  <Badge variant={brand.rawScrapedData ? "success" : "muted"}>
                    {brand.rawScrapedData ? "Analiz Edildi" : "Bekliyor"}
                  </Badge>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors">{brand.name}</h3>

                <div className="space-y-1.5 mt-3">
                  {brand.websiteUrl && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Globe size={12} />
                      <span className="truncate">{brand.websiteUrl}</span>
                    </div>
                  )}
                  {brand.instagramHandle && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Camera size={12} />
                      <span>{brand.instagramHandle}</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-[#1A1A2E] flex items-center justify-between">
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Activity size={11} className={brand.brandStrategy ? "text-green-400" : "text-muted-foreground"} />
                      Strateji
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle size={11} className={brand.toneOfVoice ? "text-green-400" : "text-muted-foreground"} />
                      Ton
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    {new Date(brand.createdAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
