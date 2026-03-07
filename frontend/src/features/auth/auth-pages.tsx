import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";

type AuthFormShellProps = {
  title: string;
  subtitle: string;
  error: string | null;
  footerLabel: string;
  footerActionLabel: string;
  onFooterAction: () => void;
  children: ReactNode;
};

function AuthFormShell({
  title,
  subtitle,
  error,
  footerLabel,
  footerActionLabel,
  onFooterAction,
  children,
}: AuthFormShellProps) {
  return (
    <main className="min-h-screen bg-app-canvas px-3 py-6 md:px-6 md:py-10">
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-[1.15fr,0.85fr]">
        <section className="rounded-2xl border border-slate-300/80 bg-white/95 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.14)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-slate-500">Dictator 2.0</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-900">{title}</h1>
          <p className="mt-3 max-w-md text-sm text-slate-700">{subtitle}</p>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="mt-6">{children}</div>

          <p className="mt-5 text-sm text-slate-700">
            {footerLabel}{" "}
            <button
              type="button"
              onClick={onFooterAction}
              className="font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-700"
            >
              {footerActionLabel}
            </button>
          </p>
        </section>

        <aside className="rounded-2xl border border-slate-300/70 bg-slate-900/95 p-6 text-slate-100 shadow-[0_16px_42px_rgba(15,23,42,0.25)] md:p-7">
          <h2 className="text-2xl font-semibold leading-tight">Focused practice, faster gains.</h2>
          <ul className="mt-5 space-y-3 text-sm text-slate-200/95">
            <li>Prepare text sessions, clips, and repetitions in one workspace.</li>
            <li>Track your score trends and completed training history.</li>
            <li>Pick up exactly where you left off after refresh or reconnect.</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type LoginPageProps = {
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
};

export function LoginPage({ onNavigate }: LoginPageProps) {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const visibleError = useMemo(() => formError || error, [error, formError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setFormError("Enter both your email and password.");
      return;
    }

    setFormError(null);

    try {
      await login(email.trim(), password);
      onNavigate("/", { replace: true });
    } catch {
      // Error state is managed by auth context.
    }
  }

  return (
    <AuthFormShell
      title="Welcome back"
      subtitle="Log in to continue your dictation training sessions and progress tracking."
      error={visibleError}
      footerLabel="Need an account?"
      footerActionLabel="Create one"
      onFooterAction={() => onNavigate("/register")}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <label className="block text-sm font-medium text-slate-700" htmlFor="login-email">
          Email
          <input
            id="login-email"
            name="email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700" htmlFor="login-password">
          Password
          <input
            id="login-password"
            name="password"
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </label>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Log In"}
        </Button>
      </form>
    </AuthFormShell>
  );
}

type RegisterPageProps = {
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
};

export function RegisterPage({ onNavigate }: RegisterPageProps) {
  const { register, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const visibleError = useMemo(() => formError || error, [error, formError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!isValidEmail(trimmedEmail)) {
      setFormError("Enter a valid email address.");
      return;
    }

    if (!trimmedUsername) {
      setFormError("Username cannot be empty.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    if (password !== passwordConfirmation) {
      setFormError("Passwords do not match.");
      return;
    }

    setFormError(null);

    try {
      await register(trimmedEmail, trimmedUsername, password);
      onNavigate("/", { replace: true });
    } catch {
      // Error state is managed by auth context.
    }
  }

  return (
    <AuthFormShell
      title="Create your account"
      subtitle="Set up your profile once and continue sessions seamlessly across visits."
      error={visibleError}
      footerLabel="Already have an account?"
      footerActionLabel="Log in"
      onFooterAction={() => onNavigate("/login")}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <label className="block text-sm font-medium text-slate-700" htmlFor="register-email">
          Email
          <input
            id="register-email"
            name="email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700" htmlFor="register-username">
          Username
          <input
            id="register-username"
            name="username"
            autoComplete="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700" htmlFor="register-password">
          Password
          <input
            id="register-password"
            name="password"
            autoComplete="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700" htmlFor="register-password-confirmation">
          Confirm password
          <input
            id="register-password-confirmation"
            name="passwordConfirmation"
            autoComplete="new-password"
            type="password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </label>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create Account"}
        </Button>
      </form>
    </AuthFormShell>
  );
}
