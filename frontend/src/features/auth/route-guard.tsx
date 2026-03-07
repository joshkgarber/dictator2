import { useEffect, type PropsWithChildren } from "react";

import { useAuth } from "@/features/auth/auth-context";

type AuthRedirectProps = {
  to: string;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
};

function AuthRedirect({ to, onNavigate }: AuthRedirectProps) {
  useEffect(() => {
    onNavigate(to, { replace: true });
  }, [onNavigate, to]);

  return null;
}

export function AuthLoadingScreen() {
  return (
    <main className="min-h-screen bg-app-canvas p-4 md:p-8">
      <div className="mx-auto flex max-w-xl items-center justify-center rounded-2xl border border-slate-300 bg-white/90 p-10 text-center shadow-[0_16px_45px_rgba(30,41,59,0.14)]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-slate-500">Dictator 2.0</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">Validating session...</p>
          <p className="mt-1 text-sm text-slate-600">Please wait while we secure your workspace.</p>
        </div>
      </div>
    </main>
  );
}

type GuardProps = PropsWithChildren<{
  redirectTo: string;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}>;

export function ProtectedRoute({ children, redirectTo, onNavigate }: GuardProps) {
  const { user, isSessionLoading } = useAuth();

  if (isSessionLoading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <AuthRedirect to={redirectTo} onNavigate={onNavigate} />;
  }

  return <>{children}</>;
}

export function GuestRoute({ children, redirectTo, onNavigate }: GuardProps) {
  const { user, isSessionLoading } = useAuth();

  if (isSessionLoading) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    return <AuthRedirect to={redirectTo} onNavigate={onNavigate} />;
  }

  return <>{children}</>;
}
