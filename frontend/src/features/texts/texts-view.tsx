import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";

import { DataTable, type TableColumn } from "@/components/shared/data-table";
import { FormField, FormSection } from "@/components/shared/form-primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import { upsertTextSchedule } from "@/lib/api/schedule";
import {
  createText,
  deleteText,
  fetchTexts,
  TEXT_LEVELS,
  type TextLevel,
  type TextReadiness,
  type TextRecord,
  updateText,
  updateTextTranscript,
  uploadTextClips,
  validateTextReadiness,
} from "@/lib/api/texts";

type DialogMode = "new" | "edit" | "delete" | null;

type SortField = "name" | "level" | "lineCount" | "clipCount" | "updatedAt" | "readiness";
type SortDirection = "asc" | "desc";

type TextFormSubmitPayload = {
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function parseTranscriptLines(transcriptRaw: string): string[] {
  return transcriptRaw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line: string) => line.trim())
    .filter(Boolean);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function compareTextRows(a: TextRecord, b: TextRecord, field: SortField, direction: SortDirection): number {
  const multiplier = direction === "asc" ? 1 : -1;
  if (field === "name") {
    return a.name.localeCompare(b.name) * multiplier;
  }
  if (field === "level") {
    return a.level.localeCompare(b.level) * multiplier;
  }
  if (field === "lineCount") {
    return (a.lineCount - b.lineCount) * multiplier;
  }
  if (field === "clipCount") {
    return (a.clipCount - b.clipCount) * multiplier;
  }
  if (field === "updatedAt") {
    return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * multiplier;
  }
  return (Number(a.isReady) - Number(b.isReady)) * multiplier;
}

function getReadinessState(text: TextRecord, detail?: TextReadiness) {
  if (text.isReady) {
    return {
      label: "Ready",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      description: "Eligible for scheduling and sessions",
    };
  }

  if (text.lineCount <= 0) {
    return {
      label: "Needs transcript",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      description: "Upload a transcript with at least one line",
    };
  }

  if (detail && detail.missingIndexes.length > 0) {
    return {
      label: "Needs clips",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      description: `Missing clip indexes: ${detail.missingIndexes.slice(0, 8).join(", ")}${detail.missingIndexes.length > 8 ? "..." : ""}`,
    };
  }

  if (text.clipCount < text.lineCount) {
    return {
      label: "Needs clips",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      description: `${text.lineCount - text.clipCount} clips missing`,
    };
  }

  if (text.clipCount > text.lineCount) {
    return {
      label: "Clip mismatch",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
      description: `${text.clipCount - text.lineCount} extra clips uploaded`,
    };
  }

  return {
    label: "Not validated",
    tone: "border-slate-300 bg-slate-100 text-slate-700",
    description: "Run validation after transcript or clip updates",
  };
}

type TextsViewProps = {
  openTextId?: number | null;
  onOpenTextHandled?: () => void;
};

export function TextsView({ openTextId = null, onOpenTextHandled }: TextsViewProps) {
  const [mode, setMode] = useState<DialogMode>(null);
  const [selectedTextId, setSelectedTextId] = useState<number | null>(null);
  const [texts, setTexts] = useState<TextRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<"ALL" | TextLevel>("ALL");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [readinessDetails, setReadinessDetails] = useState<Record<number, TextReadiness>>({});
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const rows = await fetchTexts();
        if (!active) {
          return;
        }
        setTexts(rows);
      } catch (error) {
        if (!active) {
          return;
        }
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (openTextId === null) {
      return;
    }

    const matchingText = texts.find((text) => text.id === openTextId);
    if (matchingText) {
      setSelectedTextId(matchingText.id);
      setMode("edit");
      onOpenTextHandled?.();
      return;
    }

    if (!isLoading) {
      setErrorMessage("That text is no longer available.");
      onOpenTextHandled?.();
    }
  }, [isLoading, onOpenTextHandled, openTextId, texts]);

  const selectedText = useMemo(() => {
    if (selectedTextId === null) {
      return null;
    }
    return texts.find((text) => text.id === selectedTextId) || null;
  }, [selectedTextId, texts]);

  const rows = useMemo(() => {
    const filtered = levelFilter === "ALL" ? texts : texts.filter((text) => text.level === levelFilter);
    return [...filtered].sort((a, b) => compareTextRows(a, b, sortField, sortDirection));
  }, [levelFilter, sortDirection, sortField, texts]);

  const tableColumns: TableColumn<TextRecord>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Text",
        cell: (row) => (
          <div>
            <p className="font-semibold text-slate-900">{row.name}</p>
            <p className="text-xs text-slate-500">Updated {formatDate(row.updatedAt)}</p>
          </div>
        ),
      },
      {
        id: "level",
        header: "Level",
        className: "w-20",
        cell: (row) => <span className="font-medium">{row.level}</span>,
      },
      {
        id: "assets",
        header: "Assets",
        className: "w-48",
        cell: (row) => (
          <span className="text-slate-700">
            {row.lineCount} lines / {row.clipCount} clips
          </span>
        ),
      },
      {
        id: "readiness",
        header: "Readiness",
        className: "w-64",
        cell: (row) => {
          const state = getReadinessState(row, readinessDetails[row.id]);
          return (
            <div>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${state.tone}`}>{state.label}</span>
              <p className="mt-1 text-xs text-slate-500">{state.description}</p>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        className: "w-36",
        cell: (row) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-md border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setSelectedTextId(row.id);
                setDialogError(null);
                setMode("edit");
              }}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 p-1.5 text-rose-700 hover:bg-rose-50"
              onClick={() => {
                setSelectedTextId(row.id);
                setMode("delete");
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [readinessDetails],
  );

  async function upsertText(payload: TextFormSubmitPayload) {
    setIsSaving(true);
    setErrorMessage(null);
    setDialogError(null);

    try {
      if (mode === "new") {
        if (!payload.transcriptRaw) {
          throw new Error("Transcript file is required for new texts");
        }

        const created = await createText({
          name: payload.name,
          level: payload.level,
          transcriptRaw: payload.transcriptRaw,
        });

        await upsertTextSchedule(created.id, payload.scheduledDate);

        let nextText = created;
        if (payload.clips.length > 0) {
          try {
            await uploadTextClips(created.id, payload.clips);
            const readiness = await validateTextReadiness(created.id);
            setReadinessDetails((prev) => ({ ...prev, [created.id]: readiness }));
            nextText = {
              ...nextText,
              lineCount: readiness.lineCount,
              clipCount: readiness.clipCount,
              isReady: readiness.isReady,
            };
          } catch (clipError) {
            // On clip upload failure, delete the created text to avoid orphaned records
            await deleteText(created.id);
            setDialogError(getErrorMessage(clipError));
            setIsSaving(false);
            return;
          }
        }

        setTexts((prev) => [...prev, nextText]);
      }

      if (mode === "edit" && selectedText) {
        let changed = false;

        if (selectedText.name !== payload.name || selectedText.level !== payload.level) {
          await updateText(selectedText.id, { name: payload.name, level: payload.level });
          changed = true;
        }

        if (payload.transcriptRaw !== null) {
          await updateTextTranscript(selectedText.id, payload.transcriptRaw);
          changed = true;
        }

        if (payload.clips.length > 0) {
          try {
            await uploadTextClips(selectedText.id, payload.clips);
            changed = true;
          } catch (clipError) {
            setDialogError(getErrorMessage(clipError));
            setIsSaving(false);
            return;
          }
        }

        await upsertTextSchedule(selectedText.id, payload.scheduledDate);

        if (changed) {
          const readiness = await validateTextReadiness(selectedText.id);
          setReadinessDetails((prev) => ({ ...prev, [selectedText.id]: readiness }));
        }

        const refreshed = await fetchTexts();
        setTexts(refreshed);
      }

      setMode(null);
      setSelectedTextId(null);
      setDialogError(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function onDelete() {
    if (!selectedText) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await deleteText(selectedText.id);
      setTexts((prev) => prev.filter((row) => row.id !== selectedText.id));
      setReadinessDetails((prev) => {
        const next = { ...prev };
        delete next[selectedText.id];
        return next;
      });
      setMode(null);
      setSelectedTextId(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Texts</h2>
          <p className="mt-1 text-sm text-slate-700">Create, edit, validate, and delete texts before they enter scheduling and sessions.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Level
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value as "ALL" | TextLevel)}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="ALL">All</option>
              {TEXT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            Sort
            <select
              value={sortField}
              onChange={(event) => setSortField(event.target.value as SortField)}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="updatedAt">Updated date</option>
              <option value="name">Name</option>
              <option value="level">Level</option>
              <option value="lineCount">Line count</option>
              <option value="clipCount">Clip count</option>
              <option value="readiness">Readiness</option>
            </select>
          </label>

          <Button
            variant="outline"
            onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="min-w-[110px]"
          >
            <ArrowDownUp className="mr-2 h-4 w-4" />
            {sortDirection === "asc" ? "Ascending" : "Descending"}
          </Button>

          <Button
            onClick={() => {
              setSelectedTextId(null);
              setDialogError(null);
              setMode("new");
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Text
          </Button>
        </div>
      </header>

      {errorMessage && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>}

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading texts...
        </div>
      ) : (
        <DataTable
          title="Texts Inventory"
          subtitle="Transcript and clip validation determines whether a text is ready for scheduling and sessions."
          columns={tableColumns}
          rows={rows}
          getRowKey={(row) => String(row.id)}
          emptyMessage="No texts yet. Create one to begin validation."
        />
      )}

      <TextFormDialog
        open={mode === "new" || mode === "edit"}
        mode={mode}
        text={selectedText}
        isSubmitting={isSaving}
        externalError={dialogError}
        onClose={() => {
          if (isSaving) {
            return;
          }
          setMode(null);
          setDialogError(null);
        }}
        onSubmit={(payload) => {
          void upsertText(payload);
        }}
        onClearExternalError={() => setDialogError(null)}
      />

      <DeleteTextDialog
        open={mode === "delete"}
        text={selectedText}
        isSubmitting={isSaving}
        onCancel={() => {
          if (isSaving) {
            return;
          }
          setMode(null);
        }}
        onConfirm={() => {
          void onDelete();
        }}
      />
    </section>
  );
}

type TextFormDialogProps = {
  open: boolean;
  mode: DialogMode;
  text: TextRecord | null;
  isSubmitting: boolean;
  externalError: string | null;
  onClose: () => void;
  onSubmit: (payload: TextFormSubmitPayload) => void;
  onClearExternalError: () => void;
};

function TextFormDialog({ open, mode, text, isSubmitting, externalError, onClose, onSubmit, onClearExternalError }: TextFormDialogProps) {
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

type DeleteTextDialogProps = {
  open: boolean;
  text: TextRecord | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteTextDialog({ open, text, isSubmitting, onCancel, onConfirm }: DeleteTextDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
      title="Delete Text"
      description="This removes the text and its associated schedule and session history."
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Keep Text
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </>
      }
      size="sm"
    >
      <p className="text-sm text-slate-700">
        Delete <span className="font-semibold text-slate-900">{text?.name || "this text"}</span>? This action cannot be undone.
      </p>
    </Dialog>
  );
}
