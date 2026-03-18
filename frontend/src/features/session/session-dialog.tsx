import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import DOMPurify from "dompurify";
import { encode } from "html-entities";
import { marked } from "marked";
import { LoaderCircle } from "lucide-react";

import { FormField } from "@/components/shared/form-primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { NextSessionCandidate } from "@/features/schedule/schedule-view";
import { ApiError } from "@/lib/api/client";
import {
  SESSION_COMMANDS,
  type SessionCommand,
  type SessionState,
  type Correction,
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

type ConsoleTone = "info" | "success" | "error" | "answer" | "tutor" | "tutor-placeholder";

function createColoredSpan(text: string, className: string): string {
  return `<span class="${className}">${text}</span>`;
}

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

// Format structured tutor corrections into sanitized HTML
async function formatTutorCorrections(corrections: Correction[]): Promise<string> {
  const parts: string[] = [];
  for (const correction of corrections) {
    // Escape HTML entities in each field, then parse markdown
    const escapedError = encode(correction.error);
    const escapedExplanation = encode(correction.explanation);
    const escapedTakeaway = encode(correction.takeaway);

    const errorHtml = await marked.parse(escapedError);
    const explanationHtml = await marked.parse(escapedExplanation);
    const takeawayHtml = await marked.parse(escapedTakeaway);

    parts.push(`
      <div class="tutor-correction mb-4 p-3 border-l-4 border-blue-500 bg-slate-50 rounded">
        <div class="tutor-error font-semibold text-red-700 mb-2">${errorHtml}</div>
        <div class="tutor-explanation text-slate-700 mb-2">${explanationHtml}</div>
        <div class="tutor-takeaway text-green-700 font-medium">${takeawayHtml}</div>
      </div>
    `);
  }

  const rawHtml = parts.join("");
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "ul", "ol", "li", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "a", "div"],
    ALLOWED_ATTR: ["class"],
  });
}

export function SessionDialog({ open, candidate, onOpenChange, onSessionOver }: SessionDialogProps) {
  const [attempt, setAttempt] = useState("");
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
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
  const tutorOutputRef = useRef<HTMLDivElement | null>(null);
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
    return entry.id;
  }, []);

  const updateConsoleEntry = useCallback((entryId: number, updates: Partial<ConsoleEntry>) => {
    setConsoleEntries((previous) =>
      previous.map((entry) => (entry.id === entryId ? { ...entry, ...updates } : entry)),
    );
  }, []);

  const resetDialogState = useCallback(() => {
    startupGuardRef.current = false;
    completionGuardRef.current = false;
    closingGuardRef.current = false;
    playedClipKeyRef.current = null;
    setAttempt("");
    setInputHistory([]);
    setHistoryIndex(-1);
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
        setIsInstructionsOpen((openState) => !openState);
        return;
      }

      if (command === "replay") {
        await playCurrentClip(eventResult.session);
        appendConsole("info", "Clip replayed");
        return;
      }

      if (command === "diff") {
        const diff = await fetchSessionDiff(activeSession.id);
        if (diff.mode === "word_count_mismatch") {
          const warningHtml = createColoredSpan(diff.message || "Word count mismatch.", "text-amber-600");
          appendConsole("error", diff.message || "Word count mismatch.", warningHtml);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
          return;
        }
        const htmlWords = diff.words.map((word) => {
          const className = word.isMatch ? "text-emerald-700" : "text-rose-700";
          return createColoredSpan(word.word, className);
        });
        const html = htmlWords.join(" ");
        const text = diff.words.map((word) => word.word).join(" ");
        appendConsole("info", text, html);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
        return;
      }

      if (command === "tutor") {
        const placeholderId = appendConsole("tutor-placeholder", "Tutor called");
        setIsSubmitting(true);
        try {
          const feedback = await fetchSessionTutorFeedback(activeSession.id);
          const formattedHtml = await formatTutorCorrections(feedback.corrections);
          updateConsoleEntry(placeholderId, { tone: "info", text: "Tutor responded" });
          appendConsole("tutor", "", formattedHtml);
          setTimeout(() => {
            tutorOutputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
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
    [appendConsole, onOpenChange, playCurrentClip, updateConsoleEntry, tryCompleteSession],
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
          setInputHistory((prev) => [...prev, normalized]);
          setHistoryIndex(-1);
          setAttempt("");
          return;
        }

        const response = await submitSessionAttempt(session.id, value);
        setSession(response.session);
        setInputHistory((prev) => [...prev, value]);
        setHistoryIndex(-1);
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
        <div className="flex w-full items-center justify-between">
          <Button
            className="rounded-full bg-gray-200 text-white hover:bg-red-500 hover:text-black"
            onClick={() => void attemptClose()}
            disabled={isBusy}
            title="Warning! Progress will not be saved."
          >
            Abandon
          </Button>
          <Button
            className="rounded-full bg-slate-900 text-white hover:bg-slate-900/90"
            onClick={() => setIsInstructionsOpen((openState) => !openState)}
            disabled={isInstructionsOpen || isBusy || !session || session.status !== "in_progress"}
          >
            Instructions
          </Button>
        </div>
      }
    >
      <div className={cn("grid gap-3", isInstructionsOpen ? "md:grid-cols-[1.3fr_1fr]" : "grid-cols-1")}>
        <section className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <header className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              Clip {session?.current.clipIndex || 0}/{session?.totalClips || 0}
            </p>
            <p className="text-sm text-slate-700">Score: {session?.rawScore ?? 0}</p>
          </header>

          <form onSubmit={onSubmit} className="space-y-3">
            <FormField htmlFor="attempt-input">
              <input
                id="attempt-input"
                ref={inputRef}
                value={attempt}
                onChange={(submitEvent) => setAttempt(submitEvent.target.value)}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === "ArrowUp") {
                    keyboardEvent.preventDefault();
                    if (inputHistory.length === 0) return;
                    const newIndex = historyIndex === -1 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
                    setHistoryIndex(newIndex);
                    setAttempt(inputHistory[newIndex]);
                  } else if (keyboardEvent.key === "ArrowDown") {
                    keyboardEvent.preventDefault();
                    if (inputHistory.length === 0) return;
                    if (historyIndex === -1) return;
                    const newIndex = historyIndex + 1;
                    if (newIndex >= inputHistory.length) {
                      setHistoryIndex(-1);
                      setAttempt("");
                    } else {
                      setHistoryIndex(newIndex);
                      setAttempt(inputHistory[newIndex]);
                    }
                  }
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                placeholder={isPlayingClip ? "Clip is playing..." : "Type attempt or exact command..."}
                disabled={isBusy || isPlayingClip || !session || session.status !== "in_progress"}
                autoComplete="off"
              />
            </FormField>

            <div
              ref={consoleRef}
              className="flex flex-col gap-y-2 h-[280px] overflow-y-auto rounded-md border border-slate-300 bg-white p-3 text-sm leading-6"
            >
              {consoleEntries.length === 0 && <p className="text-slate-500">Session output will appear here.</p>}
              {consoleEntries.map((entry) => {
                if (entry.tone === "tutor-placeholder") {
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 rounded-md border border-purple-300 bg-purple-50 px-3 py-2 text-purple-700"
                    >
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      <span className="text-sm">{entry.text}</span>
                    </div>
                  );
                }
                return entry.html ? (
                  <div
                    key={entry.id}
                    ref={entry.tone === "tutor" ? tutorOutputRef : undefined}
                    className={cn(
                      entry.tone === "info" && "text-slate-700",
                      entry.tone === "success" && "text-emerald-700",
                      entry.tone === "error" && "text-rose-700",
                      entry.tone === "answer" && "text-amber-600",
                      entry.tone === "tutor" && "rounded-md border border-purple-500 bg-purple-50/50 p-3 text-slate-700",
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
                );
              })}
            </div>
          </form>
        </section>

        {isInstructionsOpen && (
          <aside className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold uppercase tracking-[0.08em] text-slate-700">Instructions</h4>
            </div>
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
            <div className="mt-auto flex justify-center pt-3">
              <Button
                variant="outline"
                className="rounded-full text-xs"
                onClick={() => setIsInstructionsOpen(false)}
              >
                Close
              </Button>
            </div>
          </aside>
        )}
      </div>

      <audio ref={setAudioElement} preload="auto" className="hidden" />
    </Dialog>
  );
}
