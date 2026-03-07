import { CalendarCheck2, ChevronLeft, ChevronRight, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NextSessionCandidate = {
  textName: string;
  level: string;
  dueLabel: string;
};

type ScheduleRow = NextSessionCandidate & {
  bucket: "Overdue" | "Due Today" | "Upcoming";
};

const scheduleRows: ScheduleRow[] = [
  { textName: "Transit Announcements", level: "B1", dueLabel: "2 days overdue", bucket: "Overdue" },
  { textName: "Food Market Dialogue", level: "A2", dueLabel: "Today 5:30 PM", bucket: "Due Today" },
  { textName: "Legal Press Briefing", level: "C1", dueLabel: "Tue, Mar 10", bucket: "Upcoming" },
  { textName: "Hospital Intake Script", level: "B2", dueLabel: "Fri, Mar 13", bucket: "Upcoming" },
];

type ScheduleViewProps = {
  onStartNextSession: (candidate: NextSessionCandidate) => void;
};

export function ScheduleView({ onStartNextSession }: ScheduleViewProps) {
  const candidate = scheduleRows[0];

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Schedule</h2>
          <p className="mt-1 text-sm text-slate-700">Prioritized list and weekly map for your next dictation run.</p>
        </div>

        <Button
          onClick={() => {
            onStartNextSession(candidate);
          }}
        >
          <Play className="mr-2 h-4 w-4" />
          Start Next Session
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <article className="rounded-xl border border-slate-300 bg-white">
          <header className="border-b border-slate-200 px-4 py-3">
            <h3 className="font-semibold text-slate-800">Due Queue</h3>
          </header>

          <ul className="divide-y divide-slate-200">
            {scheduleRows.map((row) => (
              <li key={row.textName} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{row.textName}</p>
                  <p className="text-sm text-slate-600">Level {row.level}</p>
                </div>

                <div className="text-right">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                      row.bucket === "Overdue" && "border-rose-200 bg-rose-50 text-rose-700",
                      row.bucket === "Due Today" && "border-amber-200 bg-amber-50 text-amber-700",
                      row.bucket === "Upcoming" && "border-slate-300 bg-slate-100 text-slate-700",
                    )}
                  >
                    {row.bucket}
                  </span>
                  <p className="mt-1 text-xs text-slate-500">{row.dueLabel}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-300 bg-white">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="font-semibold text-slate-800">Week of Mar 9</h3>
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-md border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-md border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="grid grid-cols-7 gap-2 px-3 py-4 text-center">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
              <div key={day} className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs font-semibold uppercase text-slate-500">{day}</p>
                <p className="text-sm font-medium text-slate-800">{index + 9}</p>
                {[1, 4].includes(index) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <CalendarCheck2 className="h-3 w-3" />
                    Session
                  </span>
                )}
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
