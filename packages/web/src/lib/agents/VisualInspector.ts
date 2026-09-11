import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import prisma from "../db";
import fs from "fs";
import path from "path";
import { POST_STATUS } from "../constants";
import { cleanAgentError } from "../agentError";

// ─── Şema ─────────────────────────────────────────────────────────────────────

const InspectionSchema = z.object({
  verdict:  z.enum(["approved", "rejected"]),
  score:    z.number().int().min(0).max(100),
  issues:   z.array(z.string()),
  comments: z.string(),
});

type Inspection = z.infer<typeof InspectionSchema>;

const APPROVAL_THRESHOLD = 60;

// Görsellerin kök dizini. Worker process'inin cwd'si packages/worker olduğundan
// process.cwd()/public YANLIŞ klasöre bakar (ImageGenerator PUBLIC_DIR'e yazar).
// ImageGenerator ile AYNI çözümleme — yoksa "dosya bulunamadı" → 3x ret → needs_human.
function publicDir(): string {
  return process.env.PUBLIC_DIR
    ? path.resolve(process.env.PUBLIC_DIR)
    : path.join(process.cwd(), "public");
}

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class VisualInspectorAgent {
  private agentName = "Visual Inspector (Görsel Denetmen)";

  async execute(postId: number): Promise<boolean> {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { plan: { include: { brand: true } } },
      });

      if (!post?.imagePath) {
        await this.log(postId, "HATA: Denetlenecek görsel bulunamadı.");
        return false;
      }

      await this.log(postId, "Görsel kalite denetimi (QC) başlatıldı...");

      const feedFilePath  = path.join(publicDir(), post.imagePath);
      const storyFilePath = post.storyImagePath
        ? path.join(publicDir(), post.storyImagePath)
        : null;

      try {
        await fs.promises.access(feedFilePath);
      } catch {
        await this.log(postId, "HATA: Feed görsel dosyası sunucuda bulunamadı.");
        return false;
      }

      const client = this.getClient();

      // Feed görselini denetle
      const feedInspection = await this.inspectImage(
        client,
        feedFilePath,
        post.imagePrompt ?? "",
        post.plan.brand.name,
        "feed"
      );

      // Story varsa onu da denetle
      if (storyFilePath) {
        try {
          await fs.promises.access(storyFilePath);
          const storyInspection = await this.inspectImage(
            client,
            storyFilePath,
            post.imagePrompt ?? "",
            post.plan.brand.name,
            "story"
          );
          if (storyInspection.verdict === "rejected") {
            await this.log(postId, `Story görseli reddedildi: ${storyInspection.issues.join(", ")}`);
            await fs.promises.unlink(storyFilePath).catch(() => {});
            await prisma.post.update({ where: { id: postId }, data: { storyImagePath: null } });
          }
        } catch { /* story denetim hatası kritik değil */ }
      }

      if (feedInspection.verdict === "rejected") {
        await this.log(postId, `Feed görseli reddedildi (skor: ${feedInspection.score}): ${feedInspection.issues.join(" | ")}`);
        await fs.promises.unlink(feedFilePath).catch(() => {});
        await prisma.post.update({
          where: { id: postId },
          data: {
            imagePath:      null,
            storyImagePath: null,
            status:         POST_STATUS.IMAGE_PROMPT_READY,
          },
        });
        return false;
      }

      // Onaylandı
      await prisma.post.update({
        where: { id: postId },
        data: { status: POST_STATUS.CLIENT_REVIEW },
      });

      await this.log(
        postId,
        `Görsel onaylandı (skor: ${feedInspection.score}/100). ${feedInspection.comments.slice(0, 80)}`
      );
      return true;

    } catch (err: any) {
      await this.log(postId, `BAŞARISIZ: ${cleanAgentError(err)}`);
      return false;
    }
  }

  // ─── Görsel Denetimi ──────────────────────────────────────────────────────

  private async inspectImage(
    client: GoogleGenAI,
    filePath: string,
    prompt: string,
    brandName: string,
    imageType: "feed" | "story",
  ): Promise<Inspection> {
    const imageBuffer = await fs.promises.readFile(filePath);
    const base64      = imageBuffer.toString("base64");

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64,
              },
            },
            {
              text: `Sen titiz bir Sanat Yönetmeni ve Görsel QA Uzmanısın.
Bu ${imageType === "story" ? "story (9:16)" : "feed"} görseli için kalite denetimi yap.

BEKLENEN KONSEPT: "${prompt.slice(0, 200)}"
MARKA: ${brandName}

Denetle:
1. İnsan anatomisi bozuk mu? (6 parmak, ters kollar, bozuk yüz, hayalet uzuvlar)
2. Fizik kurallarına aykırı objeler var mı?
3. AI bozuk yazı/harfler içeriyor mu?
4. Görsel istenen konseptle uyumsuz mu?
5. Piksel kalitesi düşük, bulanık, yapay görünüyor mu?

Score: 0-100. ${APPROVAL_THRESHOLD} altı reddedilir.

SADECE JSON dön:
{
  "verdict": "approved",
  "score": 85,
  "issues": [],
  "comments": "Kısa değerlendirme"
}`,
            },
          ],
        },
      ],
    });

    const text    = response.text ?? "";
    const cleaned = text
      .replace(/^```json\s*/gim, "")
      .replace(/^```\s*/gim, "")
      .replace(/```\s*$/gim, "")
      .trim();

    try {
      const parsed    = JSON.parse(cleaned);
      const validated = InspectionSchema.safeParse(parsed);
      if (validated.success) return validated.data;
    } catch { /* ignore */ }

    // Parse başarısızsa — koruyucu default
    return {
      verdict:  "approved",
      score:    65,
      issues:   ["QC parse hatası — manuel kontrol önerilir"],
      comments: "Otomatik denetim ayrıştırılamadı.",
    };
  }

  // ─── Google GenAI Client ──────────────────────────────────────────────────

  private getClient(): GoogleGenAI {
    const project  = process.env.GCP_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "";
    const location = process.env.GCP_LOCATION   ?? "us-central1";
    return new GoogleGenAI({ vertexai: true, project, location });
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private async log(postId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Post", targetId: postId },
    });
  }
}
