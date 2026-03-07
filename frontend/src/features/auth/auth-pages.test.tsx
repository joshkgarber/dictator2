import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage, RegisterPage } from "@/features/auth/auth-pages";
import { useAuth } from "@/features/auth/auth-context";

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

describe("auth pages", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates login empty fields before submit", async () => {
    const user = userEvent.setup();
    const login = vi.fn();

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      csrfToken: null,
      isLoading: false,
      isSessionLoading: false,
      error: null,
      setUser: vi.fn(),
      setCsrfToken: vi.fn(),
      clearAuth: vi.fn(),
      login,
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<LoginPage onNavigate={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Log In" }));

    expect(login).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter both your email and password.");
  });

  it("validates password confirmation before register API call", async () => {
    const user = userEvent.setup();
    const register = vi.fn();

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      csrfToken: null,
      isLoading: false,
      isSessionLoading: false,
      error: null,
      setUser: vi.fn(),
      setCsrfToken: vi.fn(),
      clearAuth: vi.fn(),
      login: vi.fn(),
      register,
      logout: vi.fn(),
    });

    render(<RegisterPage onNavigate={() => {}} />);

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password321");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(register).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
  });
});
