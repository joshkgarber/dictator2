import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";

type ApiStatusBadgeProps = {
  status: "idle" | "loading" | "success" | "error";
  errorMessage?: string;
};

export function ApiStatusBadge({ status, errorMessage }: ApiStatusBadgeProps) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Checking API...
      </span>
    );
  }

  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        API connected
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-rose-700" title={errorMessage}>
        <AlertTriangle className="h-4 w-4" />
        API error
      </span>
    );
  }

  return <span className="text-xs font-medium text-slate-600">API idle</span>;
}
