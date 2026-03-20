import { useEffect, useMemo, useState, type ComponentType } from "react";
import { CalendarDays, Clock3, History, NotebookTabs } from "lucide-react";

import { ApiStatusBadge } from "@/components/shared/api-status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
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
  const { user, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AppTab>("schedule");
  const [sessionCandidate, setSessionCandidate] = useState<NextSessionCandidate | null>(null);
  const [isSessionOverOpen, setIsSessionOverOpen] = useState(false);
  const [lastCompletedSession, setLastCompletedSession] = useState<SessionState | null>(null);
  const [scheduleRefreshToken, setScheduleRefreshToken] = useState(0);
  const [textToEditFromHistory, setTextToEditFromHistory] = useState<number | null>(null);

  const healthRequest = useApiRequest(fetchHealth);

  useEffect(() => {
    void healthRequest.run();
  }, []);

  const shellHeadline = useMemo(() => {
    if (activeTab === "schedule") {
      return "View your schedule and launch your next session.";
    }
    if (activeTab === "texts") {
      return "Manage source texts, clips, and readiness state.";
    }
    return "Review completed sessions and score trends.";
  }, [activeTab]);

  return (
    <main className="h-screen overflow-hidden bg-background">
      <div className="flex h-full flex-col animate-fade-up">
        <section className="flex h-full flex-col border-x border-slate-400/60 bg-white/95 shadow-[0_14px_45px_rgba(18,28,45,0.14)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 pb-4 md:flex-row md:items-start md:justify-between md:px-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-slate-500">Dictator 2.0 / Desktop</p>
              <h1 className="mt-1 text-3xl font-semibold leading-tight text-slate-900">Training Workspace</h1>
              <p className="mt-2 text-sm text-slate-700">{shellHeadline}</p>
            </div>

            <div className="flex flex-col gap-2 self-start md:items-end">
              <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-2">
                <Clock3 className="h-4 w-4 text-slate-600" />
                <ApiStatusBadge status={healthRequest.status} errorMessage={healthRequest.error?.message} />
                <Button size="sm" variant="outline" onClick={() => void healthRequest.run()}>
                  Refresh
                </Button>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
                <span className="font-medium">Signed in as {user?.username || user?.email || "user"}</span>
                <Button size="sm" variant="ghost" onClick={() => void logout()} disabled={isLoading}>
                  {isLoading ? "Signing out..." : "Sign out"}
                </Button>
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2 px-4 py-3 md:px-6" aria-label="Primary views">
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

          <section className="flex-1 overflow-hidden border-t border-slate-300 bg-white p-3 md:p-5">
            {activeTab === "schedule" && (
              <ScheduleView
                key={scheduleRefreshToken}
                onStartNextSession={(candidate) => {
                  setSessionCandidate(candidate);
                }}
              />
            )}
            {activeTab === "texts" && (
              <TextsView
                openTextId={textToEditFromHistory}
                onOpenTextHandled={() => {
                  setTextToEditFromHistory(null);
                }}
              />
            )}
            {activeTab === "history" && (
              <HistoryView
                onEditText={(textId) => {
                  setTextToEditFromHistory(textId);
                  setActiveTab("texts");
                }}
              />
            )}
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
        }}
      />

      <SessionOverDialog
        open={isSessionOverOpen}
        session={lastCompletedSession}
        onOpenChange={setIsSessionOverOpen}
        onDone={() => {
          setIsSessionOverOpen(false);
          setLastCompletedSession(null);
          setScheduleRefreshToken((value) => value + 1);
          setActiveTab("schedule");
        }}
      />
    </main>
  );
}
