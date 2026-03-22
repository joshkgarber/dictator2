import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SessionOverDialog } from "@/features/session/session-over-dialog";
import { upsertTextSchedule } from "@/lib/api/schedule";
import type { SessionState } from "@/lib/api/sessions";

vi.mock("@/lib/api/schedule", () => ({
  upsertTextSchedule: vi.fn(),
}));

function buildSession(): SessionState {
  return {
    id: 100,
    textId: 55,
    textName: "Reschedule Flow",
    textLevel: "A2",
    reps: 1,
    status: "completed",
    startedAt: "2026-03-07T00:00:00Z",
    endedAt: "2026-03-07T00:05:00Z",
    durationSeconds: 300,
    rawScore: 4,
    weightedScore: 4,
    totalClips: 1,
    progress: {
      cursor: 1,
      totalUnits: 1,
      completedUnits: 1,
      remainingUnits: 0,
      isFinished: true,
    },
    current: {
      clipIndex: null,
      repIndex: null,
      clipUrl: null,
      line: null,
    },
    attempts: [],
    events: [],
  };
}

describe("SessionOverDialog", () => {
  it("requires a date and saves the next schedule date", async () => {
    vi.mocked(upsertTextSchedule).mockResolvedValue({
      id: 1,
      textId: 55,
      nextSessionDate: "2030-04-01",
      notes: null,
      createdAt: "2026-03-07T00:00:00Z",
      updatedAt: "2026-03-07T00:00:00Z",
      dueStatus: "upcoming",
      text: { id: 55, name: "Reschedule Flow", level: "A2", isReady: true, reps: 1 },
    });

    const onDone = vi.fn();
    const user = userEvent.setup();

    render(<SessionOverDialog open session={buildSession()} onOpenChange={() => {}} onDone={onDone} />);

    await user.click(screen.getByRole("button", { name: "Save Next Date" }));
    expect(screen.getByText("Choose a next session date to continue.")).toBeInTheDocument();
    expect(upsertTextSchedule).not.toHaveBeenCalled();

    const dateInput = document.getElementById("next-session-date") as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    await user.type(dateInput, "2030-04-01");
    await user.click(screen.getByRole("button", { name: "Save Next Date" }));

    await waitFor(() => expect(upsertTextSchedule).toHaveBeenCalledWith(55, "2030-04-01"));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
