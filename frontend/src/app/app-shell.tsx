import { useEffect, useMemo, useState, type ComponentType } from "react";
import { CalendarDays, Clock3, History, NotebookTabs } from "lucide-react";

import { ApiStatusBadge } from "@/components/shared/api-status-badge";
import { Button } from "@/components/ui/button";
import { SessionDialog } from "@/features/session/session-dialog";
import { SessionOverDialog } from "@/features/session/session-over-dialog";
import { HistoryView } from "@/features/history/history-view";
import { ScheduleView, type NextSessionCandidate } from "@/features/schedule/schedule-view";
import { TextsView } from "@/features/texts/texts-view";
import type { SessionState } from "@/lib/api/sessions";
import { fetchHealth } from "@/lib/api/client";
import { useApiRequest } from "@/lib/api/use-api-request";
import { cn } from "@/lib/utils";

type AppTab = "schedule" | "texts" | "history";

type ShellTab = {
  id: AppTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const tabs: ShellTab[] = [
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "texts", label: "Texts", icon: NotebookTabs },
  { id: "history", label: "History", icon: History },
];

export function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>("schedule");
  const [sessionCandidate, setSessionCandidate] = useState<NextSessionCandidate | null>(null);
  const [isSessionOverOpen, setIsSessionOverOpen] = useState(false);
  const [lastCompletedSession, setLastCompletedSession] = useState<SessionState | null>(null);

  const healthRequest = useApiRequest(fetchHealth);

  useEffect(() => {
    void healthRequest.run();
  }, [healthRequest]);

  const shellHeadline = useMemo(() => {
    if (activeTab === "schedule") {
      return "Plan and launch your next dictation sessions.";
    }
    if (activeTab === "texts") {
      return "Manage source texts, clips, and readiness state.";
    }
    return "Review completed sessions and score trends.";
  }, [activeTab]);

  return (
    <main className="min-h-screen bg-app-canvas p-3 md:p-6">
      <div className="mx-auto max-w-[1200px] animate-fade-up">
        <section className="rounded-2xl border border-slate-400/60 bg-white/95 px-4 py-4 shadow-[0_14px_45px_rgba(18,28,45,0.14)] md:px-6">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-slate-500">Dictator 2.0 / Desktop</p>
              <h1 className="mt-1 text-3xl font-semibold leading-tight text-slate-900">Training Workspace</h1>
              <p className="mt-2 text-sm text-slate-700">{shellHeadline}</p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-full border border-slate-300 bg-slate-50 px-3 py-2">
              <Clock3 className="h-4 w-4 text-slate-600" />
              <ApiStatusBadge status={healthRequest.status} errorMessage={healthRequest.error?.message} />
              <Button size="sm" variant="outline" onClick={() => void healthRequest.run()}>
                Refresh
              </Button>
            </div>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Primary views">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <section className="mt-6 rounded-xl border border-slate-300 bg-white p-3 md:p-5">
            {activeTab === "schedule" && (
              <ScheduleView
                onStartNextSession={(candidate) => {
                  setSessionCandidate(candidate);
                }}
              />
            )}
            {activeTab === "texts" && <TextsView />}
            {activeTab === "history" && <HistoryView />}
          </section>
        </section>
      </div>

      <SessionDialog
        open={Boolean(sessionCandidate)}
        candidate={sessionCandidate}
        onOpenChange={(open) => {
          if (!open) {
            setSessionCandidate(null);
          }
        }}
        onSessionOver={(session) => {
          setSessionCandidate(null);
          setLastCompletedSession(session);
          setIsSessionOverOpen(true);
          setActiveTab("schedule");
        }}
      />

      <SessionOverDialog
        open={isSessionOverOpen}
        session={lastCompletedSession}
        onOpenChange={setIsSessionOverOpen}
        onDone={() => {
          setIsSessionOverOpen(false);
          setLastCompletedSession(null);
          setActiveTab("schedule");
        }}
      />
    </main>
  );
}
