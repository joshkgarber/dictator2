import { useState } from "react";
import { Volume2 } from "lucide-react";

import { FormField } from "@/components/shared/form-primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { NextSessionCandidate } from "@/features/schedule/schedule-view";

type SessionDialogProps = {
  open: boolean;
  candidate: NextSessionCandidate | null;
  onOpenChange: (open: boolean) => void;
  onSessionOver: () => void;
};

export function SessionDialog({ open, candidate, onOpenChange, onSessionOver }: SessionDialogProps) {
  const [attempt, setAttempt] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Session"
      description={`Now training: ${candidate?.textName || "Selected text"}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Exit
          </Button>
          <Button onClick={onSessionOver}>End Session</Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <section className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <header className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Clip Console</h3>
            <button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
              <Volume2 className="h-3.5 w-3.5" />
              Replay Clip
            </button>
          </header>

          <div className="min-h-[220px] rounded-md border border-slate-300 bg-white p-3 font-mono text-sm leading-6 text-slate-700">
            <p>&gt; Clip 04 / 42</p>
            <p className="text-slate-500">Type attempt text or exact command: replay, keep, showdiff, tutor, answer, help, exit.</p>
            <p className="text-emerald-700">Last score: 91%</p>
          </div>

          <FormField label="Attempt Input" htmlFor="attempt-input" hint="Reserved command words are parsed before attempt submission.">
            <input
              id="attempt-input"
              value={attempt}
              onChange={(event) => setAttempt(event.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              placeholder="Type attempt or command..."
            />
          </FormField>
        </section>

        <aside className="space-y-2 rounded-lg border border-slate-300 bg-white p-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Command Reference</h4>
          <ul className="space-y-1 text-sm text-slate-700">
            {["replay", "keep", "showdiff", "tutor", "answer", "help", "exit"].map((command) => (
              <li key={command} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
                {command}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </Dialog>
  );
}
