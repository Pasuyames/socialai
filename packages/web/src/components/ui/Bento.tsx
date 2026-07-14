"use client";

import { motion, useMotionTemplate, useMotionValue, type Variants } from "framer-motion";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Bento Grid sistemi — premium "kokpit" kartları.
// - BentoGrid: stagger giriş animasyonu (çocuklar sırayla yükselir).
// - BentoCard: glass yüzey + fareyi takip eden spotlight parıltısı + hover lift.
// Ham CSS yok; her şey Tailwind + framer-motion.
// ─────────────────────────────────────────────────────────────────────────────

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 260, damping: 26 },
  },
};

export function BentoGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
    >
      {children}
    </motion.div>
  );
}

interface BentoCardProps {
  className?: string;
  children: ReactNode;
  /** Vurgu rengi (rgb üçlüsü, ör. "108 92 231"). Spotlight + kenar parıltısı. */
  glow?: string;
  interactive?: boolean;
}

export function BentoCard({
  className,
  children,
  glow = "108 92 231",
  interactive = true,
}: BentoCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const spotlight = useMotionTemplate`radial-gradient(340px circle at ${mouseX}px ${mouseY}px, rgb(${glow} / 0.14), transparent 65%)`;

  return (
    <motion.div
      variants={item}
      onMouseMove={(e) => {
        if (!interactive) return;
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
      }}
      whileHover={interactive ? { y: -3 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.06]",
        "bg-[#0B0B14]/80 backdrop-blur-xl",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-24px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      {/* Fareyi takip eden spotlight */}
      {interactive && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: spotlight }}
        />
      )}
      {/* Üst kenar ince ışık çizgisi */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, rgb(${glow} / 0.5), transparent)` }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}
