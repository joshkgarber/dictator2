import { useCallback, useMemo, useState } from "react";

export type RequestStatus = "idle" | "loading" | "success" | "error";

type UseApiRequestResult<TData, TArgs extends unknown[]> = {
  status: RequestStatus;
  data: TData | null;
  error: Error | null;
  run: (...args: TArgs) => Promise<TData>;
  reset: () => void;
};

export function useApiRequest<TData, TArgs extends unknown[]>(
  request: (...args: TArgs) => Promise<TData>,
): UseApiRequestResult<TData, TArgs> {
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(
    async (...args: TArgs) => {
      setStatus("loading");
      setError(null);

      try {
        const result = await request(...args);
        setData(result);
        setStatus("success");
        return result;
      } catch (caughtError) {
        const normalizedError = caughtError instanceof Error ? caughtError : new Error("Unknown request error");
        setError(normalizedError);
        setStatus("error");
        throw normalizedError;
      }
    },
    [request],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  return useMemo(
    () => ({
      status,
      data,
      error,
      run,
      reset,
    }),
    [data, error, reset, run, status],
  );
}
