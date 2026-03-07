import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/app/app-shell";
import { LoginPage, RegisterPage } from "@/features/auth/auth-pages";
import { GuestRoute, ProtectedRoute } from "@/features/auth/route-guard";

type AppPath = "/" | "/login" | "/register";

function normalizePath(pathname: string): AppPath {
  if (pathname === "/login") {
    return "/login";
  }
  if (pathname === "/register") {
    return "/register";
  }
  return "/";
}

export function AppRoutes() {
  const [path, setPath] = useState<AppPath>(() => normalizePath(window.location.pathname));

  const navigate = useCallback((nextPath: string, options?: { replace?: boolean }) => {
    const normalizedPath = normalizePath(nextPath);

    if (normalizedPath === path) {
      return;
    }

    if (options?.replace) {
      window.history.replaceState(null, "", normalizedPath);
    } else {
      window.history.pushState(null, "", normalizedPath);
    }

    setPath(normalizedPath);
  }, [path]);

  useEffect(() => {
    const handlePopState = () => {
      setPath(normalizePath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  if (path === "/login") {
    return (
      <GuestRoute redirectTo="/" onNavigate={navigate}>
        <LoginPage onNavigate={navigate} />
      </GuestRoute>
    );
  }

  if (path === "/register") {
    return (
      <GuestRoute redirectTo="/" onNavigate={navigate}>
        <RegisterPage onNavigate={navigate} />
      </GuestRoute>
    );
  }

  return (
    <ProtectedRoute redirectTo="/login" onNavigate={navigate}>
      <AppShell />
    </ProtectedRoute>
  );
}
