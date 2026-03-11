import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { FormField } from "@/components/shared/form-primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import { upsertTextSchedule } from "@/lib/api/schedule";
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

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && typeof error.payload === "object" && error.payload !== null) {
    const payload = error.payload as { error?: { message?: string } };
    const apiMessage = payload.error?.message;
    if (apiMessage) {
      return apiMessage;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to save next session date.";
}

export function SessionOverDialog({ open, session, onOpenChange, onDone }: SessionOverDialogProps) {
  const [nextSessionDate, setNextSessionDate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  useEffect(() => {
    if (!open) {
      setNextSessionDate("");
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [open]);

  const weightedScore = session?.weightedScore ?? session?.rawScore ?? 0;

  async function saveNextDate() {
    if (!session) {
      return;
    }
    if (!nextSessionDate) {
      setErrorMessage("Choose a next session date to continue.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await upsertTextSchedule(session.textId, nextSessionDate);
      onDone();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Session Complete!"
      description="Review your result and set the next scheduled date before returning to Schedule."
      size="sm"
      footer={
        <>
          <Button onClick={() => void saveNextDate()} disabled={isSaving || !session}>
            {isSaving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Save Next Date
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {errorMessage && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>}

        <div className="rounded-md border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            Weighted score: <span className="font-semibold text-slate-900">{Math.round(weightedScore * 100)}</span>
          </p>
          <p>
            Duration: <span className="font-semibold text-slate-900">{formatDuration(session?.durationSeconds ?? null)}</span>
          </p>
        </div>

        <FormField label="Next session date" htmlFor="next-session-date" hint="Required to complete the post-session flow.">
          <input
            id="next-session-date"
            type="date"
            value={nextSessionDate}
            min={todayIso}
            onChange={(event) => {
              setNextSessionDate(event.target.value);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            disabled={isSaving}
            required
          />
        </FormField>
      </div>
    </Dialog>
  );
}
