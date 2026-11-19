import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Login from "@/routes/auth";
import Register from "@/routes/register";
import AdminDashboard from "@/routes/_authenticated/admin";
import SubAdminDashboard from "@/routes/_authenticated/subadmin";
import { supabase } from "@/integrations/supabase/client";
import * as otpClient from "@/lib/otp-client";

// Mock Select component for jsdom compatibility
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, id, disabled }: any) => (
    <select
      data-testid={id}
      id={id}
      aria-label={id || "Select"}
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
    >
      <option value="">Select option</option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children, id }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      getSession: vi.fn(),
      setSession: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Authentication Workflow - 3 Roles Independent Verification", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: null },
      error: null,
    });
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  // ==========================================
  // ROLE 1: MAIN ADMIN AUTHENTICATION
  // ==========================================
  describe("Role 1: Main Admin Authentication", () => {
    it("Main Admin logs in with email + password, verifies admin role, and is redirected to /admin", async () => {
      const adminUser = {
        id: "main-admin-uuid",
        email: "admin@schemecompass.gov.in",
      };

      (supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: { user: adminUser },
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                if (col === "user_id") {
                  return {
                    eq: vi.fn().mockResolvedValue({
                      data: [{ role: "admin" }],
                      error: null,
                    }),
                    then: (resolve: any) => resolve({ data: [{ role: "admin" }], error: null }),
                  };
                }
                return Promise.resolve({ data: [{ role: "admin" }], error: null });
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/auth"]}>
            <Routes>
              <Route path="/auth" element={<Login />} />
              <Route path="/admin" element={<div data-testid="main-admin-dashboard">Main Admin Portal</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: adminUser.email } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "AdminSecret#2026" } });
      fireEvent.click(screen.getByRole("button", { name: /^Login$/i }));

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: adminUser.email,
          password: "AdminSecret#2026",
        });
        expect(screen.getByTestId("main-admin-dashboard")).toBeInTheDocument();
      });
    });
  });

  // ==========================================
  // ROLE 2: SUB-ADMIN AUTHENTICATION (NO OTP)
  // ==========================================
  describe("Role 2: Sub-Admin Authentication (No OTP)", () => {
    it("Sub-Admin logs in directly using email + password without any OTP requirement and routes to /sub-admin", async () => {
      const subAdminUser = {
        id: "sub-admin-uuid-1",
        email: "subadmin.samrik@gov.in",
        full_name: "Rajesh Sharma",
        organization_name: "Samrik Foundation",
        is_active: true,
      };

      (supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: { user: { id: subAdminUser.id, email: subAdminUser.email } },
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ role: "sub_admin" }],
                error: null,
              }),
            }),
          };
        }
        if (table === "sub_admin_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: subAdminUser,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/auth"]}>
            <Routes>
              <Route path="/auth" element={<Login />} />
              <Route path="/sub-admin" element={<div data-testid="sub-admin-portal">Sub-Admin Portal</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: subAdminUser.email } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "SubAdminPass#123" } });
      fireEvent.click(screen.getByRole("button", { name: /^Login$/i }));

      // Immediately reaches /sub-admin without any OTP or email confirmation view
      await waitFor(() => {
        expect(screen.getByTestId("sub-admin-portal")).toBeInTheDocument();
      });
      expect(screen.queryByText(/Verify OTP/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Verification code/i)).not.toBeInTheDocument();
    });

    it("Deactivated Sub-Admin is blocked and signed out upon login attempt", async () => {
      const inactiveSubAdmin = {
        id: "inactive-sub-admin-uuid",
        email: "deactivated@subadmin.org",
        full_name: "Inactive User",
        organization_name: "Former Agency",
        is_active: false,
      };

      (supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: { user: { id: inactiveSubAdmin.id, email: inactiveSubAdmin.email } },
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ role: "sub_admin" }],
                error: null,
              }),
            }),
          };
        }
        if (table === "sub_admin_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: inactiveSubAdmin,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/auth"]}>
            <Routes>
              <Route path="/auth" element={<Login />} />
              <Route path="/sub-admin" element={<div data-testid="sub-admin-portal">Sub-Admin Portal</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: inactiveSubAdmin.email } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "Password#123" } });
      fireEvent.click(screen.getByRole("button", { name: /^Login$/i }));

      await waitFor(() => {
        expect(supabase.auth.signOut).toHaveBeenCalled();
        expect(screen.queryByTestId("sub-admin-portal")).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================
  // ROLE 3: AGENT REGISTRATION & OTP VERIFICATION
  // ==========================================
  describe("Role 3: Agent Registration & OTP Verification", () => {
    it("Agent Registration enforces OTP verification before approval request is submitted to Sub-Admin", async () => {
      const activeSubAdmin = {
        id: "target-subadmin-id",
        organization_name: "Navogiz Rural Tech",
        full_name: "Amit Patel",
        is_active: true,
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "sub_admin_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [activeSubAdmin], error: null }),
              }),
            }),
          };
        }
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      (supabase.auth.signUp as any).mockResolvedValue({
        data: {
          user: {
            id: "agent-new-uuid",
            email: "agent.karan@gmail.com",
            identities: [{ id: "identity-1" }],
          },
        },
        error: null,
      });

      vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
        success: true,
        message: "OTP sent to agent.karan@gmail.com",
        cooldownSeconds: 60,
        expiresInSeconds: 300,
      });

      vi.spyOn(otpClient, "verifyOtpRequest").mockResolvedValue({
        success: true,
        message: "OTP verified successfully!",
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/register"]}>
            <Register />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify Sub-Admin is dynamically selectable
      await waitFor(() => {
        expect(screen.getByText(new RegExp(activeSubAdmin.organization_name, "i"))).toBeInTheDocument();
      });

      // Fill in registration form
      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Karan Singh" } });
      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "agent.karan@gmail.com" } });
      fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9812345678" } });
      fireEvent.change(screen.getByTestId("reg-sub-admin"), { target: { value: activeSubAdmin.id } });
      fireEvent.change(screen.getByTestId("reg-state"), { target: { value: "Punjab" } });
      fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Amritsar" } });
      fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "AgentPass#2026" } });
      fireEvent.change(screen.getByLabelText(/Confirm Pass/i), { target: { value: "AgentPass#2026" } });

      // Submit registration
      fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

      // OTP Verification Screen MUST be shown for Agent
      await waitFor(() => {
        expect(otpClient.sendOtpRequest).toHaveBeenCalledWith("agent.karan@gmail.com", "Karan Singh");
        expect(screen.getByText("Verify Your Email")).toBeInTheDocument();
      });

      // Verification code view elements must be displayed
      expect(screen.getByRole("button", { name: /Verify OTP/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Resend OTP/i })).toBeInTheDocument();

      // Enter 6-digit OTP into the OTP input
      const otpInput = document.querySelector("input") as HTMLInputElement;
      expect(otpInput).toBeInTheDocument();
      fireEvent.change(otpInput, { target: { value: "123456" } });
      fireEvent.click(screen.getByRole("button", { name: /Verify OTP/i }));

      // OTP client verification was called
      await waitFor(() => {
        expect(otpClient.verifyOtpRequest).toHaveBeenCalledWith("agent.karan@gmail.com", "123456");
      });
    });

    it("Approved Agent logs in with email + password and is routed to /dashboard", async () => {
      const approvedAgent = {
        id: "approved-agent-uuid",
        email: "approved.agent@gov.in",
        full_name: "Sunil Varma",
        status: "approved",
        email_verified: true,
      };

      (supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: { user: { id: approvedAgent.id, email: approvedAgent.email } },
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ role: "agent" }],
                error: null,
              }),
            }),
          };
        }
        if (table === "agent_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: approvedAgent,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/auth"]}>
            <Routes>
              <Route path="/auth" element={<Login />} />
              <Route path="/dashboard" element={<div data-testid="agent-dashboard">Agent Dashboard</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: approvedAgent.email } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "Agent#Pass123" } });
      fireEvent.click(screen.getByRole("button", { name: /^Login$/i }));

      await waitFor(() => {
        expect(screen.getByTestId("agent-dashboard")).toBeInTheDocument();
      });
    });
  });
});
