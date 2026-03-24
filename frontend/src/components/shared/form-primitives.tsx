import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "@/lib/utils";

type FormFieldProps = PropsWithChildren<{
  label: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  error?: string;
}>;

export function FormField({ label, hint, htmlFor, className, error, children }: FormFieldProps) {
  return (
    <label htmlFor={htmlFor} className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {error && (
        <span className="text-xs text-rose-600 font-medium">{error}</span>
      )}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

type FormSectionProps = PropsWithChildren<{
  title: string;
  description?: string;
  actions?: ReactNode;
}>;

export function FormSection({ title, description, actions, children }: FormSectionProps) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.06em] text-slate-700">{title}</h4>
          {description && <p className="mt-1 text-xs text-slate-600">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
