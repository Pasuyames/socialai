import { google } from "googleapis";
import prisma from "../db";
import fs from "fs";
import path from "path";
import { cleanAgentError } from "../agentError";

interface DriveAsset {
  id:       string;
  name:     string;
  mimeType: string;
  size?:    string;
  modifiedTime?: string;
}

interface AssetSummary {
  folderId:   string;
  totalFiles: number;
  images:     DriveAsset[];
  pdfs:       DriveAsset[];
  otherFiles: DriveAsset[];
  syncedAt:   string;
}

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class AssetManagerAgent {
  private agentName = "Asset Manager (Materyal Sorumlusu)";

  async execute(brandId: number, driveUrl: string): Promise<{ success: boolean; folderId?: string; error?: string }> {
    try {
      await this.log(brandId, "Google Drive materyal taraması başlatıldı...");

      const folderId = this.extractFolderId(driveUrl);
      if (!folderId) {
        await this.log(brandId, "HATA: Drive URL'sinden klasör ID'si çıkarılamadı.");
        return { success: false, error: "Geçersiz Drive URL." };
      }

      // Credentials kontrolü
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const hasCredentials  = credentialsPath && fs.existsSync(credentialsPath);

      let summary: AssetSummary;

      if (hasCredentials) {
        summary = await this.scanDriveFolder(folderId);
      } else {
        // Simüle et — credentials yokken çökmemesi için
        await this.log(brandId, "UYARI: Google credentials bulunamadı — Drive simüle ediliyor.");
        summary = {
          folderId,
          totalFiles: 0,
          images:     [],
          pdfs:       [],
          otherFiles: [],
          syncedAt:   new Date().toISOString(),
        };
      }

      await prisma.brand.update({
        where: { id: brandId },
        data:  { driveFolderId: folderId },
      });

      await this.log(
        brandId,
        `Drive entegrasyonu tamamlandı. Klasör: ${folderId} | Toplam: ${summary.totalFiles} dosya, ${summary.images.length} görsel`
      );

      return { success: true, folderId };

    } catch (err: any) {
      await this.log(brandId, `BAŞARISIZ: ${cleanAgentError(err)}`);
      return { success: false, error: err.message };
    }
  }

  // ─── Görseli Drive'a Yükle ────────────────────────────────────────────────

  async uploadImage(
    brandId: number,
    localPath: string,
    fileName: string,
  ): Promise<string | null> {
    try {
      const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { driveFolderId: true } });
      if (!brand?.driveFolderId) return null;

      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!credentialsPath || !fs.existsSync(credentialsPath)) return null;

      const drive    = await this.getDriveClient();
      const fileData = await fs.promises.readFile(localPath);

      const res = await drive.files.create({
        requestBody: {
          name:    fileName,
          parents: [brand.driveFolderId],
        },
        media: {
          mimeType: "image/jpeg",
          body:     fileData,
        },
        fields: "id",
      });

      return res.data.id ?? null;
    } catch (err: any) {
      await this.log(brandId, `Görsel yükleme başarısız: ${err.message}`);
      return null;
    }
  }

  // ─── Drive klasör tarama ──────────────────────────────────────────────────

  private async scanDriveFolder(folderId: string): Promise<AssetSummary> {
    const drive = await this.getDriveClient();

    const res = await drive.files.list({
      q:      `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, size, modifiedTime)",
      pageSize: 100,
    });

    const files = res.data.files ?? [];

    const images     = files.filter((f) => f.mimeType?.startsWith("image/")).map(this.toAsset);
    const pdfs       = files.filter((f) => f.mimeType === "application/pdf").map(this.toAsset);
    const otherFiles = files.filter((f) => !f.mimeType?.startsWith("image/") && f.mimeType !== "application/pdf").map(this.toAsset);

    return {
      folderId,
      totalFiles: files.length,
      images,
      pdfs,
      otherFiles,
      syncedAt: new Date().toISOString(),
    };
  }

  // ─── Yardımcılar ──────────────────────────────────────────────────────────

  private extractFolderId(driveUrl: string): string | null {
    // https://drive.google.com/drive/folders/1AbC123... formatını ayrıştır
    const m = driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    // Düz ID girilmişse
    if (/^[a-zA-Z0-9_-]{20,}$/.test(driveUrl)) return driveUrl;
    return null;
  }

  private async getDriveClient() {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    return google.drive({ version: "v3", auth });
  }

  private toAsset(f: { id?: string | null; name?: string | null; mimeType?: string | null; size?: string | null; modifiedTime?: string | null }): DriveAsset {
    return {
      id:           f.id    ?? "",
      name:         f.name  ?? "",
      mimeType:     f.mimeType ?? "",
      size:         f.size         ?? undefined,
      modifiedTime: f.modifiedTime ?? undefined,
    };
  }

  private async log(brandId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Brand", targetId: brandId },
    });
  }
}
