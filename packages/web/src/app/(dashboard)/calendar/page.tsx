import prisma from "@/lib/db";
import { CalendarClock, Activity } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  // Yaklaşan tüm gönderileri al
  const upcomingPosts = await prisma.post.findMany({
    where: { 
      scheduledAt: { not: null }
    },
    include: {
      plan: { include: { brand: true } }
    },
    orderBy: { scheduledAt: 'asc' },
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 border-b border-[#1E1E2E] pb-4">
        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">
          <CalendarClock size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">İçerik Takvimi</h1>
          <p className="text-sm text-muted-foreground mt-1">Tüm markaların onaylanmış ve planlanmış yaklaşan gönderileri.</p>
        </div>
      </div>

      {upcomingPosts.length === 0 ? (
        <div className="bg-[color:var(--card)] border border-[#1E1E2E] rounded-lg p-12 text-center flex flex-col items-center">
          <CalendarClock size={48} className="text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-white mb-2">Henüz Planlanmış Gönderi Yok</h3>
          <p className="text-muted-foreground max-w-sm">
            İçerik Planlayıcı (Content Scheduler) ajanının postları takvime dizmesi için bir marka planı oluşturun.
          </p>
        </div>
      ) : (
        <div className="bg-[color:var(--card)] border border-[#1E1E2E] rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#0A0A0F] border-b border-[#1E1E2E] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Tarih & Saat</th>
                <th className="px-6 py-4 font-medium">Marka</th>
                <th className="px-6 py-4 font-medium">Konu</th>
                <th className="px-6 py-4 font-medium">Durum</th>
                <th className="px-6 py-4 font-medium">Görsel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E1E2E]">
              {upcomingPosts.map((post) => (
                <tr key={post.id} className="hover:bg-[#1A1A2E]/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-white font-medium">
                    {post.scheduledAt && new Date(post.scheduledAt).toLocaleString("tr-TR", { 
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </td>
                  <td className="px-6 py-4 text-white">
                    {post.plan.brand.name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[250px] truncate">
                    {post.topic}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                      {post.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {post.imagePath ? (
                      <div className="w-8 h-8 rounded bg-[#1A1A2E] overflow-hidden border border-[#1E1E2E]">
                        <img src={post.imagePath} alt="Post" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Yok</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
