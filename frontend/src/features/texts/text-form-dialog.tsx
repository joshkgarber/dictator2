import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { FormField, FormSection } from "@/components/shared/form-primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { upsertTextSchedule } from "@/lib/api/schedule";
import {
  createText,
  TEXT_LEVELS,
  type TextLevel,
  type TextReadiness,
  type TextRecord,
  updateText,
  updateTextTranscript,
  uploadTextClips,
  validateTextReadiness,
} from "@/lib/api/texts";
import { ApiError } from "@/lib/api/client";

export type DialogMode = "new" | "edit" | "delete" | null;

export type TextFormSubmitPayload = {
  name: string;
  level: TextLevel;
  scheduledDate: string;
  transcriptRaw: string | null;
  clips: File[];
};

type ClipInspection = {
  indexes: number[];
  invalidNames: string[];
  duplicateIndexes: number[];
};

const CLIP_NAME_PATTERN = /^c-(\d+)\.mp3$/i;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTranscriptLines(transcriptRaw: string): string[] {
  return transcriptRaw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line: string) => line.trim())
    .filter(Boolean);
}

function inspectClipFiles(files: File[]): ClipInspection {
  const indexes: number[] = [];
  const invalidNames: string[] = [];
  const seenIndexes = new Set<number>();
  const duplicateIndexes: number[] = [];

  for (const file of files) {
    const match = CLIP_NAME_PATTERN.exec(file.name);
    if (!match) {
      invalidNames.push(file.name);
      continue;
    }

    const parsed = Number(match[1]);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      invalidNames.push(file.name);
      continue;
    }

    if (seenIndexes.has(parsed)) {
      duplicateIndexes.push(parsed);
      continue;
    }

    seenIndexes.add(parsed);
    indexes.push(parsed);
  }

  indexes.sort((a, b) => a - b);
  duplicateIndexes.sort((a, b) => a - b);

  return {
    indexes,
    invalidNames,
    duplicateIndexes,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const payload = error.payload as { error?: { message?: string } };
    const apiMessage = payload?.error?.message;
    if (apiMessage) {
      return apiMessage;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed";
}

export type TextFormDialogProps = {
  open: boolean;
  mode: DialogMode;
  text: TextRecord | null;
  isSubmitting: boolean;
  externalError: string | null;
  onClose: () => void;
  onSubmit: (payload: TextFormSubmitPayload) => void;
  onClearExternalError: () => void;
  onSuccess?: () => void;
  onDelete?: () => void;
};

export function TextFormDialog({
  open,
  mode,
  text,
  isSubmitting,
  externalError,
  onClose,
  onSubmit,
  onClearExternalError,
  onSuccess,
  onDelete,
}: TextFormDialogProps) {
  const [name, setName] = useState(text?.name || "");
  const [level, setLevel] = useState<TextLevel>(text?.level || "B1");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcriptRaw, setTranscriptRaw] = useState<string | null>(null);
  const [transcriptLineCount, setTranscriptLineCount] = useState<number | null>(null);
  const [clips, setClips] = useState<File[]>([]);
  const [scheduledDate, setScheduledDate] = useState(text?.schedule?.nextSessionDate || "");
  const [localError, setLocalError] = useState<string | null>(null);
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(text?.name || "");
    setLevel(text?.level || "B1");
    setTranscriptFile(null);
    setTranscriptRaw(null);
    setTranscriptLineCount(null);
    setClips([]);
    setScheduledDate(text?.schedule?.nextSessionDate || "");
    setLocalError(null);
  }, [open, text]);

  async function handleTranscriptSelection(file: File | null) {
    setTranscriptFile(file);
    setTranscriptRaw(null);
    setTranscriptLineCount(null);

    if (!file) {
      return;
    }

    const raw = await file.text();
    const lines = parseTranscriptLines(raw);
    setTranscriptRaw(raw);
    setTranscriptLineCount(lines.length);
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setLocalError("Name is required");
      return;
    }

    if (!scheduledDate) {
      setLocalError("Scheduled date is required");
      return;
    }

    if (scheduledDate < todayIso) {
      setLocalError("Scheduled date cannot be in the past");
      return;
    }

    if (mode === "new" && !transcriptRaw) {
      setLocalError("Select a transcript .txt file before creating a text");
      return;
    }

    if (transcriptRaw !== null && parseTranscriptLines(transcriptRaw).length === 0) {
      setLocalError("Transcript file must include at least one non-empty line");
      return;
    }

    const clipInspection = inspectClipFiles(clips);
    if (clipInspection.invalidNames.length > 0) {
      setLocalError(`Clip names must follow c-<index>.mp3. Invalid: ${clipInspection.invalidNames.slice(0, 3).join(", ")}`);
      return;
    }

    if (clipInspection.duplicateIndexes.length > 0) {
      setLocalError(`Duplicate clip indexes found: ${clipInspection.duplicateIndexes.join(", ")}`);
      return;
    }

    const effectiveLineCount = transcriptLineCount;
    if (effectiveLineCount !== null && clipInspection.indexes.length > 0) {
      const clipSet = new Set(clipInspection.indexes);
      const missingIndexes: number[] = [];
      for (let index = 1; index <= effectiveLineCount; index += 1) {
        if (!clipSet.has(index)) {
          missingIndexes.push(index);
        }
      }

      if (missingIndexes.length > 0) {
        setLocalError(
          `Transcript has ${effectiveLineCount} lines but clip directory is missing indexes: ${missingIndexes
            .slice(0, 8)
            .join(", ")}${missingIndexes.length > 8 ? "..." : ""}`,
        );
        return;
      }
    }

    onSubmit({
      name: trimmedName,
      level,
      scheduledDate,
      transcriptRaw,
      clips,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      title={mode === "edit" ? "Edit Text" : "New Text"}
      description="Select transcript and clip assets, then validate readiness for scheduling and sessions."
      footer={
        <>
          {mode === "edit" && (
            <Button
              className="mr-auto bg-gray-200 text-white hover:bg-red-500 hover:text-black"
              onClick={onDelete}
              disabled={isSubmitting}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="text-form" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Save Changes" : "Create Text"}
          </Button>
        </>
      }
    >
      <form id="text-form" className="space-y-3" onSubmit={submitForm} noValidate>
        {localError && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {localError}
          </p>
        )}

        <FormSection title="Metadata" description="Set core text identity before validating transcript and clips.">
          <FormField label="Name" htmlFor="text-name">
            <input
              id="text-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              placeholder="Radio interview transcript"
              required
            />
          </FormField>

          <FormField label="Level" htmlFor="text-level">
            <select
              id="text-level"
              value={level}
              onChange={(event) => setLevel(event.target.value as TextLevel)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {TEXT_LEVELS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Scheduled Date" htmlFor="text-scheduled-date" hint="Required. Used to place the text in the session schedule.">
            <input
              id="text-scheduled-date"
              type="date"
              value={scheduledDate}
              min={todayIso}
              onChange={(event) => setScheduledDate(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              required
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScheduledDate(todayIso)}
                disabled={isSubmitting}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setScheduledDate(toIsoDate(tomorrow));
                }}
                disabled={isSubmitting}
              >
                Tomorrow
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  setScheduledDate(toIsoDate(nextWeek));
                }}
                disabled={isSubmitting}
              >
                In a week
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextMonth = new Date();
                  nextMonth.setDate(nextMonth.getDate() + 30);
                  setScheduledDate(toIsoDate(nextMonth));
                }}
                disabled={isSubmitting}
              >
                In a month
              </Button>
            </div>
          </FormField>
        </FormSection>

        <FormSection
          title="Source Files"
          description="Transcript lines must map cleanly to clips named c-1.mp3, c-2.mp3, and so on."
        >
          <FormField
            label={mode === "edit" ? "Transcript file (replace optional)" : "Transcript file"}
            htmlFor="text-transcript"
            hint="Plain text (.txt). One transcript line becomes one session clip index."
          >
            <input
              id="text-transcript"
              type="file"
              accept=".txt,text/plain"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                void handleTranscriptSelection(file);
              }}
            />
            {transcriptFile && (
              <p className="text-xs text-slate-600">
                {transcriptFile.name} {transcriptLineCount !== null ? `(${transcriptLineCount} parsed lines)` : ""}
              </p>
            )}
            {!transcriptFile && mode === "edit" && (
              <p className="text-xs text-slate-500">Keeping existing transcript ({text?.lineCount || 0} lines).</p>
            )}
          </FormField>

          <FormField
            label="Audio clips directory"
            htmlFor="text-clips"
            hint="Choose a folder with c-<index>.mp3 clips. Uploading clips updates existing indexes."
          >
            <input
              id="text-clips"
              type="file"
              multiple
              accept=".mp3,audio/mpeg"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => {
                setClips(Array.from(event.target.files || []));
                onClearExternalError();
              }}
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            />
            <p className="text-xs text-slate-600">
              {clips.length > 0
                ? `${clips.length} clips selected (${inspectClipFiles(clips).indexes.length} valid c-<index>.mp3 names)`
                : "No new clips selected"}
            </p>
          </FormField>
          {externalError && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {externalError}
            </p>
          )}
        </FormSection>
      </form>
    </Dialog>
  );
}

// Re-export types and helpers for backward compatibility
export { toIsoDate, parseTranscriptLines, inspectClipFiles, getErrorMessage, CLIP_NAME_PATTERN };
export type { ClipInspection };
