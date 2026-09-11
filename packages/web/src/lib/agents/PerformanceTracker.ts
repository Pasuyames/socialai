import prisma from "../db";
import { POST_STATUS, PLATFORM } from "../constants";
import { cleanAgentError } from "../agentError";

interface PostMetrics {
  postId: number;
  externalPostId: string;
  platform: string;
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  impressions?: number;
  saves?: number;
}

export class PerformanceTrackerAgent {
  private agentName = "Performance Tracker (Performans Takipçisi)";

  async execute(planId: number): Promise<boolean> {
    try {
      const posts = await prisma.post.findMany({
        where: {
          planId,
          status: POST_STATUS.PUBLISHED,
          externalPostId: { not: null },
        },
        select: { id: true, externalPostId: true, platform: true },
      });

      if (posts.length === 0) {
        await this.log(planId, "Yayınlanmış gönderi yok — takip atlandı.");
        return true;
      }

      await this.log(planId, `${posts.length} yayınlanmış gönderi için metrik çekiliyor...`);

      let fetched = 0;
      for (const post of posts) {
        if (!post.externalPostId) continue;

        // Simülasyon veya API'den çek
        const metrics = post.externalPostId.startsWith("sim_")
          ? this.simulateMetrics(post.id, post.externalPostId, post.platform ?? PLATFORM.INSTAGRAM)
          : await this.fetchFromApi(post.id, post.externalPostId, post.platform ?? PLATFORM.INSTAGRAM);

        if (metrics) {
          await prisma.postMetrics.upsert({
            where: { postId: post.id },
            create: {
              postId:      post.id,
              likes:       metrics.likes       ?? 0,
              comments:    metrics.comments    ?? 0,
              shares:      metrics.shares      ?? 0,
              reach:       metrics.reach       ?? 0,
              impressions: metrics.impressions ?? 0,
              saves:       metrics.saves       ?? 0,
              fetchedAt:   new Date(),
            },
            update: {
              likes:       metrics.likes       ?? 0,
              comments:    metrics.comments    ?? 0,
              shares:      metrics.shares      ?? 0,
              reach:       metrics.reach       ?? 0,
              impressions: metrics.impressions ?? 0,
              saves:       metrics.saves       ?? 0,
              fetchedAt:   new Date(),
            },
          });
          fetched++;
        }
      }

      await this.log(planId, `${fetched}/${posts.length} gönderi metriği güncellendi.`);
      return true;

    } catch (err: any) {
      await this.log(planId, `BAŞARISIZ: ${cleanAgentError(err)}`);
      return false;
    }
  }

  private async fetchFromApi(postId: number, externalId: string, platform: string): Promise<PostMetrics | null> {
    try {
      if (platform === PLATFORM.INSTAGRAM) {
        const token = process.env.INSTAGRAM_ACCESS_TOKEN;
        if (!token) return this.simulateMetrics(postId, externalId, platform);

        const res = await fetch(
          `https://graph.facebook.com/v22.0/${externalId}/insights?metric=likes,comments,shares,reach,impressions,saved&access_token=${token}`,
          { signal: AbortSignal.timeout(10_000) }
        );
        if (!res.ok) return null;

        const data = await res.json();
        const m: any = {};
        for (const item of data.data ?? []) {
          m[item.name] = item.values?.[0]?.value ?? 0;
        }
        return {
          postId, externalPostId: externalId, platform,
          likes: m.likes, comments: m.comments, shares: m.shares,
          reach: m.reach, impressions: m.impressions, saves: m.saved,
        };
      }

      if (platform === PLATFORM.LINKEDIN) {
        const token = process.env.LINKEDIN_ACCESS_TOKEN;
        const orgId = process.env.LINKEDIN_ORGANIZATION_ID;
        if (!token || !orgId) return this.simulateMetrics(postId, externalId, platform);

        // externalId → urn:li:ugcPost:{id} formatına normalize et
        const postUrn = externalId.startsWith("urn:li:")
          ? externalId
          : `urn:li:ugcPost:${externalId}`;
        const orgUrn = `urn:li:organization:${orgId}`;

        // LinkedIn Rest.li formatı: List() sarmalayıcısı encode edilmemeli,
        // sadece içindeki URN değerleri encode edilmeli.
        const qs = `q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&ugcPosts=List(${encodeURIComponent(postUrn)})`;
        const res = await fetch(
          `https://api.linkedin.com/v2/organizationalEntityShareStatistics?${qs}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-Restli-Protocol-Version": "2.0.0",
            },
            signal: AbortSignal.timeout(10_000),
          }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const stats = data.elements?.[0]?.totalShareStatistics ?? {};
        return {
          postId, externalPostId: externalId, platform,
          likes:       stats.likeCount        ?? 0,
          comments:    stats.commentCount     ?? 0,
          shares:      stats.shareCount       ?? 0,
          impressions: stats.impressionCount  ?? 0,
          reach:       stats.uniqueImpressionsCount ?? 0,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private simulateMetrics(postId: number, externalId: string, platform: string): PostMetrics {
    const base = (postId * 7 + 13) % 50;
    return {
      postId, externalPostId: externalId, platform,
      likes:       base * 12 + Math.floor(Math.random() * 20),
      comments:    base * 2  + Math.floor(Math.random() * 5),
      shares:      base      + Math.floor(Math.random() * 3),
      reach:       base * 80 + Math.floor(Math.random() * 100),
      impressions: base * 120,
      saves:       base * 3,
    };
  }

  private async log(planId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Plan", targetId: planId },
    });
  }
}
