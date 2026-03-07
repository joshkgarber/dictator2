import { ApiError, requestJson } from "@/lib/api/client";

const AUTH_USER_STORAGE_KEY = "dictator2.auth.user";
const AUTH_CSRF_STORAGE_KEY = "dictator2.auth.csrf";

export type AuthUser = {
  id: number;
  email: string;
  username: string;
};

type AuthSuccessResponse = {
  user: AuthUser;
  csrfToken: string;
};

type CurrentUserResponse = {
  user: AuthUser;
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

export async function registerUser(email: string, username: string, password: string): Promise<AuthSuccessResponse> {
  return requestJson<AuthSuccessResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      username,
      password,
    }),
  });
}

export async function loginUser(email: string, password: string): Promise<AuthSuccessResponse> {
  return requestJson<AuthSuccessResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

export async function logoutUser(): Promise<void> {
  await requestJson("/api/auth/logout", {
    method: "POST",
  });
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  return requestJson<CurrentUserResponse>("/api/auth/me", {
    method: "GET",
  });
}

export function getCsrfToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(AUTH_CSRF_STORAGE_KEY);
}

export function getStoredAuthUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    return null;
  }
}

export function persistAuthUser(user: AuthUser | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export function persistCsrfToken(csrfToken: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!csrfToken) {
    window.localStorage.removeItem(AUTH_CSRF_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_CSRF_STORAGE_KEY, csrfToken);
}

export function extractApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    const payload = error.payload as ApiErrorPayload;
    const apiMessage = payload?.error?.message;
    if (apiMessage) {
      return apiMessage;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}
