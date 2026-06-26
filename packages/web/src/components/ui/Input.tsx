import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const baseClass = `
  w-full bg-muted/40 border border-border rounded-lg px-4 py-2.5 text-sm text-white
  placeholder:text-muted-foreground
  focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
  transition-colors disabled:opacity-50 disabled:cursor-not-allowed
`;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-white/80">{label}</label>}
      <input ref={ref} className={`${baseClass} ${error ? "border-danger/50 focus:ring-danger/30" : ""} ${className}`} {...props} />
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-white/80">{label}</label>}
      <textarea ref={ref} className={`${baseClass} resize-none ${error ? "border-danger/50 focus:ring-danger/30" : ""} ${className}`} {...props} />
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
);
Textarea.displayName = "Textarea";
