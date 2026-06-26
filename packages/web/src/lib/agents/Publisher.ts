import prisma from "../db";
import fs from "fs";
import path from "path";
import { POST_STATUS, PLATFORM } from "../constants";

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class PublisherAgent {
  private agentName = "Publisher (Yayın Yöneticisi)";

  async execute(postId: number): Promise<boolean> {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { plan: { include: { brand: true } } },
      });

      if (!post || post.status !== POST_STATUS.APPROVED) {
        await this.log(postId, "HATA: Gönderi onaylanmamış veya bulunamadı.");
        return false;
      }

      const brand    = post.plan.brand;
      const platform = post.platform ?? PLATFORM.INSTAGRAM;

      await this.log(postId, `${platform.toUpperCase()} yayını başlatılıyor...`);

      let externalId: string | null = null;

      if (platform === PLATFORM.INSTAGRAM) {
        externalId = await this.publishToInstagram(post, brand);
      } else if (platform === PLATFORM.LINKEDIN) {
        externalId = await this.publishToLinkedIn(post, brand);
      } else {
        // Twitter/X — API entegrasyonu ileride
        await this.log(postId, "Twitter/X yayını henüz entegre edilmedi — simüle ediliyor.");
        externalId = `sim_${Date.now()}`;
      }

      await prisma.post.update({
        where: { id: postId },
        data: {
          status:         POST_STATUS.PUBLISHED,
          publishedAt:    new Date(),
          externalPostId: externalId,
        },
      });

      await this.log(postId, `Gönderi yayınlandı. Platform: ${platform}, ID: ${externalId ?? "N/A"}`);
      return true;

    } catch (err: any) {
      await this.log(postId, `BAŞARISIZ: ${err.message}`);
      return false;
    }
  }

  // ─── Instagram Graph API ──────────────────────────────────────────────────

  private async publishToInstagram(post: any, brand: any): Promise<string | null> {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const igUserId    = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !igUserId) {
      await this.log(post.id, "UYARI: Instagram API token/ID eksik — simüle ediliyor.");
      return `sim_ig_${Date.now()}`;
    }

    if (!post.imagePath) {
      await this.log(post.id, "HATA: Görsel yolu eksik, Instagram yayını yapılamaz.");
      return null;
    }

    // Görsel URL'si oluştur (public erişilebilir olmalı)
    const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const imageUrl  = `${baseUrl}${post.imagePath}`;
    const caption   = this.buildCaption(post);

    // 1. Media container oluştur
    const containerRes = await fetch(
      `https://graph.facebook.com/v22.0/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url:    imageUrl,
          caption,
          access_token: accessToken,
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!containerRes.ok) {
      const err = await containerRes.text();
      throw new Error(`Instagram media container hatası: ${containerRes.status} — ${err.slice(0, 200)}`);
    }

    const { id: containerId } = await containerRes.json();

    // Kısa bekleme (Meta önerir)
    await new Promise((r) => setTimeout(r, 3000));

    // 2. Yayınla
    const publishRes = await fetch(
      `https://graph.facebook.com/v22.0/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id:  containerId,
          access_token: accessToken,
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!publishRes.ok) {
      const err = await publishRes.text();
      throw new Error(`Instagram publish hatası: ${publishRes.status} — ${err.slice(0, 200)}`);
    }

    const { id: postId } = await publishRes.json();
    return postId ?? null;
  }

  // ─── LinkedIn API ─────────────────────────────────────────────────────────

  private async publishToLinkedIn(post: any, brand: any): Promise<string | null> {
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
    const orgId       = process.env.LINKEDIN_ORGANIZATION_ID;

    if (!accessToken || !orgId) {
      await this.log(post.id, "UYARI: LinkedIn API token/ID eksik — simüle ediliyor.");
      return `sim_li_${Date.now()}`;
    }

    const caption = this.buildCaption(post);

    const body: any = {
      author:           `urn:li:organization:${orgId}`,
      lifecycleState:   "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: caption },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LinkedIn publish hatası: ${res.status} — ${err.slice(0, 200)}`);
    }

    const result = await res.json();
    return result.id ?? null;
  }

  // ─── Yardımcılar ──────────────────────────────────────────────────────────

  private buildCaption(post: any): string {
    const parts = [post.caption ?? ""];
    if (post.hashtags) parts.push("\n\n" + post.hashtags);
    return parts.join("").trim();
  }

  private async log(postId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Post", targetId: postId },
    });
  }
}
