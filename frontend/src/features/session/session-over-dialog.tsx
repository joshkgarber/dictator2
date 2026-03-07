import { CalendarDays } from "lucide-react";

import { FormField } from "@/components/shared/form-primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { SessionState } from "@/lib/api/sessions";

type SessionOverDialogProps = {
  open: boolean;
  session: SessionState | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) {
    return "0m 0s";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function SessionOverDialog({ open, session, onOpenChange, onDone }: SessionOverDialogProps) {
  const weightedScore = session?.weightedScore ?? session?.rawScore ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Session Over"
      description="Foundation for post-session summary and required rescheduling."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onDone}>Save Next Date</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            Weighted score: <span className="font-semibold text-slate-900">{weightedScore.toFixed(2)}</span>
          </p>
          <p>
            Duration: <span className="font-semibold text-slate-900">{formatDuration(session?.durationSeconds ?? null)}</span>
          </p>
        </div>

        <FormField label="Next session date" htmlFor="next-session-date" hint="Scheduling in this step is required by the phase-6 UX.">
          <div className="relative">
            <input id="next-session-date" type="date" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
            <CalendarDays className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-slate-500" />
          </div>
        </FormField>
      </div>
    </Dialog>
  );
}
