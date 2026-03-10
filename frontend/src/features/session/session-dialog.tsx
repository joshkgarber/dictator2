import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { LoaderCircle, Volume2 } from "lucide-react";

import { FormField } from "@/components/shared/form-primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { NextSessionCandidate } from "@/features/schedule/schedule-view";
import { ApiError } from "@/lib/api/client";
import {
  SESSION_COMMANDS,
  type SessionCommand,
  type SessionState,
  completeSession,
  exitSession,
  fetchSessionDiff,
  fetchSessionTutorFeedback,
  startTextSession,
  submitSessionAttempt,
  submitSessionCommand,
} from "@/lib/api/sessions";
import { cn } from "@/lib/utils";

type SessionDialogProps = {
  open: boolean;
  candidate: NextSessionCandidate | null;
  onOpenChange: (open: boolean) => void;
  onSessionOver: (session: SessionState) => void;
};

type ConsoleTone = "info" | "success" | "error" | "answer";

type ConsoleEntry = {
  id: number;
  tone: ConsoleTone;
  text: string;
  html?: string;
};

function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError && typeof error.payload === "object" && error.payload !== null) {
    const payload = error.payload as { error?: { message?: string } };
    const apiMessage = payload.error?.message;
    if (apiMessage) {
      return apiMessage;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed.";
}

function toReservedCommand(value: string): SessionCommand | null {
  if (!SESSION_COMMANDS.includes(value as SessionCommand)) {
    return null;
  }
  return value as SessionCommand;
}

export function SessionDialog({ open, candidate, onOpenChange, onSessionOver }: SessionDialogProps) {
  const [attempt, setAttempt] = useState("");
  const [session, setSession] = useState<SessionState | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPlayingClip, setIsPlayingClip] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);

  const mountedRef = useRef(false);
  const startupGuardRef = useRef(false);
  const completionGuardRef = useRef(false);
  const closingGuardRef = useRef(false);
  const sequenceRef = useRef(0);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const playedClipKeyRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const appendConsole = useCallback((tone: ConsoleTone, text: string, html?: string) => {
    sequenceRef.current += 1;
    const entry = { id: sequenceRef.current, tone, text, html };
    setConsoleEntries((previous) => [...previous, entry]);
  }, []);

  const resetDialogState = useCallback(() => {
    startupGuardRef.current = false;
    completionGuardRef.current = false;
    closingGuardRef.current = false;
    playedClipKeyRef.current = null;
    setAttempt("");
    setSession(null);
    setConsoleEntries([]);
    setIsInitializing(false);
    setIsSubmitting(false);
    setIsPlayingClip(false);
    setIsInstructionsOpen(false);
    if (audioElement) {
      audioElement.pause();
      audioElement.removeAttribute("src");
      audioElement.load();
    }
  }, [audioElement]);

  const playCurrentClip = useCallback(
    async (activeSession: SessionState) => {
      const clipUrl = activeSession.current.clipUrl;
      if (!clipUrl || activeSession.status !== "in_progress") {
        return;
      }

      if (!audioElement) {
        return;
      }

      try {
        setIsPlayingClip(true);
        if (audioElement.src !== clipUrl) {
          audioElement.src = clipUrl;
        }
        audioElement.currentTime = 0;
        await audioElement.play();
      } catch {
        setIsPlayingClip(false);
        appendConsole("error", "Clip autoplay was blocked. Type replay to play this clip.");
      }
    },
    [appendConsole, audioElement],
  );

  const tryCompleteSession = useCallback(
    async (activeSession: SessionState) => {
      if (completionGuardRef.current) {
        return;
      }
      if (activeSession.status !== "in_progress" || !activeSession.progress.isFinished) {
        return;
      }

      completionGuardRef.current = true;
      setIsSubmitting(true);
      try {
        const completed = await completeSession(activeSession.id);
        if (!mountedRef.current) {
          return;
        }
        setSession(completed);
        appendConsole("success", "Session complete. Opening session summary.");
        onSessionOver(completed);
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        completionGuardRef.current = false;
        appendConsole("error", getApiErrorMessage(error));
      } finally {
        if (mountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [appendConsole, onSessionOver],
  );

  const attemptClose = useCallback(async () => {
    if (closingGuardRef.current) {
      return;
    }
    const activeSession = session;
    if (!activeSession || activeSession.status !== "in_progress") {
      onOpenChange(false);
      return;
    }

    closingGuardRef.current = true;
    setIsSubmitting(true);
    try {
      await exitSession(activeSession.id);
      if (!mountedRef.current) {
        return;
      }
      onOpenChange(false);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      closingGuardRef.current = false;
      appendConsole("error", `Unable to exit session: ${getApiErrorMessage(error)}`);
      setIsSubmitting(false);
    }
  }, [appendConsole, onOpenChange, session]);

  useEffect(() => {
    if (!open || !candidate) {
      resetDialogState();
      return;
    }

    if (startupGuardRef.current) {
      return;
    }

    startupGuardRef.current = true;
    setIsInitializing(true);
    setConsoleEntries([]);
    sequenceRef.current = 0;

    void (async () => {
      try {
        const created = await startTextSession(candidate.textId, 1);
        if (!mountedRef.current) {
          return;
        }
        setSession(created);
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        appendConsole("error", `Unable to start session: ${getApiErrorMessage(error)}`);
      } finally {
        if (mountedRef.current) {
          setIsInitializing(false);
        }
      }
    })();
  }, [appendConsole, candidate, open, resetDialogState]);

  useEffect(() => {
    if (!audioElement) {
      return;
    }

    const onEnded = () => {
      setIsPlayingClip(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    };

    const onPause = () => {
      if (!audioElement.ended) {
        setIsPlayingClip(false);
      }
    };

    audioElement.addEventListener("ended", onEnded);
    audioElement.addEventListener("pause", onPause);

    return () => {
      audioElement.removeEventListener("ended", onEnded);
      audioElement.removeEventListener("pause", onPause);
    };
  }, [audioElement]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const clipUrl = session.current.clipUrl;
    if (!clipUrl || session.status !== "in_progress") {
      return;
    }

    const clipKey = `${session.id}:${session.current.repIndex || 0}:${session.current.clipIndex || 0}`;
    if (playedClipKeyRef.current === clipKey) {
      return;
    }

    playedClipKeyRef.current = clipKey;
    void playCurrentClip(session);
  }, [playCurrentClip, session]);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleEntries]);

  const runCommand = useCallback(
    async (command: SessionCommand, activeSession: SessionState) => {
      const eventResult = await submitSessionCommand(activeSession.id, command);
      setSession(eventResult.session);

      if (command === "help") {
        appendConsole("info", "Commands: replay, keep, showdiff, tutor, answer, help, exit.");
        return;
      }

      if (command === "replay") {
        await playCurrentClip(eventResult.session);
        return;
      }

      if (command === "showdiff") {
        const diff = await fetchSessionDiff(activeSession.id);
        if (diff.mode === "word_count_mismatch") {
          appendConsole("error", `${diff.message || "Word count mismatch."}`);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
          return;
        }
        const rendered = diff.words.map((word) => (word.isMatch ? word.word : `[${word.word}]`)).join(" ");
        appendConsole("info", `Diff: ${rendered}`);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
        return;
      }

      if (command === "tutor") {
        setIsSubmitting(true);
        try {
          const feedback = await fetchSessionTutorFeedback(activeSession.id);
          const html = await marked.parse(feedback.responseText);
          const sanitized = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ["p", "br", "strong", "em", "ul", "ol", "li", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "a"],
          });
          appendConsole("info", `${feedback.responseText}`, sanitized);
        } finally {
          if (mountedRef.current) {
            setIsSubmitting(false);
            setTimeout(() => {
              inputRef.current?.focus();
            }, 0);
          }
        }
        return;
      }

      if (command === "answer") {
        const eventLine = eventResult.event.payload?.line;
        const answerText =
          typeof eventLine === "object" && eventLine !== null && "text" in eventLine && typeof eventLine.text === "string"
            ? eventLine.text
            : eventResult.session.current.line?.text || "(line unavailable)";
        appendConsole("answer", answerText);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
        return;
      }

      if (command === "keep") {
        await tryCompleteSession(eventResult.session);
        return;
      }

      if (command === "exit") {
        appendConsole("info", "Command exit accepted. Session closed.");
        onOpenChange(false);
      }
    },
    [appendConsole, onOpenChange, playCurrentClip, tryCompleteSession],
  );

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!session || session.status !== "in_progress") {
        return;
      }

      const value = attempt;
      const normalized = value.trim();
      if (!normalized) {
        appendConsole("error", "Input cannot be blank.");
        return;
      }

      const command = toReservedCommand(normalized);
      setIsSubmitting(true);
      try {
        if (command) {
          await runCommand(command, session);
          setAttempt("");
          return;
        }

        const response = await submitSessionAttempt(session.id, value);
        setSession(response.session);
        setAttempt("");
        if (response.attempt.isCorrect) {
          appendConsole("success", normalized);
        } else {
          appendConsole("error", normalized);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        }
        await tryCompleteSession(response.session);
      } catch (error) {
        appendConsole("error", getApiErrorMessage(error));
      } finally {
        if (mountedRef.current) {
          setIsSubmitting(false);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        }
      }
    },
    [appendConsole, attempt, runCommand, session, tryCompleteSession],
  );

  const isBusy = isInitializing || isSubmitting;

  const headerDescription = useMemo(() => {
    if (!candidate) {
      return "Session";
    }

    return `${candidate.textName} • Level ${candidate.level}`;
  }, [candidate]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void attemptClose();
        }
      }}
      title="Session"
      description={headerDescription}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => void attemptClose()} disabled={isBusy}>
            Exit
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsInstructionsOpen((openState) => !openState)}
            disabled={isBusy || !session || session.status !== "in_progress"}
          >
            {isInstructionsOpen ? "Hide Instructions" : "Show Instructions"}
          </Button>
        </>
      }
    >
      <div className={cn("grid gap-3", isInstructionsOpen ? "md:grid-cols-[1.3fr_1fr]" : "grid-cols-1")}>
        <section className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <header className="flex items-center justify-between gap-3">
            <div className="grid gap-0.5 sm:grid-cols-3 sm:gap-4">
              <p className="text-sm font-semibold text-slate-900">{session?.textName || candidate?.textName || "Session"}</p>
              <p className="text-sm text-slate-700">
                Clip {session?.current.clipIndex || 0}/{session?.totalClips || 0}
              </p>
              <p className="text-sm text-slate-700">Score: {session?.rawScore ?? 0}</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              onClick={() => {
                if (!session) {
                  return;
                }
                setIsSubmitting(true);
                void runCommand("replay", session)
                  .catch((error: unknown) => {
                    appendConsole("error", getApiErrorMessage(error));
                  })
                  .finally(() => {
                    if (mountedRef.current) {
                      setIsSubmitting(false);
                    }
                  });
              }}
              disabled={isBusy || !session || session.status !== "in_progress"}
            >
              {isBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
              Replay Clip
            </button>
          </header>

          <form onSubmit={onSubmit} className="space-y-3">
            <FormField label="Attempt Input" htmlFor="attempt-input" hint="Exact commands only: replay, keep, showdiff, tutor, answer, help, exit.">
              <input
                id="attempt-input"
                ref={inputRef}
                value={attempt}
                onChange={(submitEvent) => setAttempt(submitEvent.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                placeholder={isPlayingClip ? "Clip is playing..." : "Type attempt or exact command..."}
                disabled={isBusy || isPlayingClip || !session || session.status !== "in_progress"}
                autoComplete="off"
              />
            </FormField>

            <div
              ref={consoleRef}
              className="h-[280px] overflow-y-auto rounded-md border border-slate-300 bg-white p-3 font-mono text-sm leading-6"
            >
              {consoleEntries.length === 0 && <p className="text-slate-500">Session output will appear here.</p>}
              {consoleEntries.map((entry) =>
                entry.html ? (
                  <p
                    key={entry.id}
                    className={cn(
                      entry.tone === "info" && "text-slate-700",
                      entry.tone === "success" && "text-emerald-700",
                      entry.tone === "error" && "text-rose-700",
                      entry.tone === "answer" && "text-amber-600",
                    )}
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: entry.html }}
                  />
                ) : (
                  <p
                    key={entry.id}
                    className={cn(
                      entry.tone === "info" && "text-slate-700",
                      entry.tone === "success" && "text-emerald-700",
                      entry.tone === "error" && "text-rose-700",
                      entry.tone === "answer" && "text-amber-600",
                    )}
                  >
                    {entry.text}
                  </p>
                ),
              )}
            </div>
          </form>
        </section>

        {isInstructionsOpen && (
          <aside className="space-y-3 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700">
            <h4 className="font-semibold uppercase tracking-[0.08em] text-slate-700">Instructions</h4>
            <p>
              Listen to each clip, then type your attempt and press Enter. Use a reserved command only when you need a session action.
            </p>
            <ul className="space-y-1">
              {SESSION_COMMANDS.map((command) => (
                <li key={command} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
                  {command}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">
              Exact matching is enforced. Any other input, including command-like text with extra words, is submitted as an attempt.
            </p>
          </aside>
        )}
      </div>

      <audio ref={setAudioElement} preload="auto" className="hidden" />
    </Dialog>
  );
}
