import { requestJson } from "@/lib/api/client";

export const TEXT_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

export type TextLevel = (typeof TEXT_LEVELS)[number];

export type TextRecord = {
  id: number;
  name: string;
  level: TextLevel;
  transcriptRaw: string;
  lineCount: number;
  clipCount: number;
  isReady: boolean;
  reps: number;
  schedule: {
    id: number;
    nextSessionDate: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type ListTextsResponse = {
  texts: TextRecord[];
};

type CreateTextPayload = {
  name: string;
  level: TextLevel;
  transcriptRaw: string;
  reps: number;
};

type TextResponse = {
  text: TextRecord;
};

export type TextReadiness = {
  lineCount: number;
  clipCount: number;
  missingIndexes: number[];
  isReady: boolean;
};

type ValidateTextResponse = {
  readiness: TextReadiness;
};

type UploadTextClipsResponse = {
  textId: number;
  uploadedCount: number;
  clipCount: number;
  uploadedIndexes: number[];
};

function toQuery(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) {
      continue;
    }
    query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchTexts(level?: TextLevel): Promise<TextRecord[]> {
  const response = await requestJson<ListTextsResponse>(`/api/texts${toQuery({ level })}`, {
    method: "GET",
  });
  return response.texts;
}

export async function createText(payload: CreateTextPayload): Promise<TextRecord> {
  const response = await requestJson<TextResponse>("/api/texts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.text;
}

export async function updateText(
  textId: number,
  payload: Partial<Pick<TextRecord, "name" | "level" | "reps">>,
): Promise<TextRecord> {
  const response = await requestJson<TextResponse>(`/api/texts/${textId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.text;
}

export async function updateTextTranscript(textId: number, transcriptRaw: string): Promise<TextRecord> {
  const response = await requestJson<TextResponse>(`/api/texts/${textId}/transcript`, {
    method: "PUT",
    body: JSON.stringify({ transcriptRaw }),
  });
  return response.text;
}

export async function uploadTextClips(textId: number, clips: File[]): Promise<UploadTextClipsResponse> {
  const formData = new FormData();
  for (const clip of clips) {
    formData.append("clips", clip, clip.name);
  }

  return requestJson<UploadTextClipsResponse>(`/api/texts/${textId}/clips`, {
    method: "POST",
    body: formData,
  });
}

export async function validateTextReadiness(textId: number): Promise<TextReadiness> {
  const response = await requestJson<ValidateTextResponse>(`/api/texts/${textId}/validate`, {
    method: "POST",
  });
  return response.readiness;
}

export async function deleteText(textId: number): Promise<void> {
  await requestJson(`/api/texts/${textId}`, {
    method: "DELETE",
  });
}
