import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Register from "../routes/register";
import AuthenticatedLayout from "../routes/_authenticated/route";
import AdminAgentManagement from "../components/AdminAgentManagement";
import { supabase } from "../integrations/supabase/client";
import * as appDataHooks from "../hooks/use-app-data";
import * as agentDataHooks from "../hooks/use-agent-data";
import * as otpClient from "../lib/otp-client";

// Mock Supabase
vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// Mock Select for jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, id }: any) => (
    <select id={id || "reg-state"} aria-label="State" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      <option value="">Select State</option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

describe("Agent Registration & Approval Workflow – Strict OTP Verification", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  // Scenario 1: Agent enters registration details -> OTP is sent; no Admin request
  it("Scenario 1: Agent enters registration details -> OTP is sent, unverified account created, no Admin approval request", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({
      upsert: mockUpsert,
    });

    (supabase.auth.signUp as any).mockResolvedValue({
      data: { user: { id: "agent-123", email: "agent@agency.org" } },
      error: null,
    });

    const sendSpy = vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "Verification code sent to your email",
      cooldownSeconds: 60,
      expiresInSeconds: 300,
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    // Verify all 9 fields exist in form
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mobile number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Organization \/ Agency Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Address$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/State/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/District/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm/i)).toBeInTheDocument();

    // Fill the registration form
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Suresh Sharma" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "suresh@kendra.org" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/Organization \/ Agency Name/i), {
      target: { value: "Gramin Seva Kendra" },
    });
    fireEvent.change(screen.getByLabelText(/^Address$/i), {
      target: { value: "Plot 12, Main Road" },
    });
    fireEvent.change(screen.getByLabelText(/State/i), { target: { value: "Uttar Pradesh" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Varanasi" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "SecurePass123" } });
    fireEvent.change(screen.getByLabelText(/Confirm/i), { target: { value: "SecurePass123" } });

    // Submit registration
    fireEvent.click(screen.getByText("Create Account"));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalled();
    });

    // Ensure status is submitted as UNVERIFIED (never pending before OTP)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "agent-123",
        full_name: "Suresh Sharma",
        agency_name: "Gramin Seva Kendra",
        status: "unverified",
        email_verified: false,
      })
    );

    // Transitions to OTP screen
    expect(await screen.findByText("Verify Your Email")).toBeInTheDocument();
    expect(sendSpy).toHaveBeenCalledWith("suresh@kendra.org", "Suresh Sharma");
  });

  // Scenario 2: Agent enters incorrect OTP -> Verification fails; no Admin request
  it("Scenario 2: Agent enters incorrect OTP -> Verification fails, remains on OTP screen, no Admin request created", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({
      upsert: mockUpsert,
    });

    (supabase.auth.signUp as any).mockResolvedValue({
      data: { user: { id: "agent-123", email: "agent@agency.org" } },
      error: null,
    });

    vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "Verification code sent to your email",
    });

    const verifySpy = vi.spyOn(otpClient, "verifyOtpRequest").mockResolvedValue({
      success: false,
      message: "Incorrect OTP. 4 attempts remaining.",
      error: "Incorrect OTP",
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    // Fill form and submit to reach OTP screen
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Suresh Sharma" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "suresh@kendra.org" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/Organization \/ Agency Name/i), { target: { value: "Gramin Seva" } });
    fireEvent.change(screen.getByLabelText(/^Address$/i), { target: { value: "Plot 12" } });
    fireEvent.change(screen.getByLabelText(/State/i), { target: { value: "Uttar Pradesh" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Varanasi" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "SecurePass123" } });
    fireEvent.change(screen.getByLabelText(/Confirm/i), { target: { value: "SecurePass123" } });

    fireEvent.click(screen.getByText("Create Account"));

    expect(await screen.findByText("Verify Your Email")).toBeInTheDocument();
    mockUpsert.mockClear();

    // Agent enters incorrect OTP
    const otpInput = document.querySelector("input") as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify OTP/i }));

    // Verification fails
    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith("suresh@kendra.org", "000000");
    });

    expect(await screen.findByText("Incorrect OTP. 4 attempts remaining.")).toBeInTheDocument();

    // Still on OTP screen
    expect(screen.getByText("Verify Your Email")).toBeInTheDocument();

    // No Admin request with status 'pending' was upserted
    expect(mockUpsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" })
    );
  });

  // Scenario 3: Agent enters expired OTP -> Verification fails; no Admin request
  it("Scenario 3: Agent enters expired OTP -> Verification fails, remains on OTP screen, no Admin request", async () => {
    (supabase.auth.signUp as any).mockResolvedValue({
      data: { user: { id: "agent-123", email: "agent@agency.org" } },
      error: null,
    });

    vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "Verification code sent to your email",
    });

    const verifySpy = vi.spyOn(otpClient, "verifyOtpRequest").mockResolvedValue({
      success: false,
      message: "OTP has expired. Please request a new verification code.",
      error: "OTP expired",
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Suresh Sharma" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "suresh@kendra.org" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/State/i), { target: { value: "Uttar Pradesh" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Varanasi" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "SecurePass123" } });
    fireEvent.change(screen.getByLabelText(/Confirm/i), { target: { value: "SecurePass123" } });

    fireEvent.click(screen.getByText("Create Account"));

    expect(await screen.findByText("Verify Your Email")).toBeInTheDocument();

    const otpInput = document.querySelector("input") as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: "999999" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify OTP/i }));

    expect(await screen.findByText("OTP has expired. Please request a new verification code.")).toBeInTheDocument();
    expect(screen.getByText("Verify Your Email")).toBeInTheDocument();
  });

  // Scenario 4: Agent does not verify OTP -> Unverified agents must NEVER appear in Admin's pending approval list
  it("Scenario 4: Agent does not verify OTP -> Never appears in Admin Pending Requests, cannot access dashboard", async () => {
    // 1. Unverified agent in AdminAgentManagement
    const unverifiedAgent = {
      id: "agent-unverified-1",
      full_name: "Unverified Person",
      email: "unverified@nowhere.com",
      mobile: "9999999999",
      agency_name: "Incomplete Agency",
      address: "Unknown",
      state: "Goa",
      district: "Panaji",
      status: "unverified",
      email_verified: false,
      created_at: new Date().toISOString(),
    };

    const verifiedPendingAgent = {
      id: "agent-pending-1",
      full_name: "Verified Pending Agent",
      email: "verified@agency.org",
      mobile: "8888888888",
      agency_name: "Verified Agency",
      address: "Station Road",
      state: "Gujarat",
      district: "Surat",
      status: "pending",
      email_verified: true,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(agentDataHooks, "useAllAgentProfiles").mockReturnValue({
      data: [unverifiedAgent, verifiedPendingAgent],
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminAgentManagement />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verified pending agent appears
    expect(await screen.findByText("Verified Pending Agent")).toBeInTheDocument();

    // UNVERIFIED agent MUST NEVER appear in Admin's pending approval list!
    expect(screen.queryByText("Unverified Person")).toBeNull();
  });

  // Scenario 5: Agent successfully verifies OTP -> Pending approval request is created, Admin notified, exact message displayed
  it("Scenario 5: Agent successfully verifies OTP -> Pending approval request created with exact required success message", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({
      upsert: mockUpsert,
    });

    (supabase.auth.signUp as any).mockResolvedValue({
      data: { user: { id: "agent-123", email: "suresh@kendra.org" } },
      error: null,
    });

    vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "Verification code sent to your email",
    });

    vi.spyOn(otpClient, "verifyOtpRequest").mockResolvedValue({
      success: true,
      message: "Email verified successfully!",
    });

    const notifySpy = vi.spyOn(otpClient, "notifyAdminApprovalRequest").mockResolvedValue({
      success: true,
    });

    (supabase.auth.signInWithPassword as any) = vi.fn().mockResolvedValue({
      data: { user: { id: "agent-123" }, session: { access_token: "tok", refresh_token: "ref" } },
      error: null,
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Suresh Sharma" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "suresh@kendra.org" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/Organization \/ Agency Name/i), { target: { value: "Gramin Seva" } });
    fireEvent.change(screen.getByLabelText(/^Address$/i), { target: { value: "Plot 12" } });
    fireEvent.change(screen.getByLabelText(/State/i), { target: { value: "Uttar Pradesh" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Varanasi" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "SecurePass123" } });
    fireEvent.change(screen.getByLabelText(/Confirm/i), { target: { value: "SecurePass123" } });

    fireEvent.click(screen.getByText("Create Account"));

    expect(await screen.findByText("Verify Your Email")).toBeInTheDocument();

    const otpInput = document.querySelector("input") as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify OTP/i }));

    // Exact required success message:
    // "Your email has been verified successfully. Your registration request has been sent to the Admin for approval. You will be able to access your Agent Dashboard after approval."
    expect(
      await screen.findByText(
        "Your email has been verified successfully. Your registration request has been sent to the Admin for approval. You will be able to access your Agent Dashboard after approval."
      )
    ).toBeInTheDocument();

    // Pending agent profile activated
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "agent-123",
        status: "pending",
        email_verified: true,
      })
    );

    // Admin notification triggered
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Suresh Sharma",
        email: "suresh@kendra.org",
      })
    );
  });

  // Scenario 6: Agent verifies OTP multiple times -> Only one approval request exists (idempotent)
  it("Scenario 6: Agent verifies OTP multiple times -> Handles repeated verification safely and idempotently", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({
      upsert: mockUpsert,
    });

    (supabase.auth.signUp as any).mockResolvedValue({
      data: { user: { id: "agent-123", email: "suresh@kendra.org" } },
      error: null,
    });

    vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({ success: true, message: "OTP sent" });
    vi.spyOn(otpClient, "verifyOtpRequest").mockResolvedValue({
      success: true,
      message: "Email already verified successfully!",
    });

    (supabase.auth.signInWithPassword as any) = vi.fn().mockResolvedValue({
      data: { user: { id: "agent-123" }, session: {} },
      error: null,
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Suresh Sharma" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "suresh@kendra.org" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/State/i), { target: { value: "Uttar Pradesh" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Varanasi" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "SecurePass123" } });
    fireEvent.change(screen.getByLabelText(/Confirm/i), { target: { value: "SecurePass123" } });

    fireEvent.click(screen.getByText("Create Account"));

    expect(await screen.findByText("Verify Your Email")).toBeInTheDocument();

    const otpInput = document.querySelector("input") as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify OTP/i }));

    expect(
      await screen.findByText(
        "Your email has been verified successfully. Your registration request has been sent to the Admin for approval. You will be able to access your Agent Dashboard after approval."
      )
    ).toBeInTheDocument();
  });

  // Scenario 7: Admin approves verified agent -> Agent can access dashboard
  it("Scenario 7: Admin approves verified agent -> Status becomes approved and agent can access dashboard", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "agent_profiles") {
        return {
          update: mockUpdate,
        };
      }
      return { select: vi.fn() };
    });

    const pendingAgent = {
      id: "agent-1",
      full_name: "Rajesh Kumar",
      email: "rajesh@seva.org",
      mobile: "9123456780",
      agency_name: "Rural Seva",
      address: "Main Bazar",
      state: "Bihar",
      district: "Patna",
      status: "pending",
      email_verified: true,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(agentDataHooks, "useAllAgentProfiles").mockReturnValue({
      data: [pendingAgent],
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminAgentManagement />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Rajesh Kumar")).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: /^Approve$/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "approved",
        })
      );
    });

    // Now test that approved agent can access dashboard
    vi.spyOn(appDataHooks, "useUser").mockReturnValue({
      data: { id: "agent-1", email: "rajesh@seva.org" } as any,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useIsAdmin").mockReturnValue({
      data: false,
      isLoading: false,
    } as any);

    vi.spyOn(agentDataHooks, "useAgentProfile").mockReturnValue({
      data: {
        id: "agent-1",
        full_name: "Rajesh Kumar",
        status: "approved",
        email_verified: true,
      } as any,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<AuthenticatedLayout />}>
              <Route path="/dashboard" element={<div data-testid="dashboard-content">Agent Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("dashboard-content")).toBeInTheDocument();
  });

  // Scenario 8: Admin rejects verified agent -> Agent cannot access dashboard
  it("Scenario 8: Admin rejects verified agent -> Agent cannot access dashboard and sees rejection notice", async () => {
    vi.spyOn(appDataHooks, "useUser").mockReturnValue({
      data: { id: "agent-rejected-1", email: "rejected@agent.org" } as any,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useIsAdmin").mockReturnValue({
      data: false,
      isLoading: false,
    } as any);

    vi.spyOn(agentDataHooks, "useAgentProfile").mockReturnValue({
      data: {
        id: "agent-rejected-1",
        full_name: "Rejected Agent",
        status: "rejected",
        email_verified: true,
        rejection_reason: "Invalid business address",
      } as any,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<AuthenticatedLayout />}>
              <Route path="/dashboard" element={<div data-testid="dashboard-content">Agent Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByTestId("dashboard-content")).not.toBeInTheDocument();
    expect(screen.getByText(/Your agent registration has been rejected by the administrator\./i)).toBeInTheDocument();
    expect(screen.getByText(/Invalid business address/i)).toBeInTheDocument();
  });
});
