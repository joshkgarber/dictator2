import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/features/auth/auth-context";
import { ProtectedRoute } from "@/features/auth/route-guard";
import { getCurrentUser, type AuthUser } from "@/lib/api/auth";
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

const AUTHED_USER: AuthUser = {
  id: 88,
  email: "guard@example.com",
  username: "guard",
};

describe("ProtectedRoute", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("shows loading state while validating session", async () => {
    vi.mocked(getCurrentUser).mockReturnValueOnce(new Promise(() => {}));

    render(
      <AuthProvider>
        <ProtectedRoute redirectTo="/login" onNavigate={() => {}}>
          <div>private content</div>
        </ProtectedRoute>
      </AuthProvider>,
    );

    expect(screen.getByText("Validating session...")).toBeInTheDocument();
  });

  it("redirects unauthenticated users", async () => {
    const onNavigate = vi.fn();
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new ApiError("Unauthorized", 401, {}));

    render(
      <AuthProvider>
        <ProtectedRoute redirectTo="/login" onNavigate={onNavigate}>
          <div>private content</div>
        </ProtectedRoute>
      </AuthProvider>,
    );

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("/login", { replace: true }));
  });

  it("allows authenticated users", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ user: AUTHED_USER });

    render(
      <AuthProvider>
        <ProtectedRoute redirectTo="/login" onNavigate={() => {}}>
          <div>private content</div>
        </ProtectedRoute>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("private content")).toBeInTheDocument());
  });
});
