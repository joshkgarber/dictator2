import { requestJson } from "@/lib/api/client";

export const SESSION_COMMANDS = ["replay", "keep", "diff", "tutor", "answer", "help", "exit"] as const;

export type SessionCommand = (typeof SESSION_COMMANDS)[number];

export type SessionLine = {
  index: number;
  text: string;
};

export type SessionAttempt = {
  id: number;
  textLineId: number;
  clipIndex: number;
  repIndex: number;
  attemptText: string;
  isCorrect: boolean;
  expectedLineText: string;
  createdAt: string;
};

export type SessionEvent = {
  id: number;
  clipIndex: number;
  eventType: SessionCommand;
  pointsDelta: number;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type SessionProgress = {
  cursor: number;
  totalUnits: number;
  completedUnits: number;
  remainingUnits: number;
  isFinished: boolean;
};

export type SessionCurrent = {
  clipIndex: number | null;
  repIndex: number | null;
  clipUrl: string | null;
  line: SessionLine | null;
};

export type SessionState = {
  id: number;
  textId: number;
  textName: string;
  textLevel: string;
  reps: number;
  status: "in_progress" | "completed" | "incomplete" | "abandoned";
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  rawScore: number;
  weightedScore: number | null;
  totalClips: number;
  progress: SessionProgress;
  current: SessionCurrent;
  attempts: SessionAttempt[];
  events: SessionEvent[];
};

type SessionResponse = {
  session: SessionState;
};

type ListSessionsResponse = {
  sessions: SessionHistoryRecord[];
};

type CreateAttemptResponse = {
  attempt: {
    id: number;
    clipIndex: number;
    repIndex: number;
    attemptText: string;
    isCorrect: boolean;
  };
  session: SessionState;
};

type CreateEventResponse = {
  event: {
    id: number;
    eventType: SessionCommand;
    clipIndex: number;
    pointsDelta: number;
    payload: Record<string, unknown> | null;
  };
  session: SessionState;
};

export type SessionDiffWord = {
  word: string;
  isMatch: boolean;
};

export type SessionDiff = {
  clipIndex: number;
  mode: "word_match" | "word_count_mismatch";
  expected: string;
  attempt: string;
  wordCountDifference: number;
  words: SessionDiffWord[];
  message: string | null;
  attemptId?: number;
};

type CreateDiffResponse = {
  diff: SessionDiff;
};

export type TutorFeedback = {
  id: number;
  clipIndex: number;
  attemptText: string;
  lineText: string;
  modelName: string | null;
  responseText: string;
};

export type SessionHistoryRecord = {
  id: number;
  textId: number;
  textName: string;
  textLevel: string;
  reps: number;
  status: "in_progress" | "completed" | "incomplete" | "abandoned";
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  rawScore: number;
  weightedScore: number | null;
  totalClips: number;
};

type CreateTutorFeedbackResponse = {
  feedback: TutorFeedback;
  history: TutorFeedback[];
};

export async function startTextSession(textId: number, reps = 1): Promise<SessionState> {
  const response = await requestJson<SessionResponse>(`/api/texts/${textId}/sessions`, {
    method: "POST",
    body: JSON.stringify({ reps }),
  });
  return response.session;
}

export async function loadSessionState(sessionId: number): Promise<SessionState> {
  const response = await requestJson<SessionResponse>(`/api/sessions/${sessionId}/state`, {
    method: "GET",
  });
  return response.session;
}

export async function submitSessionAttempt(sessionId: number, attemptText: string): Promise<CreateAttemptResponse> {
  return requestJson<CreateAttemptResponse>(`/api/sessions/${sessionId}/attempts`, {
    method: "POST",
    body: JSON.stringify({ attemptText }),
  });
}

export async function submitSessionCommand(sessionId: number, command: SessionCommand): Promise<CreateEventResponse> {
  return requestJson<CreateEventResponse>(`/api/sessions/${sessionId}/events`, {
    method: "POST",
    body: JSON.stringify({ eventType: command }),
  });
}

export async function fetchSessionDiff(sessionId: number): Promise<SessionDiff> {
  const response = await requestJson<CreateDiffResponse>(`/api/sessions/${sessionId}/diff`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return response.diff;
}

export async function fetchSessionTutorFeedback(sessionId: number): Promise<TutorFeedback> {
  const response = await requestJson<CreateTutorFeedbackResponse>(`/api/sessions/${sessionId}/tutor-feedback`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return response.feedback;
}

export async function completeSession(sessionId: number): Promise<SessionState> {
  const response = await requestJson<SessionResponse>(`/api/sessions/${sessionId}/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return response.session;
}

export async function fetchSessionHistory(): Promise<SessionHistoryRecord[]> {
  const response = await requestJson<ListSessionsResponse>("/api/sessions?status=completed", {
    method: "GET",
  });
  return response.sessions;
}

export async function exitSession(sessionId: number): Promise<SessionState> {
  const response = await requestJson<SessionResponse>(`/api/sessions/${sessionId}/exit`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return response.session;
}
