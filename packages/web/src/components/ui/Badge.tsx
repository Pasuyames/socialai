type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "accent" | "muted";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default:  "bg-muted text-white",
  primary:  "bg-primary/20 text-secondary border border-primary/30",
  success:  "bg-success/10 text-success border border-success/20",
  warning:  "bg-warning/10 text-warning border border-warning/20",
  danger:   "bg-danger/10 text-danger border border-danger/20",
  accent:   "bg-accent/10 text-accent border border-accent/20",
  muted:    "bg-muted/60 text-muted-foreground border border-border",
};

const statusMap: Record<string, BadgeVariant> = {
  planning:          "muted",
  generating:        "primary",
  ideation:          "primary",
  writing:           "primary",
  generating_image:  "accent",
  qc_review:         "warning",
  client_review:     "warning",
  review:            "warning",
  approved:          "success",
  ready:             "success",
  published:         "success",
  failed:            "danger",
  reviewed:                 "success",
  ready_for_image:          "accent",
  image_prompt_ready:       "accent",
  needs_rewrite:            "warning",
  needs_human_intervention: "danger",
};

export function Badge({ variant = "default", className = "", children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant = statusMap[status] ?? "muted";
  const labels: Record<string, string> = {
    planning:         "Planlama",
    generating:       "Üretiliyor",
    ideation:         "Fikir",
    writing:          "Yazılıyor",
    generating_image: "Görsel",
    qc_review:        "QC İnceleme",
    client_review:    "Müşteri",
    review:           "İnceleme",
    approved:         "Onaylı",
    ready:            "Hazır",
    published:        "Yayında",
    failed:           "Hata",
    reviewed:                 "İncelendi",
    ready_for_image:          "Görsel Hazırlığı",
    image_prompt_ready:       "Görsel Bekliyor",
    needs_rewrite:            "Revizyon Bekliyor",
    needs_human_intervention: "Manuel Müdahale",
  };
  return <Badge variant={variant}>{labels[status] ?? status}</Badge>;
}
