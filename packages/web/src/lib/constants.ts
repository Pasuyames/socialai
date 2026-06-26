// Tüm status string'leri tek yerden — ajan ve Orchestrator bunları import eder

export const POST_STATUS = {
  IDEATION:               "ideation",
  WRITING:                "writing",
  REVIEWED:               "reviewed",
  READY_FOR_IMAGE:        "ready_for_image",
  IMAGE_PROMPT_READY:     "image_prompt_ready",
  GENERATING_IMAGE:       "generating_image",
  QC_REVIEW:              "qc_review",
  CLIENT_REVIEW:          "client_review",
  NEEDS_REWRITE:          "needs_rewrite",
  NEEDS_HUMAN:            "needs_human_intervention",
  APPROVED:               "approved",
  PUBLISHED:              "published",
} as const;

export type PostStatus = typeof POST_STATUS[keyof typeof POST_STATUS];

export const PLAN_STATUS = {
  PLANNING:              "planning",
  GENERATING_IDEAS:      "generating_ideas",
  IDEATION_READY:        "ideation_ready",
  POST_GENERATION:       "post_generation",
  ANALYSIS_FAILED:       "analysis_failed",
  POST_GENERATION_FAILED:"post_generation_failed",
  IMAGE_GENERATION:      "image_generation",
  REVIEW:                "review",
  READY:                 "ready",
  ARCHIVED:              "archived",
} as const;

export type PlanStatus = typeof PLAN_STATUS[keyof typeof PLAN_STATUS];

export const PLATFORM = {
  INSTAGRAM: "instagram",
  LINKEDIN:  "linkedin",
  TWITTER:   "twitter",
} as const;

export type Platform = typeof PLATFORM[keyof typeof PLATFORM];
