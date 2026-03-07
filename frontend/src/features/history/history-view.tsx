import { DataTable, type TableColumn } from "@/components/shared/data-table";

type HistoryRecord = {
  id: string;
  completedAt: string;
  textName: string;
  score: string;
  duration: string;
};

const historyRows: HistoryRecord[] = [
  { id: "h-1", completedAt: "Mar 07, 2026", textName: "Transit Announcements", score: "87%", duration: "11m" },
  { id: "h-2", completedAt: "Mar 06, 2026", textName: "Legal Press Briefing", score: "74%", duration: "16m" },
  { id: "h-3", completedAt: "Mar 05, 2026", textName: "Local Weather Update", score: "92%", duration: "8m" },
];

const columns: TableColumn<HistoryRecord>[] = [
  {
    id: "date",
    header: "Completed",
    className: "w-44",
    cell: (row) => row.completedAt,
  },
  {
    id: "text",
    header: "Text",
    cell: (row) => <button className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2">{row.textName}</button>,
  },
  {
    id: "score",
    header: "Score",
    className: "w-24",
    cell: (row) => <span className="font-semibold text-slate-900">{row.score}</span>,
  },
  {
    id: "duration",
    header: "Duration",
    className: "w-24",
    cell: (row) => row.duration,
  },
];

export function HistoryView() {
  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-slate-300 bg-slate-50 p-3">
        <h2 className="text-xl font-semibold text-slate-900">History</h2>
        <p className="mt-1 text-sm text-slate-700">Session ledger foundation with sortable-table styling and clickable text references.</p>
      </header>

      <DataTable
        title="Completed Sessions"
        subtitle="Date completed, text, weighted score, and duration."
        columns={columns}
        rows={historyRows}
        getRowKey={(row) => row.id}
      />
    </section>
  );
}
