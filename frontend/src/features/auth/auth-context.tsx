import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import {
  extractApiErrorMessage,
  getCsrfToken,
  getCurrentUser,
  getStoredAuthUser,
  loginUser,
  logoutUser,
  persistAuthUser,
  persistCsrfToken,
  registerUser,
  type AuthUser,
} from "@/lib/api/auth";
import { ApiError, setApiCsrfTokenResolver, setApiUnauthorizedHandler } from "@/lib/api/client";

type AuthContextValue = {
  user: AuthUser | null;
  csrfToken: string | null;
  isLoading: boolean;
  isSessionLoading: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  setCsrfToken: (csrfToken: string | null) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUserState] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [csrfToken, setCsrfTokenState] = useState<string | null>(() => getCsrfToken());
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setUser = useCallback((nextUser: AuthUser | null) => {
    setUserState(nextUser);
    persistAuthUser(nextUser);
  }, []);

  const setCsrfToken = useCallback((nextCsrfToken: string | null) => {
    setCsrfTokenState(nextCsrfToken);
    persistCsrfToken(nextCsrfToken);
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setCsrfToken(null);
    setError(null);
  }, [setCsrfToken, setUser]);

  const completeAuthSuccess = useCallback(
    (nextUser: AuthUser, nextCsrfToken: string) => {
      setUser(nextUser);
      setCsrfToken(nextCsrfToken);
      setError(null);
      return nextUser;
    },
    [setCsrfToken, setUser],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await loginUser(email, password);
        return completeAuthSuccess(response.user, response.csrfToken);
      } catch (caughtError) {
        const message = extractApiErrorMessage(caughtError, "Unable to log in. Please try again.");
        setError(message);
        throw caughtError;
      } finally {
        setIsLoading(false);
      }
    },
    [completeAuthSuccess],
  );

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await registerUser(email, username, password);
        return completeAuthSuccess(response.user, response.csrfToken);
      } catch (caughtError) {
        const message = extractApiErrorMessage(caughtError, "Unable to register. Please try again.");
        setError(message);
        throw caughtError;
      } finally {
        setIsLoading(false);
      }
    },
    [completeAuthSuccess],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await logoutUser();
    } catch (caughtError) {
      if (!(caughtError instanceof ApiError && caughtError.status === 401)) {
        setError(extractApiErrorMessage(caughtError, "Unable to log out cleanly."));
      }
    } finally {
      clearAuth();
      setIsLoading(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    setApiCsrfTokenResolver(() => csrfToken);
    return () => {
      setApiCsrfTokenResolver(null);
    };
  }, [csrfToken]);

  useEffect(() => {
    setApiUnauthorizedHandler(() => {
      clearAuth();
    });
    return () => {
      setApiUnauthorizedHandler(null);
    };
  }, [clearAuth]);

  useEffect(() => {
    let active = true;

    async function validateSession() {
      setIsSessionLoading(true);
      try {
        const response = await getCurrentUser();
        if (!active) {
          return;
        }
        setUser(response.user);
        setError(null);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        if (caughtError instanceof ApiError && caughtError.status === 401) {
          clearAuth();
        } else {
          clearAuth();
          setError(extractApiErrorMessage(caughtError, "Unable to validate session."));
        }
      } finally {
        if (active) {
          setIsSessionLoading(false);
        }
      }
    }

    void validateSession();

    return () => {
      active = false;
    };
  }, [clearAuth, setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      csrfToken,
      isLoading,
      isSessionLoading,
      error,
      setUser,
      setCsrfToken,
      clearAuth,
      login,
      register,
      logout,
    }),
    [clearAuth, csrfToken, error, isLoading, isSessionLoading, login, logout, register, setCsrfToken, setUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
