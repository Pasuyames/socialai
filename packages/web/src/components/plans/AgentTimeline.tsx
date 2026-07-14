"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, Activity, Clock } from "lucide-react";
import { cn } from "@/lib/cn";

export interface AgentLogEntry {
  id: number;
  agentName: string;
  action: string;
  status: "SUCCESS" | "FAILED" | "NEEDS_HUMAN" | "INFO";
  details: string | null;
  targetType: string;
  targetId: number;
  createdAt: string;
}

interface ParsedDetails {
  reason?: string;
  score?: number;
  qualityScore?: number;
}

function parseDetails(details: string | null): ParsedDetails | null {
  if (!details) return null;
  try {
    const parsed: unknown = JSON.parse(details);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const result: ParsedDetails = {};
    if (typeof obj.reason === "string") result.reason = obj.reason;
    if (typeof obj.score === "number") result.score = obj.score;
    if (typeof obj.qualityScore === "number") result.qualityScore = obj.qualityScore;
    return result;
  } catch {
    return null;
  }
}

function agentAccent(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("visual") || n.includes("image") || n.includes("görsel")) return "168 85 247";
  if (n.includes("writer") || n.includes("content") || n.includes("copy")) return "245 158 11";
  if (n.includes("editor") || n.includes("manager") || n.includes("pm")) return "59 130 246";
  if (n.includes("data") || n.includes("research") || n.includes("brand")) return "16 185 129";
  return "108 92 231";
}

const STATUS_STYLE: Record<
  AgentLogEntry["status"],
  { Icon: typeof CheckCircle2; token: string; label: string }
> = {
  SUCCESS: { Icon: CheckCircle2, token: "0 230 118", label: "Başarılı" },
  FAILED: { Icon: XCircle, token: "255 82 82", label: "Başarısız" },
  NEEDS_HUMAN: { Icon: AlertTriangle, token: "255 214 0", label: "İnsan Gerekli" },
  INFO: { Icon: Info, token: "148 163 184", label: "Bilgi" },
};

function scoreBadgeClass(score: number): string {
  if (score >= 80) return "border-success/20 bg-success/10 text-success";
  if (score >= 50) return "border-warning/20 bg-warning/10 text-warning";
  return "border-danger/20 bg-danger/10 text-danger";
}

export function AgentTimeline({ logs }: { logs: AgentLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-center">
        <Activity size={22} className="mb-2 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">Henüz ajan aktivitesi yok.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-1.5">
      <div
        aria-hidden
        className="absolute bottom-3 left-[19px] top-3 w-px bg-gradient-to-b from-primary/40 via-white/[0.06] to-transparent"
      />
      {logs.map((log, i) => {
        const accent = agentAccent(log.agentName);
        const { Icon, token, label } = STATUS_STYLE[log.status] ?? STATUS_STYLE.INFO;
        const parsed = parseDetails(log.details);
        const score = parsed?.qualityScore ?? parsed?.score;

        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="group relative flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition-colors hover:border-white/[0.06] hover:bg-white/[0.03]"
          >
            <span
              aria-hidden
              className="absolute inset-y-1.5 left-0 w-0.5 rounded-full"
              style={{ background: `rgb(${accent})` }}
            />
            <div
              className="relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
              style={{
                background: `rgb(${token} / 0.12)`,
                borderColor: `rgb(${token} / 0.3)`,
              }}
            >
              <Icon size={15} style={{ color: `rgb(${token})` }} />
            </div>

            <div className="min-w-0 flex-1 pl-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: `rgb(${accent} / 0.12)`,
                    borderColor: `rgb(${accent} / 0.3)`,
                    color: `rgb(${accent})`,
                  }}
                >
                  {log.agentName}
                </span>
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: `rgb(${token} / 0.1)`,
                    borderColor: `rgb(${token} / 0.25)`,
                    color: `rgb(${token})`,
                  }}
                >
                  {label}
                </span>
                {typeof score === "number" && (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      scoreBadgeClass(score),
                    )}
                  >
                    QA: {score}/100
                  </span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground/60">
                  <Clock size={9} />
                  {new Date(log.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{log.action}</p>

              {parsed?.reason && (
                <p className="mt-1 line-clamp-2 text-[11px] italic leading-relaxed text-muted-foreground/70">
                  {parsed.reason}
                </p>
              )}

              <p className="mt-1 text-[10px] text-muted-foreground/50">
                {log.targetType}#{log.targetId}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
