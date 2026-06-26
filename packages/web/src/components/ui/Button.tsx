import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:   "bg-primary hover:bg-primary/90 text-white shadow-[0_0_16px_rgba(108,92,231,0.35)] hover:shadow-[0_0_24px_rgba(108,92,231,0.5)]",
  secondary: "bg-[#12121E] hover:bg-[#1A1A2E] text-white border border-[#1E1E2E] hover:border-[#2E2E4E]",
  ghost:     "bg-transparent hover:bg-white/[0.05] text-muted-foreground hover:text-white",
  danger:    "bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30",
  success:   "bg-success/10 hover:bg-success/20 text-success border border-success/30",
  warning:   "bg-warning/10 hover:bg-warning/20 text-warning border border-warning/30",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2 font-medium rounded-lg
          transition-all duration-150 cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variants[variant]} ${sizes[size]} ${className}
        `}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
