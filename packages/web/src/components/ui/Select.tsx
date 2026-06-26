"use client";

import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

const baseClass = `
  w-full bg-muted/40 border border-border rounded-lg px-4 py-2.5 text-sm text-white
  focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
  transition-colors disabled:opacity-50 disabled:cursor-not-allowed
  appearance-none cursor-pointer
`;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-white/80">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          className={`${baseClass} ${error ? "border-danger/50 focus:ring-danger/30" : ""} ${className}`}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1a1a2e] text-white">
              {o.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
);
Select.displayName = "Select";
