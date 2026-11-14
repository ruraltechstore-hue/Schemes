import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthenticatedLayout from "../routes/_authenticated/route";
import Login from "../routes/auth";
import {
  useInactivityTimeout,
  DEFAULT_INACTIVITY_TIMEOUT_MS,
  DEFAULT_INACTIVITY_WARNING_MS,
  AGENT_LAST_ACTIVITY_KEY,
  AGENT_LOGOUT_EVENT_KEY,
} from "../hooks/use-inactivity-timeout";
import { SessionTimeoutWarningDialog } from "../components/SessionTimeoutWarningDialog";
import { supabase } from "../integrations/supabase/client";
import * as appDataHooks from "../hooks/use-app-data";
import * as agentDataHooks from "../hooks/use-agent-data";

// Mock Supabase
vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

function TestHookComponent({
  enabled,
  timeoutMs = 10 * 60 * 1000,
  warningMs = 1 * 60 * 1000,
  onTimeout,
}: {
  enabled: boolean;
  timeoutMs?: number;
  warningMs?: number;
  onTimeout: () => void;
}) {
  const { showWarning, stayLoggedIn, timeRemainingMs } = useInactivityTimeout({
    enabled,
    timeoutMs,
    warningMs,
    onTimeout,
  });

  return (
    <div>
      <div data-testid="time-remaining">{timeRemainingMs}</div>
      <div data-testid="show-warning">{showWarning ? "warning-visible" : "no-warning"}</div>
      <button data-testid="stay-logged-in-btn" onClick={stayLoggedIn}>
        Stay Logged In
      </button>
      <SessionTimeoutWarningDialog open={showWarning} onStayLoggedIn={stayLoggedIn} />
    </div>
  );
}

describe("Automatic 10-Minute Inactivity Logout for Agent Accounts", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("1. useInactivityTimeout Hook & SessionTimeoutWarningDialog Unit Tests", () => {
    it("sets default timeout to 10 minutes (600,000ms) and warning to 1 minute (60,000ms)", () => {
      expect(DEFAULT_INACTIVITY_TIMEOUT_MS).toBe(10 * 60 * 1000);
      expect(DEFAULT_INACTIVITY_WARNING_MS).toBe(1 * 60 * 1000);
    });

    it("does not start timers or track inactivity when enabled is false (e.g. Admin or non-agent)", () => {
      vi.useFakeTimers();
      const onTimeout = vi.fn();

      render(
        <MemoryRouter>
          <TestHookComponent enabled={false} onTimeout={onTimeout} />
        </MemoryRouter>,
      );

      expect(screen.getByTestId("show-warning")).toHaveTextContent("no-warning");

      // Advance by 15 minutes
      act(() => {
        vi.advanceTimersByTime(15 * 60 * 1000);
      });

      expect(onTimeout).not.toHaveBeenCalled();
      expect(screen.getByTestId("show-warning")).toHaveTextContent("no-warning");
    });

    it("displays warning at 9 minutes (1 minute before 10-minute timeout) when agent is inactive", () => {
      vi.useFakeTimers();
      const onTimeout = vi.fn();

      render(
        <MemoryRouter>
          <TestHookComponent enabled={true} onTimeout={onTimeout} />
        </MemoryRouter>,
      );

      expect(screen.getByTestId("show-warning")).toHaveTextContent("no-warning");

      // Advance 8 minutes: still no warning
      act(() => {
        vi.advanceTimersByTime(8 * 60 * 1000);
      });
      expect(screen.getByTestId("show-warning")).toHaveTextContent("no-warning");
      expect(onTimeout).not.toHaveBeenCalled();

      // Advance 1 more minute (total 9 minutes = 1 minute remaining)
      act(() => {
        vi.advanceTimersByTime(1 * 60 * 1000);
      });
      expect(screen.getByTestId("show-warning")).toHaveTextContent("warning-visible");
      expect(
        screen.getByText(
          "Your session will expire in 1 minute due to inactivity. Continue working to remain logged in.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByTestId("stay-logged-in-button")).toBeInTheDocument();
      expect(onTimeout).not.toHaveBeenCalled();
    });

    it("resets inactivity timer and hides warning when agent clicks 'Stay Logged In'", () => {
      vi.useFakeTimers();
      const onTimeout = vi.fn();

      render(
        <MemoryRouter>
          <TestHookComponent enabled={true} onTimeout={onTimeout} />
        </MemoryRouter>,
      );

      // Advance 9 minutes: warning appears
      act(() => {
        vi.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(screen.getByTestId("show-warning")).toHaveTextContent("warning-visible");

      // Agent clicks "Stay Logged In"
      act(() => {
        fireEvent.click(screen.getByTestId("stay-logged-in-button"));
      });

      // Warning disappears, timer reset
      expect(screen.getByTestId("show-warning")).toHaveTextContent("no-warning");

      // Advance 8 minutes from reset: still active, no timeout, no warning
      act(() => {
        vi.advanceTimersByTime(8 * 60 * 1000);
      });
      expect(screen.getByTestId("show-warning")).toHaveTextContent("no-warning");
      expect(onTimeout).not.toHaveBeenCalled();
    });

    it("resets inactivity timer when agent performs user activities (mousemove, keydown, click, scroll)", () => {
      vi.useFakeTimers();
      const onTimeout = vi.fn();

      render(
        <MemoryRouter>
          <TestHookComponent enabled={true} onTimeout={onTimeout} />
        </MemoryRouter>,
      );

      // Advance 5 minutes
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      // User moves mouse (throttled user interaction)
      act(() => {
        fireEvent.mouseMove(window);
      });

      // Advance another 5 minutes (10 mins since start, but only 5 mins since last activity)
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });
      expect(screen.getByTestId("show-warning")).toHaveTextContent("no-warning");
      expect(onTimeout).not.toHaveBeenCalled();

      // User presses key
      act(() => {
        fireEvent.keyDown(window, { key: "Enter" });
      });

      // Advance another 5 minutes
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });
      expect(screen.getByTestId("show-warning")).toHaveTextContent("no-warning");
      expect(onTimeout).not.toHaveBeenCalled();
    });

    it("automatically triggers onTimeout when agent remains inactive for 10 minutes", () => {
      vi.useFakeTimers();
      const onTimeout = vi.fn();

      render(
        <MemoryRouter>
          <TestHookComponent enabled={true} onTimeout={onTimeout} />
        </MemoryRouter>,
      );

      // Advance full 10 minutes
      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(AGENT_LOGOUT_EVENT_KEY)).toBeTruthy();
      expect(localStorage.getItem(AGENT_LAST_ACTIVITY_KEY)).toBeNull();
    });

    it("synchronizes activity and logout across multiple tabs via storage events", () => {
      vi.useFakeTimers();
      const onTimeout = vi.fn();

      render(
        <MemoryRouter>
          <TestHookComponent enabled={true} onTimeout={onTimeout} />
        </MemoryRouter>,
      );

      // Advance 9 minutes: warning appears
      act(() => {
        vi.advanceTimersByTime(9 * 60 * 1000);
      });
      expect(screen.getByTestId("show-warning")).toHaveTextContent("warning-visible");

      // Tab 2 records activity at Date.now()
      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: AGENT_LAST_ACTIVITY_KEY,
            newValue: String(Date.now()),
          }),
        );
      });

      // Warning disappears in Tab 1 because Tab 2 had activity
      expect(screen.getByTestId("show-warning")).toHaveTextContent("no-warning");

      // Tab 2 performs logout
      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: AGENT_LOGOUT_EVENT_KEY,
            newValue: String(Date.now()),
          }),
        );
      });

      // Tab 1 triggers onTimeout
      expect(onTimeout).toHaveBeenCalled();
    });
  });

  describe("2. Authenticated Layout Integration for Agent Accounts", () => {
    it("enforces inactivity timeout for approved Agent accounts and renders warning dialog", async () => {
      vi.useFakeTimers();

      vi.spyOn(appDataHooks, "useUser").mockReturnValue({
        data: { id: "agent-123", email: "agent@agency.org" } as any,
        isLoading: false,
      } as any);
      vi.spyOn(appDataHooks, "useIsAdmin").mockReturnValue({
        data: false,
        isLoading: false,
      } as any);
      vi.spyOn(appDataHooks, "useProfile").mockReturnValue({
        data: { id: "agent-123", full_name: "Agent Ramesh" } as any,
        isLoading: false,
      } as any);
      vi.spyOn(agentDataHooks, "useAgentProfile").mockReturnValue({
        data: {
          id: "agent-123",
          status: "approved",
          email_verified: true,
          full_name: "Agent Ramesh",
          agency_name: "Rural Seva Kendra",
        } as any,
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <Routes>
              <Route element={<AuthenticatedLayout />}>
                <Route path="/dashboard" element={<div>Protected Agent Dashboard</div>} />
              </Route>
              <Route path="/auth" element={<div>Agent Login Page</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByText("Protected Agent Dashboard")).toBeInTheDocument();

      // Inactive for 9 minutes
      act(() => {
        vi.advanceTimersByTime(9 * 60 * 1000);
      });

      expect(
        screen.getByText(
          "Your session will expire in 1 minute due to inactivity. Continue working to remain logged in.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByTestId("stay-logged-in-button")).toBeInTheDocument();

      // Inactive for full 10 minutes (1 more minute)
      await act(async () => {
        vi.advanceTimersByTime(1 * 60 * 1000);
      });

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(sessionStorage.getItem("inactivity_logout_message")).toBe(
        "Your session has expired due to 10 minutes of inactivity. Please log in again.",
      );
    });

    it("does NOT apply inactivity timeout to Admin accounts", async () => {
      vi.useFakeTimers();

      vi.spyOn(appDataHooks, "useUser").mockReturnValue({
        data: { id: "admin-123", email: "admin@gov.in" } as any,
        isLoading: false,
      } as any);
      vi.spyOn(appDataHooks, "useIsAdmin").mockReturnValue({
        data: true,
        isLoading: false,
      } as any);
      vi.spyOn(appDataHooks, "useProfile").mockReturnValue({
        data: { id: "admin-123", full_name: "Platform Admin" } as any,
        isLoading: false,
      } as any);
      vi.spyOn(agentDataHooks, "useAgentProfile").mockReturnValue({
        data: null,
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <Routes>
              <Route element={<AuthenticatedLayout />}>
                <Route path="/dashboard" element={<div>Admin Protected Page</div>} />
              </Route>
              <Route path="/auth" element={<div>Login Page</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByText("Admin Protected Page")).toBeInTheDocument();

      // Inactive for 15 minutes
      act(() => {
        vi.advanceTimersByTime(15 * 60 * 1000);
      });

      expect(
        screen.queryByText(/Your session will expire in 1 minute due to inactivity/i),
      ).not.toBeInTheDocument();
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
      expect(screen.getByText("Admin Protected Page")).toBeInTheDocument();
    });
  });

  describe("3. Login Page Expiry Alert & Browser Back Navigation Protection", () => {
    it("displays the exact session expired message on Agent Login page when redirected after timeout", () => {
      sessionStorage.setItem(
        "inactivity_logout_message",
        "Your session has expired due to 10 minutes of inactivity. Please log in again.",
      );

      render(
        <MemoryRouter initialEntries={["/auth"]}>
          <Routes>
            <Route path="/auth" element={<Login />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Your session has expired due to 10 minutes of inactivity. Please log in again.",
      );
    });

    it("prevents browser back button access to protected pages after session sign-out", () => {
      vi.spyOn(appDataHooks, "useUser").mockReturnValue({
        data: null,
        isLoading: false,
      } as any);
      vi.spyOn(appDataHooks, "useIsAdmin").mockReturnValue({
        data: false,
        isLoading: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <Routes>
              <Route element={<AuthenticatedLayout />}>
                <Route path="/dashboard" element={<div>Protected Agent Dashboard</div>} />
              </Route>
              <Route path="/auth" element={<div>Redirected to Agent Login</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // User is null -> immediately redirects to /auth, protected dashboard not displayed
      expect(screen.queryByText("Protected Agent Dashboard")).not.toBeInTheDocument();
      expect(screen.getByText("Redirected to Agent Login")).toBeInTheDocument();
    });
  });
});
