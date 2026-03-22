import { requestJson } from "@/lib/api/client";

export type ScheduleTextRef = {
  id: number;
  name: string;
  level: string;
  isReady: boolean;
  reps: number;
};

export type ScheduleEntry = {
  id: number;
  textId: number;
  nextSessionDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  dueStatus: "due" | "upcoming";
  text: ScheduleTextRef;
};

type ListScheduleResponse = {
  today: string;
  scope: "all" | "due" | "upcoming";
  counts: {
    all: number;
    due: number;
    upcoming: number;
  };
  schedule: ScheduleEntry[];
};

type ScheduleResponse = {
  schedule: ScheduleEntry;
};

export async function fetchSchedule(): Promise<ListScheduleResponse> {
  return requestJson<ListScheduleResponse>("/api/schedule", {
    method: "GET",
  });
}

export async function upsertTextSchedule(textId: number, nextSessionDate: string, notes?: string): Promise<ScheduleEntry> {
  const response = await requestJson<ScheduleResponse>(`/api/texts/${textId}/schedule`, {
    method: "PUT",
    body: JSON.stringify({
      nextSessionDate,
      notes,
    }),
  });
  return response.schedule;
}
