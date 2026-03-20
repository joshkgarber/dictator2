import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, LoaderCircle, Plus } from "lucide-react";

import { DataTable, type TableColumn } from "@/components/shared/data-table";
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
import {
  TextFormDialog,
  type DialogMode,
  type TextFormSubmitPayload,
  getErrorMessage,
  toIsoDate,
} from "./text-form-dialog";

type SortField = "name" | "level" | "lineCount" | "clipCount" | "updatedAt" | "readiness";
type SortDirection = "asc" | "desc";

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
            <button
              type="button"
              onClick={() => {
                setSelectedTextId(row.id);
                setDialogError(null);
                setMode("edit");
              }}
              className="font-semibold text-slate-900 underline-offset-2 hover:underline"
            >
              {row.name}
            </button>
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
            // On clip upload failure, switch to edit mode so user can retry with different clips
            const textWithSchedule = {
              ...created,
              schedule: {
                id: 0, // Placeholder, will be refetched on next load
                nextSessionDate: payload.scheduledDate,
                notes: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            };
            setTexts((prev) => [...prev, textWithSchedule]);
            setSelectedTextId(created.id);
            setMode("edit");
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
    <section className="flex h-full flex-col gap-4">
      <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
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

      {errorMessage && <p className="flex-shrink-0 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>}

      {isLoading ? (
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading texts...
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <DataTable
            title="Texts Inventory"
            subtitle="Transcript and clip validation determines whether a text is ready for scheduling and sessions."
            columns={tableColumns}
            rows={rows}
            getRowKey={(row) => String(row.id)}
            emptyMessage="No texts yet. Create one to begin validation."
          />
        </div>
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
        onDelete={() => {
          setMode("delete");
        }}
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
