/**
 * Direct retry script for stuck posts.
 * Usage: tsx retry-post.ts <postId>
 * Runs: Copywriter → EditorInChief → EngagementSpecialist → PromptEngineer
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
