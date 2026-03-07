import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchHealth, type HealthResponse } from "@/lib/api/client";

type HealthState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success"; payload: HealthResponse }
  | { phase: "error"; message: string };

function App() {
  const [healthState, setHealthState] = useState<HealthState>({ phase: "idle" });

  const statusTone = useMemo(() => {
    if (healthState.phase === "success") {
      return "text-emerald-800 bg-emerald-100 border-emerald-300";
    }
    if (healthState.phase === "error") {
      return "text-rose-800 bg-rose-100 border-rose-300";
    }
    return "text-slate-700 bg-slate-100 border-slate-300";
  }, [healthState]);

  const loadHealth = async () => {
    setHealthState({ phase: "loading" });
    try {
      const payload = await fetchHealth();
      setHealthState({ phase: "success", payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown network failure";
      setHealthState({ phase: "error", message });
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <main className="min-h-screen bg-app-gradient p-4 sm:p-8">
      <div className="mx-auto w-full max-w-4xl animate-fade-up">
        <section className="mb-6 rounded-xl border border-slate-300 bg-white/80 p-5 shadow-xl shadow-slate-900/10 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Phase 0 Bootstrap</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Dictator 2.0</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            Frontend and backend are connected. This empty-state page verifies the Flask API is reachable from the Vite app.
          </p>
        </section>

        <Card className="border-slate-300 bg-white/90 shadow-xl shadow-slate-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Server className="h-5 w-5" />
              Backend Health
            </CardTitle>
            <CardDescription>Request: GET /api/health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`mb-4 rounded-md border px-3 py-2 text-sm font-medium ${statusTone}`}>
              {healthState.phase === "loading" && "Checking backend..."}
              {healthState.phase === "success" && `Healthy (${healthState.payload.service})`}
              {healthState.phase === "error" && `Error: ${healthState.message}`}
              {healthState.phase === "idle" && "Waiting to check backend"}
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <pre className="overflow-x-auto text-xs leading-5 text-slate-800">
                {healthState.phase === "success"
                  ? JSON.stringify(healthState.payload, null, 2)
                  : JSON.stringify({ status: "pending" }, null, 2)}
              </pre>
            </div>

            <div className="mt-4">
              <Button onClick={() => void loadHealth()} variant="secondary">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Retry Health Check
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default App;
