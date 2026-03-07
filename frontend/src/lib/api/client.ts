const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

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

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(getApiUrl("/api/health"), {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Health request failed with ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
