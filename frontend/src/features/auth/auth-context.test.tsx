import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/features/auth/auth-context";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  type AuthUser,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/auth")>("@/lib/api/auth");
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    loginUser: vi.fn(),
    registerUser: vi.fn(),
    logoutUser: vi.fn(),
  };
});

const TEST_USER: AuthUser = {
  id: 11,
  email: "lina@example.com",
  username: "lina",
};

function Harness() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="user">{auth.user?.email ?? "none"}</div>
      <div data-testid="csrf">{auth.csrfToken ?? "none"}</div>
      <div data-testid="error">{auth.error ?? "none"}</div>
      <div data-testid="loading">{String(auth.isLoading)}</div>
      <div data-testid="session-loading">{String(auth.isSessionLoading)}</div>
      <button type="button" onClick={() => auth.setUser(TEST_USER)}>
        set-user
      </button>
      <button type="button" onClick={() => auth.setCsrfToken("csrf-123")}>
        set-csrf
      </button>
      <button type="button" onClick={() => auth.clearAuth()}>
        clear-auth
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            await auth.login("lina@example.com", "password123");
          } catch {
            // Intentional for testing failed requests.
          }
        }}
      >
        login
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            await auth.register("new@example.com", "newuser", "password123");
          } catch {
            // Intentional for testing failed requests.
          }
        }}
      >
        register
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        logout
      </button>
    </div>
  );
}

function renderAuthHarness() {
  return render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockRejectedValue(new ApiError("Unauthorized", 401, {}));
    vi.mocked(logoutUser).mockResolvedValue(undefined);
  });

  it("starts with empty auth state", async () => {
    renderAuthHarness();

    await waitFor(() => expect(screen.getByTestId("session-loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("csrf")).toHaveTextContent("none");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("updates and clears user/csrf state", async () => {
    const user = userEvent.setup();
    renderAuthHarness();

    await waitFor(() => expect(screen.getByTestId("session-loading")).toHaveTextContent("false"));

    await user.click(screen.getByRole("button", { name: "set-user" }));
    await user.click(screen.getByRole("button", { name: "set-csrf" }));

    expect(screen.getByTestId("user")).toHaveTextContent("lina@example.com");
    expect(screen.getByTestId("csrf")).toHaveTextContent("csrf-123");

    await user.click(screen.getByRole("button", { name: "clear-auth" }));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("csrf")).toHaveTextContent("none");
  });

  it("logs in and stores user/csrf", async () => {
    const user = userEvent.setup();

    let resolveLogin: (value: { user: AuthUser; csrfToken: string }) => void = () => {};
    const loginPromise = new Promise<{ user: AuthUser; csrfToken: string }>((resolve) => {
      resolveLogin = resolve;
    });

    vi.mocked(loginUser).mockReturnValueOnce(loginPromise);

    renderAuthHarness();
    await waitFor(() => expect(screen.getByTestId("session-loading")).toHaveTextContent("false"));

    await user.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("true"));
    expect(loginUser).toHaveBeenCalledWith("lina@example.com", "password123");

    resolveLogin({ user: TEST_USER, csrfToken: "csrf-live-token" });

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("lina@example.com");
    expect(screen.getByTestId("csrf")).toHaveTextContent("csrf-live-token");
    expect(window.localStorage.getItem("dictator2.auth.csrf")).toBe("csrf-live-token");
  });

  it("sets auth error on failed login", async () => {
    const user = userEvent.setup();
    vi.mocked(loginUser).mockRejectedValueOnce(
      new ApiError("Invalid email or password", 401, {
        error: {
          code: "INVALID_LOGIN",
          message: "Invalid email or password",
        },
      }),
    );

    renderAuthHarness();
    await waitFor(() => expect(screen.getByTestId("session-loading")).toHaveTextContent("false"));

    await user.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("Invalid email or password"));
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("registers and stores auth details", async () => {
    const user = userEvent.setup();

    vi.mocked(registerUser).mockResolvedValueOnce({
      user: {
        id: 22,
        email: "new@example.com",
        username: "newuser",
      },
      csrfToken: "csrf-from-register",
    });

    renderAuthHarness();
    await waitFor(() => expect(screen.getByTestId("session-loading")).toHaveTextContent("false"));

    await user.click(screen.getByRole("button", { name: "register" }));

    await waitFor(() => expect(registerUser).toHaveBeenCalledWith("new@example.com", "newuser", "password123"));
    expect(screen.getByTestId("user")).toHaveTextContent("new@example.com");
    expect(screen.getByTestId("csrf")).toHaveTextContent("csrf-from-register");
  });

  it("validates persisted session and clears invalid sessions", async () => {
    window.localStorage.setItem("dictator2.auth.user", JSON.stringify(TEST_USER));
    window.localStorage.setItem("dictator2.auth.csrf", "stale-csrf");

    vi.mocked(getCurrentUser).mockRejectedValueOnce(new ApiError("Unauthorized", 401, {}));

    renderAuthHarness();

    await waitFor(() => expect(screen.getByTestId("session-loading")).toHaveTextContent("false"));
    expect(getCurrentUser).toHaveBeenCalledOnce();
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("csrf")).toHaveTextContent("none");
    expect(window.localStorage.getItem("dictator2.auth.user")).toBeNull();
    expect(window.localStorage.getItem("dictator2.auth.csrf")).toBeNull();
  });
});
