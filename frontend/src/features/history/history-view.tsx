import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { DataTable, type TableColumn } from "@/components/shared/data-table";
import { ApiError } from "@/lib/api/client";
import { fetchSessionHistory, type SessionHistoryRecord } from "@/lib/api/sessions";

type HistoryRecord = {
  id: number;
  completedAt: string;
  score: string;
  session: SessionHistoryRecord;
};

type HistoryViewProps = {
  onEditText: (textId: number) => void;
};

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

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

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

function formatScore(weightedScore: number | null): string {
  if (typeof weightedScore !== "number" || Number.isNaN(weightedScore)) {
    return "-";
  }
  return String(Math.round(weightedScore * 100));
}

const columns: TableColumn<HistoryRecord>[] = [
  {
    id: "date",
    header: "Date Completed",
    className: "w-44",
    cell: (row) => row.completedAt,
  },
  {
    id: "text",
    header: "Text",
    cell: () => null,
  },
  {
    id: "score",
    header: "Score",
    className: "w-24 text-right",
    cell: (row) => <span className="font-semibold text-slate-900">{row.score}</span>,
  },
];

export function HistoryView({ onEditText }: HistoryViewProps) {
  const [records, setRecords] = useState<SessionHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const sessions = await fetchSessionHistory();
        if (!active) {
          return;
        }
        setRecords(sessions);
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

  const rows = useMemo<HistoryRecord[]>(
    () =>
      records.map((record) => ({
        id: record.id,
        completedAt: formatDate(record.endedAt || record.startedAt),
        score: formatScore(record.weightedScore),
        session: record,
      })),
    [records],
  );

  const tableColumns = useMemo<TableColumn<HistoryRecord>[]>(
    () => [
      columns[0],
      {
        ...columns[1],
        cell: (row) => (
          <button
            type="button"
            className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
            onClick={() => onEditText(row.session.textId)}
          >
            {row.session.textName}
          </button>
        ),
      },
      columns[2],
    ],
    [onEditText],
  );

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="flex-shrink-0 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <h2 className="text-xl font-semibold text-slate-900">History</h2>
        <p className="mt-1 text-sm text-slate-700">Review completed sessions by completion date, text, and weighted score.</p>
      </header>

      {errorMessage && <p className="flex-shrink-0 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>}

      {isLoading ? (
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading completed sessions...
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <DataTable
            title="Completed Sessions"
            subtitle="Click a text name to open it in Edit Text."
            columns={tableColumns}
            rows={rows}
            getRowKey={(row) => String(row.id)}
            emptyMessage="No completed sessions yet."
          />
        </div>
      )}
    </section>
  );
}
