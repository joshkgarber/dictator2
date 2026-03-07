import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionDialog } from "@/features/session/session-dialog";
import type { SessionState } from "@/lib/api/sessions";
import {
  completeSession,
  exitSession,
  fetchSessionDiff,
  fetchSessionTutorFeedback,
  startTextSession,
  submitSessionAttempt,
  submitSessionCommand,
} from "@/lib/api/sessions";

vi.mock("@/lib/api/sessions", () => ({
  SESSION_COMMANDS: ["replay", "keep", "showdiff", "tutor", "answer", "help", "exit"],
  startTextSession: vi.fn(),
  submitSessionCommand: vi.fn(),
  submitSessionAttempt: vi.fn(),
  fetchSessionDiff: vi.fn(),
  fetchSessionTutorFeedback: vi.fn(),
  completeSession: vi.fn(),
  exitSession: vi.fn(),
}));

function buildSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: 42,
    textId: 9,
    textName: "Typed Commands",
    textLevel: "A1",
    reps: 1,
    status: "in_progress",
    startedAt: "2026-03-07T00:00:00Z",
    endedAt: null,
    durationSeconds: null,
    rawScore: 0,
    weightedScore: null,
    totalClips: 1,
    progress: {
      cursor: 0,
      totalUnits: 1,
      completedUnits: 0,
      remainingUnits: 1,
      isFinished: false,
    },
    current: {
      clipIndex: 1,
      repIndex: 1,
      clipUrl: "/api/texts/9/clips/1",
      line: { index: 1, text: "eins" },
    },
    attempts: [],
    events: [],
    ...overrides,
  };
}

describe("SessionDialog typed command handling", () => {
  beforeEach(() => {
    vi.mocked(startTextSession).mockResolvedValue(buildSession());
    vi.mocked(submitSessionCommand).mockResolvedValue({
      event: {
        id: 1,
        eventType: "replay",
        clipIndex: 1,
        pointsDelta: 1,
        payload: null,
      },
      session: buildSession(),
    });
    vi.mocked(submitSessionAttempt).mockResolvedValue({
      attempt: {
        id: 1,
        clipIndex: 1,
        repIndex: 1,
        attemptText: "replay now",
        isCorrect: false,
      },
      session: buildSession(),
    });
    vi.mocked(fetchSessionDiff).mockResolvedValue({
      clipIndex: 1,
      mode: "word_match",
      expected: "eins",
      attempt: "eins",
      wordCountDifference: 0,
      words: [{ word: "eins", isMatch: true }],
      message: null,
    });
    vi.mocked(fetchSessionTutorFeedback).mockResolvedValue({
      id: 1,
      clipIndex: 1,
      attemptText: "bad",
      lineText: "eins",
      modelName: "mock",
      responseText: "Try again",
    });
    vi.mocked(completeSession).mockResolvedValue(buildSession({ status: "completed" }));
    vi.mocked(exitSession).mockResolvedValue(buildSession({ status: "incomplete" }));
  });

  it("dispatches only exact command matches and treats extra words as attempts", async () => {
    const user = userEvent.setup();
    render(
      <SessionDialog
        open
        candidate={{ textId: 9, textName: "Typed Commands", level: "A1", dueLabel: "Today" }}
        onOpenChange={() => {}}
        onSessionOver={() => {}}
      />,
    );

    const input = document.getElementById("attempt-input") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    await waitFor(() => expect(startTextSession).toHaveBeenCalledWith(9, 1));
    await waitFor(() => expect(input).not.toBeDisabled());

    await user.type(input, "replay{enter}");
    await waitFor(() => expect(submitSessionCommand).toHaveBeenCalledWith(42, "replay"));
    expect(submitSessionAttempt).not.toHaveBeenCalled();

    await user.type(input, "replay now{enter}");
    await waitFor(() => expect(submitSessionAttempt).toHaveBeenCalledWith(42, "replay now"));
  });
});
