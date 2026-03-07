import { requestJson } from "@/lib/api/client";

export type ScheduleTextRef = {
  id: number;
  name: string;
  level: string;
  isReady: boolean;
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

export async function fetchSchedule(): Promise<ListScheduleResponse> {
  return requestJson<ListScheduleResponse>("/api/schedule", {
    method: "GET",
  });
}
