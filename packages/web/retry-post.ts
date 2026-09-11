/**
 * Takılı kalmış bir gönderiyi yeniden işler.
 * Kullanım: pnpm exec tsx retry-post.ts <postId>
 *
 * Çalıştırdığı hat (Orchestrator.startPostCreation):
 *   ContentWriter → EditorInChief ⟲ → VisualInspiration → PromptEngineer
 * (Eski yorum "Copywriter → EngagementSpecialist" diyordu; o iki ajanın yerini
 *  birleşik ContentWriter motoru aldı ve ikisi de kod tabanından kaldırıldı.)
 */

import "dotenv/config";
import { Orchestrator } from "./src/lib/agents/Orchestrator";

const postId = parseInt(process.argv[2] ?? "");
if (isNaN(postId)) {
  console.error("Usage: tsx retry-post.ts <postId>");
  process.exit(1);
}

console.log(`Starting retry for post ${postId}...`);
Orchestrator.startPostCreation(postId)
  .then((r) => {
    console.log("Result:", r);
    process.exit(r.success ? 0 : 1);
  })
  .catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
  });
