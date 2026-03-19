import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, ChevronLeft, ChevronRight, LoaderCircle, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fetchSchedule, upsertTextSchedule, type ScheduleEntry } from "@/lib/api/schedule";
import { cn } from "@/lib/utils";
import {
  fetchTexts,
  updateText,
  updateTextTranscript,
  uploadTextClips,
  validateTextReadiness,
  type TextRecord,
} from "@/lib/api/texts";
import {
  TextFormDialog,
  type TextFormSubmitPayload,
  getErrorMessage,
} from "@/features/texts/text-form-dialog";

export type NextSessionCandidate = {
  textId: number;
  textName: string;
  level: string;
  dueLabel: string;
};

type DueBucket = "Overdue" | "Due Today" | "Upcoming";

type ScheduleRow = {
  id: number;
  textId: number;
  textName: string;
  level: string;
  dueDate: string;
  dueLabel: string;
  isReady: boolean;
  bucket: "Overdue" | "Due Today" | "Upcoming";
  createdAt: string;
};

type CalendarDay = {
  key: string;
  dateIso: string;
  dayLabel: string;
  dayOfMonth: string;
  isToday: boolean;
  sessions: ScheduleRow[];
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const BUCKET_ORDER: Record<DueBucket, number> = {
  Overdue: 0,
  "Due Today": 1,
  Upcoming: 2,
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getWeekStart(date: Date): Date {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  clone.setDate(clone.getDate() + diff);
  clone.setHours(12, 0, 0, 0);
  return clone;
}

function shiftDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

function formatDueLabel(dateIso: string, todayIso: string): string {
  if (dateIso === todayIso) {
    return "Today";
  }

  const parsed = parseIsoDate(dateIso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function getDueBucket(dateIso: string, todayIso: string): DueBucket {
  if (dateIso < todayIso) {
    return "Overdue";
  }
  if (dateIso === todayIso) {
    return "Due Today";
  }
  return "Upcoming";
}

function toScheduleRows(rows: ScheduleEntry[], todayIso: string): ScheduleRow[] {
  return rows.map((row) => ({
    id: row.id,
    textId: row.textId,
    textName: row.text.name,
    level: row.text.level,
    dueDate: row.nextSessionDate,
    dueLabel: formatDueLabel(row.nextSessionDate, todayIso),
    isReady: row.text.isReady,
    bucket: getDueBucket(row.nextSessionDate, todayIso),
    createdAt: row.createdAt,
  }));
}

function sortScheduleRows(rows: ScheduleRow[], bucket: DueBucket): ScheduleRow[] {
  return [...rows].sort((a, b) => {
    if (bucket === "Due Today") {
      // Due Today: Sort by level ASC, then createdAt ASC
      if (a.level !== b.level) {
        return a.level.localeCompare(b.level);
      }
      return a.createdAt.localeCompare(b.createdAt);
    }

    // Overdue and Upcoming: Sort by dueDate ASC, then level ASC, then createdAt ASC
    if (a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.level !== b.level) {
      return a.level.localeCompare(b.level);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

type ScheduleViewProps = {
  onStartNextSession: (candidate: NextSessionCandidate) => void;
};

export function ScheduleView({ onStartNextSession }: ScheduleViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [todayIso, setTodayIso] = useState(() => toIsoDate(new Date()));
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<TextRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetchSchedule();
      const resolvedToday = response.today || toIsoDate(new Date());
      setTodayIso(resolvedToday);
      setRows(toScheduleRows(response.schedule, resolvedToday));
      setWeekStart(getWeekStart(parseIsoDate(resolvedToday)));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetchSchedule();
        if (!active) {
          return;
        }
        const resolvedToday = response.today || toIsoDate(new Date());
        setTodayIso(resolvedToday);
        setRows(toScheduleRows(response.schedule, resolvedToday));
        setWeekStart(getWeekStart(parseIsoDate(resolvedToday)));
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

    void init();

    return () => {
      active = false;
    };
  }, []);

  const handleEditClick = useCallback(async (textId: number) => {
    try {
      // Fetch the full text record for editing
      const texts = await fetchTexts();
      const text = texts.find((t) => t.id === textId);
      if (text) {
        setSelectedText(text);
        setDialogError(null);
        setDialogOpen(true);
      } else {
        setErrorMessage("Text not found");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, []);

  const handleDialogClose = useCallback(() => {
    if (isSaving) {
      return;
    }
    setDialogOpen(false);
    setSelectedText(null);
    setDialogError(null);
  }, [isSaving]);

  const handleTextSubmit = useCallback(async (payload: TextFormSubmitPayload) => {
    if (!selectedText) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setDialogError(null);

    try {
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
        await validateTextReadiness(selectedText.id);
      }

      // Refresh the schedule to show updated data
      await loadSchedule();

      setDialogOpen(false);
      setSelectedText(null);
      setDialogError(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [selectedText, loadSchedule]);

  const groupedRows = useMemo(() => {
    const grouped: Record<DueBucket, ScheduleRow[]> = {
      Overdue: [],
      "Due Today": [],
      Upcoming: [],
    };

    for (const row of rows) {
      grouped[row.bucket].push(row);
    }

    // Sort each bucket according to wireframe specifications
    grouped.Overdue = sortScheduleRows(grouped.Overdue, "Overdue");
    grouped["Due Today"] = sortScheduleRows(grouped["Due Today"], "Due Today");
    grouped.Upcoming = sortScheduleRows(grouped.Upcoming, "Upcoming");

    return grouped;
  }, [rows]);

  const nextCandidate = useMemo<NextSessionCandidate | null>(() => {
    const dueTodayRows = groupedRows["Due Today"];
    if (dueTodayRows.length === 0) {
      return null;
    }

    const candidate = dueTodayRows[0];
    return {
      textId: candidate.textId,
      textName: candidate.textName,
      level: candidate.level,
      dueLabel: candidate.dueLabel,
    };
  }, [groupedRows]);

  const weekDays = useMemo<CalendarDay[]>(() => {
    const entriesByDate = new Map<string, ScheduleRow[]>();
    for (const row of rows) {
      const existing = entriesByDate.get(row.dueDate);
      if (existing) {
        existing.push(row);
      } else {
        entriesByDate.set(row.dueDate, [row]);
      }
    }

    return Array.from({ length: 7 }, (_, index) => {
      const dayDate = shiftDays(weekStart, index);
      const dateIso = toIsoDate(dayDate);
      const sessions = entriesByDate.get(dateIso) || [];

      return {
        key: `${dateIso}-${index}`,
        dateIso,
        dayLabel: WEEKDAY_LABELS[dayDate.getDay()],
        dayOfMonth: String(dayDate.getDate()),
        isToday: dateIso === todayIso,
        sessions,
      };
    });
  }, [rows, todayIso, weekStart]);

  const weekLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(weekStart),
    [weekStart],
  );

  const hasRows = rows.length > 0;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Schedule</h2>
          <p className="mt-1 text-sm text-slate-700">Prioritized list and weekly map for your next dictation run.</p>
        </div>

        <Button
          disabled={isLoading}
          onClick={() => {
            if (!nextCandidate) {
              toast.info("No sessions scheduled for today");
              return;
            }
            onStartNextSession(nextCandidate);
          }}
        >
          <Play className="mr-2 h-4 w-4" />
          Start Next Session
        </Button>
      </header>

      {errorMessage && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <article className="rounded-xl border border-slate-300 bg-white">
          <header className="border-b border-slate-200 px-4 py-3">
            <h3 className="font-semibold text-slate-800">Due Queue</h3>
          </header>

          {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-600">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading schedule...
            </div>
          ) : !hasRows ? (
            <p className="px-4 py-5 text-sm text-slate-600">No scheduled sessions yet. Add schedule dates to texts to populate this workspace.</p>
          ) : (
            <div className="space-y-3 px-3 py-3">
              {(["Overdue", "Due Today", "Upcoming"] as DueBucket[]).map((bucket) => (
                <section key={bucket} className="rounded-lg border border-slate-200 bg-slate-50/60">
                  <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">{bucket}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{groupedRows[bucket].length}</span>
                  </header>

                  {groupedRows[bucket].length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-500">No items</p>
                  ) : (
                    <ul className="divide-y divide-slate-200/80">
                      {groupedRows[bucket].map((row) => (
                        <li key={`${bucket}-${row.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div>
                            <button
                              type="button"
                              onClick={() => handleEditClick(row.textId)}
                              className="font-medium text-slate-900 underline decoration-slate-400 underline-offset-2 transition-colors hover:text-blue-600 hover:decoration-blue-400"
                            >
                              {row.textName}
                            </button>
                            <p className="text-xs text-slate-600">Level {row.level}</p>
                            <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                              <CalendarCheck2 className="h-3.5 w-3.5" />
                              Session scheduled
                            </p>
                          </div>

                          <div className="text-right">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                                row.bucket === "Overdue" && "border-rose-200 bg-rose-50 text-rose-700",
                                row.bucket === "Due Today" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                                row.bucket === "Upcoming" && "border-slate-300 bg-slate-100 text-slate-700",
                              )}
                            >
                              {row.bucket}
                            </span>
                            <p className="mt-1 text-xs text-slate-500">{row.dueLabel}</p>
                            {!row.isReady && <p className="text-[11px] text-rose-600">Text not ready</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-xl border border-slate-300 bg-white">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="font-semibold text-slate-800">Week of {weekLabel}</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100"
                onClick={() => setWeekStart((prev) => shiftDays(prev, -7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100"
                onClick={() => setWeekStart((prev) => shiftDays(prev, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="grid grid-cols-7 gap-2 px-3 py-4 text-center">
            {weekDays.map((day) => (
              <div
                key={day.key}
                className={cn(
                  "space-y-1 rounded-lg border p-2",
                  day.isToday ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-slate-50",
                )}
              >
                <p className="text-xs font-semibold uppercase text-slate-500">{day.dayLabel}</p>
                <p className="text-sm font-medium text-slate-800">{day.dayOfMonth}</p>
                {day.sessions.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <CalendarCheck2 className="h-3 w-3" />
                    {day.sessions.length === 1 ? "1 Session" : `${day.sessions.length} Sessions`}
                  </span>
                )}
                {day.sessions.length === 0 && <p className="text-[10px] text-slate-400">-</p>}
              </div>
            ))}
          </div>

          {!isLoading && !hasRows && (
            <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">Calendar indicators appear once schedule dates are assigned.</p>
          )}

          {!isLoading && hasRows && (
            <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
              {nextCandidate ? (
                <p>
                  Next launch target: <span className="font-semibold text-slate-900">{nextCandidate.textName}</span> ({nextCandidate.dueLabel})
                </p>
              ) : (
                <p>No sessions scheduled for today.</p>
              )}
            </div>
          )}
        </article>
      </div>

      <TextFormDialog
        open={dialogOpen}
        mode="edit"
        text={selectedText}
        isSubmitting={isSaving}
        externalError={dialogError}
        onClose={handleDialogClose}
        onSubmit={handleTextSubmit}
        onClearExternalError={() => setDialogError(null)}
      />
    </section>
  );
}
