import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  glass?: boolean;
}

const paddings = {
  none: "",
  sm:   "p-4",
  md:   "p-5",
  lg:   "p-8",
};

export function Card({ padding = "md", glass = false, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border ${paddings[padding]} ${
        glass
          ? "bg-[#0C0C16]/80 border-[#1E1E2E] backdrop-blur-sm"
          : "bg-[#0C0C16] border-[#1A1A2E]"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center justify-between mb-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-sm font-semibold text-white ${className}`} {...props}>
      {children}
    </h3>
  );
}
