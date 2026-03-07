import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TextsView } from "@/features/texts/texts-view";
import { upsertTextSchedule } from "@/lib/api/schedule";
import {
  createText,
  deleteText,
  fetchTexts,
  updateText,
  updateTextTranscript,
  uploadTextClips,
  validateTextReadiness,
  type TextRecord,
} from "@/lib/api/texts";

vi.mock("@/lib/api/schedule", () => ({
  upsertTextSchedule: vi.fn(),
}));

vi.mock("@/lib/api/texts", () => ({
  TEXT_LEVELS: ["A1", "A2", "B1", "B2", "C1"],
  createText: vi.fn(),
  deleteText: vi.fn(),
  fetchTexts: vi.fn(),
  updateText: vi.fn(),
  updateTextTranscript: vi.fn(),
  uploadTextClips: vi.fn(),
  validateTextReadiness: vi.fn(),
}));

function buildText(): TextRecord {
  return {
    id: 7,
    name: "Interview Notes",
    level: "B1",
    transcriptRaw: "line one",
    lineCount: 1,
    clipCount: 1,
    isReady: true,
    schedule: {
      id: 70,
      nextSessionDate: "2030-04-01",
      notes: null,
      createdAt: "2026-03-07T00:00:00Z",
      updatedAt: "2026-03-07T00:00:00Z",
    },
    createdAt: "2026-03-07T00:00:00Z",
    updatedAt: "2026-03-07T00:00:00Z",
  };
}

describe("TextsView scheduled date field", () => {
  beforeEach(() => {
    vi.mocked(fetchTexts).mockResolvedValue([buildText()]);
    vi.mocked(createText).mockResolvedValue(buildText());
    vi.mocked(updateText).mockResolvedValue(buildText());
    vi.mocked(updateTextTranscript).mockResolvedValue(buildText());
    vi.mocked(uploadTextClips).mockResolvedValue({
      textId: 7,
      uploadedCount: 0,
      clipCount: 1,
      uploadedIndexes: [],
    });
    vi.mocked(validateTextReadiness).mockResolvedValue({
      lineCount: 1,
      clipCount: 1,
      missingIndexes: [],
      isReady: true,
    });
    vi.mocked(deleteText).mockResolvedValue(undefined);
    vi.mocked(upsertTextSchedule).mockResolvedValue({
      id: 70,
      textId: 7,
      nextSessionDate: "2030-04-01",
      notes: null,
      createdAt: "2026-03-07T00:00:00Z",
      updatedAt: "2026-03-07T00:00:00Z",
      dueStatus: "upcoming",
      text: {
        id: 7,
        name: "Interview Notes",
        level: "B1",
        isReady: true,
      },
    });
  });

  it("requires scheduled date before saving", async () => {
    const user = userEvent.setup();
    render(<TextsView openTextId={7} onOpenTextHandled={() => {}} />);

    await screen.findByRole("heading", { name: "Edit Text" });

    const dateInput = document.getElementById("text-scheduled-date") as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    expect(dateInput).toBeRequired();
    expect(dateInput).toHaveAttribute("min");

    await user.clear(dateInput);
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(screen.getByText("Scheduled date is required")).toBeInTheDocument();
    expect(upsertTextSchedule).not.toHaveBeenCalled();
    expect(updateText).not.toHaveBeenCalled();

    await user.type(dateInput, "2030-04-08");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(upsertTextSchedule).toHaveBeenCalledWith(7, "2030-04-08"));
  });
});
