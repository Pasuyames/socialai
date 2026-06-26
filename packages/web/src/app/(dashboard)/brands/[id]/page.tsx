import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Globe, Camera, ArrowLeft, Activity, FolderSync, CheckCircle, Clock } from "lucide-react";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AnalyzeButton from "./AnalyzeButton";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId   = parseInt((session.user as any).organizationId);
  const isAdmin = (session.user as any).role === "superadmin";

  const brand = await prisma.brand.findUnique({ where: { id: parseInt(id) } });
  if (!brand) return notFound();
  // Cross-tenant IDOR koruması: başka org'un markası görüntülenemez
  if (!isAdmin && brand.organizationId !== orgId) return notFound();

  let strategy: any = null;
  let tone: any = null;
  try {
    if (brand.brandStrategy) strategy = JSON.parse(brand.brandStrategy);
    if (brand.toneOfVoice) tone = JSON.parse(brand.toneOfVoice);
  } catch {}

  const logs = await prisma.agentLog.findMany({
    where: { targetId: brand.id, targetType: "Brand" },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/brands" className="w-8 h-8 rounded-lg hover:bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold text-xl">
          {brand.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">{brand.name}</h1>
            {strategy && <Badge variant="success">Analiz Tamamlandı</Badge>}
            {brand.driveFolderId && (
              <a href={`https://drive.google.com/drive/folders/${brand.driveFolderId}`} target="_blank" className="inline-flex items-center gap-1">
                <Badge variant="accent"><FolderSync size={10} /> Drive</Badge>
              </a>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            {brand.websiteUrl && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe size={12} /> {brand.websiteUrl}
              </span>
            )}
            {brand.instagramHandle && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Camera size={12} /> {brand.instagramHandle}
              </span>
            )}
          </div>
        </div>
        <AnalyzeButton brandId={brand.id} isAnalyzing={false} hasData={!!brand.brandStrategy} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {!strategy ? (
            <Card>
              <EmptyState
                icon={<Building2 size={28} />}
                title="Strateji Analizi Bekleniyor"
                description="Marka analizini başlatmak için sağdaki 'Analizi Başlat' butonuna tıklayın."
              />
            </Card>
          ) : (
            <>
              {/* Executive Summary */}
              <Card>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Marka Özeti</p>
                <p className="text-white leading-relaxed">{strategy.executiveSummary}</p>
                {strategy.brandArchetype && (
                  <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Arketip:</span>
                    <Badge variant="accent">{strategy.brandArchetype}</Badge>
                  </div>
                )}
              </Card>

              {/* Target + SWOT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">Hedef Kitle</p>
                  <div className="space-y-3">
                    {strategy.targetAudience?.age && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Demografi</span>
                        <p className="text-sm text-white font-medium">{strategy.targetAudience.age} · {strategy.targetAudience.gender}</p>
                      </div>
                    )}
                    {strategy.targetAudience?.interests?.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-2">İlgi Alanları</span>
                        <div className="flex flex-wrap gap-1.5">
                          {strategy.targetAudience.interests.map((i: string, idx: number) => (
                            <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded-md text-white">{i}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">SWOT Özet</p>
                  <div className="space-y-3">
                    {strategy.swotAnalysis?.strengths?.length > 0 && (
                      <div>
                        <span className="text-xs text-success font-medium block mb-1.5">Güçlü Yönler</span>
                        <ul className="text-xs text-white/90 space-y-1">
                          {strategy.swotAnalysis.strengths.slice(0, 3).map((s: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" />{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {strategy.swotAnalysis?.opportunities?.length > 0 && (
                      <div>
                        <span className="text-xs text-accent font-medium block mb-1.5">Fırsatlar</span>
                        <ul className="text-xs text-white/90 space-y-1">
                          {strategy.swotAnalysis.opportunities.slice(0, 2).map((s: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5"><CheckCircle size={10} className="text-accent mt-0.5 shrink-0" />{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Tone of Voice */}
              {tone && (
                <Card>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">İletişim Dili</p>
                  {tone.coreTone && (
                    <div className="mb-4">
                      <span className="text-xs text-muted-foreground block mb-1">Ana Ton</span>
                      <Badge variant="primary">{tone.coreTone}</Badge>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {tone.dos?.length > 0 && (
                      <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                        <p className="text-xs font-semibold text-success mb-2">Yapılacaklar</p>
                        <ul className="text-xs text-white/90 space-y-1">
                          {tone.dos.map((d: string, i: number) => <li key={i}>• {d}</li>)}
                        </ul>
                      </div>
                    )}
                    {tone.donts?.length > 0 && (
                      <div className="p-3 rounded-lg bg-danger/5 border border-danger/20">
                        <p className="text-xs font-semibold text-danger mb-2">Yapılmayacaklar</p>
                        <ul className="text-xs text-white/90 space-y-1">
                          {tone.donts.map((d: string, i: number) => <li key={i}>• {d}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                  {tone.vocabulary?.length > 0 && (
                    <div className="mt-4">
                      <span className="text-xs text-muted-foreground block mb-2">Marka Kelimeleri</span>
                      <div className="flex flex-wrap gap-1.5">
                        {tone.vocabulary.map((v: string, i: number) => (
                          <span key={i} className="text-xs bg-primary/10 text-secondary border border-primary/20 px-2 py-0.5 rounded-md">{v}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity size={14} className="text-primary" /> Ajan Logları
              </CardTitle>
            </CardHeader>
            {logs.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="border-l-2 border-primary/40 pl-3 py-0.5">
                    <p className="text-xs font-semibold text-accent">{log.agentName}</p>
                    <p className="text-xs text-white/80 mt-0.5">{log.action}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(log.createdAt).toLocaleString("tr-TR")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Henüz log yok.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
