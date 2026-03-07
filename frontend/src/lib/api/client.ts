const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

let csrfTokenResolver: (() => string | null) | null = null;
let unauthorizedHandler: (() => void) | null = null;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (!trimmed.startsWith(`${name}=`)) {
      continue;
    }

    return decodeURIComponent(trimmed.slice(name.length + 1));
  }

  return null;
}

function getApiUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`API path must start with '/': ${path}`);
  }

  if (!apiBaseUrl) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

export type HealthResponse = {
  status: string;
  service: string;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function setApiCsrfTokenResolver(resolver: (() => string | null) | null) {
  csrfTokenResolver = resolver;
}

export function setApiUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function getErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const errorPayload = payload as { error?: { message?: string } };
    if (errorPayload.error?.message) {
      return errorPayload.error.message;
    }
  }

  return `Request failed (${status})`;
}

async function parsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});
  const hasBody = init.body !== undefined && init.body !== null;
  const isFormDataBody = typeof FormData !== "undefined" && init.body instanceof FormData;

  if (hasBody && !isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !headers.has("X-CSRF-Token")) {
    const csrfToken = csrfTokenResolver?.() || getCookie("csrf_token");
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const response = await fetch(getApiUrl(path), {
    credentials: "include",
    headers,
    ...init,
  });

  const payload = await parsePayload(response);

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
    throw new ApiError(getErrorMessage(payload, response.status), response.status, payload);
  }

  return payload as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/api/health", {
    method: "GET",
  });
}
