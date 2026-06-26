import { VertexAI } from "@google-cloud/vertexai";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function generateText(prompt: string, isJson: boolean = false): Promise<string> {
  const project =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;

  if (!project) {
    throw new Error("GCP_PROJECT_ID env var is not set.");
  }

  const location =
    process.env.GCP_LOCATION ||
    process.env.GOOGLE_CLOUD_LOCATION ||
    "us-central1";

  const vertexAI = new VertexAI({ project, location });
  const model = vertexAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const maxRetries = 4;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const parts = result.response.candidates?.[0]?.content?.parts ?? [];

      const responsePart =
        parts.find((p: any) => p.text && !p.thought) ??
        parts.find((p: any) => p.text);

      let text = responsePart?.text ?? "";

      if (!text) {
        console.warn(`[LLM] Attempt ${attempt}: model returned empty response.`);
        lastError = new Error("Model returned empty response.");
        break;
      }

      if (isJson) {
        text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      }
      return text;
    } catch (error: any) {
      lastError = error;
      const isRateLimit =
        error?.message?.includes("429") ||
        error?.message?.includes("quota") ||
        error?.message?.includes("RESOURCE_EXHAUSTED");

      console.error(`[LLM] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);

      if (isRateLimit && attempt < maxRetries) {
        const waitMs = attempt * 8000;
        console.log(`[LLM] Rate limit — waiting ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }
      break;
    }
  }

  throw new Error(`LLM error after ${maxRetries} attempts: ${lastError?.message}`);
}
