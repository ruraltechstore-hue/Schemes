import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Register from "@/routes/register";
import SubAdminDashboard from "@/routes/_authenticated/subadmin";
import { AdminAgentManagement } from "@/components/AdminAgentManagement";
import { supabase } from "@/integrations/supabase/client";
import * as otpClient from "@/lib/otp-client";
import { sendEmailOtp } from "@/server/otp-service";

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

describe("Agent OTP Deduplication & Sub-Admin Approval Routing", () => {
  let queryClient: QueryClient;

  const mockSubAdminSamrik = {
    id: "sub-admin-samrik-id",
    full_name: "Ramesh Sharma",
    email: "ramesh@samrik.org",
    organization_name: "Samrik Foundation",
    designation: "District Director",
    is_active: true,
  };

  const mockSubAdminNavogiz = {
    id: "sub-admin-navogiz-id",
    full_name: "Pooja Verma",
    email: "pooja@navogiz.org",
    organization_name: "Navogiz Rural Tech",
    designation: "Regional Head",
    is_active: true,
  };

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

  // =========================================================================
  // SCENARIO 1: Register an agent and verify that exactly one OTP email is received
  // =========================================================================
  it("Scenario 1: sends exactly ONE OTP email per Agent Registration submission", async () => {
    const sendOtpSpy = vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "Verification code sent to your email",
      cooldownSeconds: 60,
      expiresInSeconds: 300,
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [mockSubAdminSamrik, mockSubAdminNavogiz],
                error: null,
              }),
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
        user: { id: "new-agent-1", email: "agent1@example.com", identities: [{ id: "id-1" }] },
      },
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/register"]}>
          <Register />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp(mockSubAdminSamrik.organization_name, "i"))).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Aarav Gupta" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "agent1@example.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByTestId("reg-sub-admin"), { target: { value: mockSubAdminSamrik.id } });
    fireEvent.change(screen.getByTestId("reg-state"), { target: { value: "Delhi" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Central" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "AgentPass123" } });
    fireEvent.change(screen.getByLabelText(/Confirm Pass/i), { target: { value: "AgentPass123" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      // Exactly one OTP request must be dispatched
      expect(sendOtpSpy).toHaveBeenCalledTimes(1);
      expect(sendOtpSpy).toHaveBeenCalledWith("agent1@example.com", "Aarav Gupta");
      // Supabase Auth resend should NEVER be called on initial signup
      expect(supabase.auth.resend).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SCENARIO 2: Click Submit multiple times and verify duplicate OTP emails are not sent
  // =========================================================================
  it("Scenario 2: clicking Submit multiple times does NOT send duplicate OTP emails", async () => {
    let resolveSend: any;
    const delayedPromise = new Promise<{
      success: boolean;
      message: string;
      cooldownSeconds: number;
      expiresInSeconds: number;
    }>((resolve) => {
      resolveSend = resolve;
    });

    const sendOtpSpy = vi.spyOn(otpClient, "sendOtpRequest").mockImplementation(() => delayedPromise);

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [mockSubAdminSamrik],
                error: null,
              }),
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
        user: { id: "new-agent-2", email: "agent2@example.com", identities: [{ id: "id-2" }] },
      },
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/register"]}>
          <Register />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp(mockSubAdminSamrik.organization_name, "i"))).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Aarav Gupta" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "agent2@example.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByTestId("reg-sub-admin"), { target: { value: mockSubAdminSamrik.id } });
    fireEvent.change(screen.getByTestId("reg-state"), { target: { value: "Delhi" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Central" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "AgentPass123" } });
    fireEvent.change(screen.getByLabelText(/Confirm Pass/i), { target: { value: "AgentPass123" } });

    const submitBtn = screen.getByRole("button", { name: /Create Account/i });

    // Click submit multiple times in rapid succession
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    // Resolve in-flight request
    resolveSend({
      success: true,
      message: "Verification code sent to your email",
      cooldownSeconds: 60,
      expiresInSeconds: 300,
    });

    await waitFor(() => {
      // Must only be called once, deduplicated by isSubmittingRef
      expect(sendOtpSpy).toHaveBeenCalledTimes(1);
      expect(supabase.auth.signUp).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // SCENARIO 3: Use Resend OTP and verify exactly one new email is sent
  // =========================================================================
  it("Scenario 3: Resend OTP sends exactly ONE new email per intentional resend action", async () => {
    const sendOtpSpy = vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "Verification code sent to your email",
      cooldownSeconds: 0,
      expiresInSeconds: 300,
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [mockSubAdminSamrik],
                error: null,
              }),
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
        user: { id: "new-agent-3", email: "agent3@example.com", identities: [{ id: "id-3" }] },
      },
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/register"]}>
          <Register />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp(mockSubAdminSamrik.organization_name, "i"))).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Aarav Gupta" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "agent3@example.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByTestId("reg-sub-admin"), { target: { value: mockSubAdminSamrik.id } });
    fireEvent.change(screen.getByTestId("reg-state"), { target: { value: "Delhi" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Central" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "AgentPass123" } });
    fireEvent.change(screen.getByLabelText(/Confirm Pass/i), { target: { value: "AgentPass123" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    // Reached OTP screen
    await waitFor(() => {
      expect(screen.getByText("Verify Your Email")).toBeInTheDocument();
      expect(sendOtpSpy).toHaveBeenCalledTimes(1);
    });

    // Click Resend OTP button
    const resendBtn = screen.getByRole("button", { name: /Resend OTP/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      // Exactly 1 additional OTP request dispatched, total = 2
      expect(sendOtpSpy).toHaveBeenCalledTimes(2);
      // Supabase Auth resend must NEVER be called (completely removed duplicate)
      expect(supabase.auth.resend).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SCENARIO 4: Register an agent selecting Samrik -> only Samrik receives request
  // =========================================================================
  it("Scenario 4: Registering an agent selecting Samrik routes the approval request ONLY to Samrik", async () => {
    vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "Verification code sent to your email",
      cooldownSeconds: 60,
      expiresInSeconds: 300,
    });

    vi.spyOn(otpClient, "verifyOtpRequest").mockResolvedValue({
      success: true,
      message: "Email verified successfully!",
    });

    const mockNotificationsInsert = vi.fn().mockResolvedValue({ error: null });
    const mockAgentProfilesUpsert = vi.fn().mockResolvedValue({ error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === "is_active") {
                return {
                  order: vi.fn().mockResolvedValue({
                    data: [mockSubAdminSamrik, mockSubAdminNavogiz],
                    error: null,
                  }),
                };
              }
              if (col === "id") {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: val === mockSubAdminSamrik.id ? mockSubAdminSamrik : mockSubAdminNavogiz,
                    error: null,
                  }),
                };
              }
              return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          }),
        };
      }
      if (table === "notifications") {
        return { insert: mockNotificationsInsert };
      }
      if (table === "agent_profiles") {
        return { upsert: mockAgentProfilesUpsert };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    (supabase.auth.signUp as any).mockResolvedValue({
      data: {
        user: { id: "agent-samrik-worker", email: "agent.samrik@test.com", identities: [{ id: "id-4" }] },
      },
      error: null,
    });

    (supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: {
        user: { id: "agent-samrik-worker", email: "agent.samrik@test.com" },
      },
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/register"]}>
          <Register />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp(mockSubAdminSamrik.organization_name, "i"))).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Kavita Nair" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "agent.samrik@test.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543211" } });
    fireEvent.change(screen.getByTestId("reg-sub-admin"), { target: { value: mockSubAdminSamrik.id } });
    fireEvent.change(screen.getByTestId("reg-state"), { target: { value: "Kerala" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Kochi" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "KavitaPass#123" } });
    fireEvent.change(screen.getByLabelText(/Confirm Pass/i), { target: { value: "KavitaPass#123" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    // Transition to OTP screen
    await waitFor(() => {
      expect(screen.getByText("Verify Your Email")).toBeInTheDocument();
    });

    const otpInput = document.querySelector("input") as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify OTP/i }));

    await waitFor(() => {
      // 1. Agent profile must be saved with sub_admin_id strictly equal to Samrik's ID
      expect(mockAgentProfilesUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          sub_admin_id: mockSubAdminSamrik.id,
          status: "pending",
          email_verified: true,
        })
      );

      // 2. In-app notification must ONLY be sent to Samrik's user_id
      expect(mockNotificationsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockSubAdminSamrik.id,
          type: "agent_approval",
        })
      );

      // Notification must NOT be sent to Navogiz
      expect(mockNotificationsInsert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockSubAdminNavogiz.id,
        })
      );
    });
  });

  // =========================================================================
  // SCENARIO 5: Register an agent selecting Navogiz -> only Navogiz receives request
  // =========================================================================
  it("Scenario 5: Registering an agent selecting Navogiz routes the approval request ONLY to Navogiz", async () => {
    vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "Verification code sent to your email",
      cooldownSeconds: 60,
      expiresInSeconds: 300,
    });

    vi.spyOn(otpClient, "verifyOtpRequest").mockResolvedValue({
      success: true,
      message: "Email verified successfully!",
    });

    const mockNotificationsInsert = vi.fn().mockResolvedValue({ error: null });
    const mockAgentProfilesUpsert = vi.fn().mockResolvedValue({ error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === "is_active") {
                return {
                  order: vi.fn().mockResolvedValue({
                    data: [mockSubAdminSamrik, mockSubAdminNavogiz],
                    error: null,
                  }),
                };
              }
              if (col === "id") {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: val === mockSubAdminNavogiz.id ? mockSubAdminNavogiz : mockSubAdminSamrik,
                    error: null,
                  }),
                };
              }
              return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          }),
        };
      }
      if (table === "notifications") {
        return { insert: mockNotificationsInsert };
      }
      if (table === "agent_profiles") {
        return { upsert: mockAgentProfilesUpsert };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    (supabase.auth.signUp as any).mockResolvedValue({
      data: {
        user: { id: "agent-navogiz-worker", email: "agent.navogiz@test.com", identities: [{ id: "id-5" }] },
      },
      error: null,
    });

    (supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: {
        user: { id: "agent-navogiz-worker", email: "agent.navogiz@test.com" },
      },
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/register"]}>
          <Register />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp(mockSubAdminNavogiz.organization_name, "i"))).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Manish Joshi" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "agent.navogiz@test.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543212" } });
    fireEvent.change(screen.getByTestId("reg-sub-admin"), { target: { value: mockSubAdminNavogiz.id } });
    fireEvent.change(screen.getByTestId("reg-state"), { target: { value: "Rajasthan" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Jaipur" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "ManishPass#123" } });
    fireEvent.change(screen.getByLabelText(/Confirm Pass/i), { target: { value: "ManishPass#123" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(screen.getByText("Verify Your Email")).toBeInTheDocument();
    });

    const otpInput = document.querySelector("input") as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify OTP/i }));

    await waitFor(() => {
      // 1. Agent profile saved with sub_admin_id strictly equal to Navogiz's ID
      expect(mockAgentProfilesUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          sub_admin_id: mockSubAdminNavogiz.id,
          status: "pending",
          email_verified: true,
        })
      );

      // 2. In-app notification must ONLY be sent to Navogiz's user_id
      expect(mockNotificationsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockSubAdminNavogiz.id,
          type: "agent_approval",
        })
      );

      // Notification must NOT be sent to Samrik
      expect(mockNotificationsInsert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockSubAdminSamrik.id,
        })
      );
    });
  });

  // =========================================================================
  // SCENARIO 6: Verify correct agent details appear in assigned Sub-Admin dashboard
  // =========================================================================
  it("Scenario 6: assigned Sub-Admin dashboard displays only their assigned agents", async () => {
    const samrikAgent = {
      id: "agent-samrik-1",
      full_name: "Kavita Nair",
      email: "agent.samrik@test.com",
      mobile: "9876543211",
      agency_name: "Kavita's Seva Kendra",
      state: "Kerala",
      district: "Kochi",
      status: "pending",
      email_verified: true,
      sub_admin_id: mockSubAdminSamrik.id,
      created_at: new Date().toISOString(),
    };

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: mockSubAdminSamrik.id, email: mockSubAdminSamrik.email } },
      error: null,
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "user_roles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === "user_id") {
                return {
                  eq: vi.fn().mockResolvedValue({ data: [{ role: "sub_admin" }], error: null }),
                  then: (r: any) => r({ data: [{ role: "sub_admin" }], error: null }),
                };
              }
              return Promise.resolve({ data: [{ role: "sub_admin" }], error: null });
            }),
          }),
        };
      }
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockSubAdminSamrik, error: null }),
            }),
          }),
        };
      }
      if (table === "agent_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === "sub_admin_id" && val === mockSubAdminSamrik.id) {
                return {
                  order: vi.fn().mockResolvedValue({ data: [samrikAgent], error: null }),
                };
              }
              return {
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          }),
        };
      }
      if (table === "notifications") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "agent_approval_history") {
        const chain: any = {
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        chain.eq = vi.fn().mockReturnValue(chain);
        return {
          select: vi.fn().mockReturnValue(chain),
        };
      }
      if (table === "managed_users") {
        const chain: any = {
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        chain.in = vi.fn().mockReturnValue(chain);
        return {
          select: vi.fn().mockReturnValue(chain),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/sub-admin?tab=approvals"]}>
          <Routes>
            <Route path="/sub-admin" element={<SubAdminDashboard />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Samrik Sub-Admin must see Kavita Nair's request
    await waitFor(() => {
      expect(screen.getByText("Kavita Nair")).toBeInTheDocument();
      expect(screen.getByText("agent.samrik@test.com")).toBeInTheDocument();
      expect(screen.getByText("Kochi")).toBeInTheDocument();
      expect(screen.getByText("Kerala")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SCENARIO 7: Verify Main Admin can see both requests
  // =========================================================================
  it("Scenario 7: Main Admin can view all approval requests across all Sub-Admins", async () => {
    const samrikAgent = {
      id: "agent-samrik-1",
      full_name: "Kavita Nair",
      email: "agent.samrik@test.com",
      status: "pending",
      email_verified: true,
      sub_admin_id: mockSubAdminSamrik.id,
      created_at: new Date().toISOString(),
    };

    const navogizAgent = {
      id: "agent-navogiz-1",
      full_name: "Manish Joshi",
      email: "agent.navogiz@test.com",
      status: "pending",
      email_verified: true,
      sub_admin_id: mockSubAdminNavogiz.id,
      created_at: new Date().toISOString(),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "agent_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [samrikAgent, navogizAgent],
              error: null,
            }),
          }),
        };
      }
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [mockSubAdminSamrik, mockSubAdminNavogiz],
                error: null,
              }),
            }),
            order: vi.fn().mockResolvedValue({
              data: [mockSubAdminSamrik, mockSubAdminNavogiz],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminAgentManagement defaultTab="pending" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Main Admin sees BOTH Samrik's agent and Navogiz's agent in the pending queue
    await waitFor(() => {
      expect(screen.getByText("Kavita Nair")).toBeInTheDocument();
      expect(screen.getByText("Manish Joshi")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SCENARIO 8: Verify that invalid OTP does not generate any approval request
  // =========================================================================
  it("Scenario 8: invalid OTP does NOT transition status to pending or generate an approval request", async () => {
    vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "Verification code sent to your email",
      cooldownSeconds: 60,
      expiresInSeconds: 300,
    });

    // Mock verifyOtpRequest returning FAILURE
    vi.spyOn(otpClient, "verifyOtpRequest").mockResolvedValue({
      success: false,
      message: "Invalid verification code. Please check your 6-digit code.",
      error: "Invalid OTP",
    });

    const mockNotificationsInsert = vi.fn().mockResolvedValue({ error: null });
    const mockAgentProfilesUpsert = vi.fn().mockResolvedValue({ error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [mockSubAdminSamrik],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "notifications") {
        return { insert: mockNotificationsInsert };
      }
      if (table === "agent_profiles") {
        return { upsert: mockAgentProfilesUpsert };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    (supabase.auth.signUp as any).mockResolvedValue({
      data: {
        user: { id: "agent-invalid-otp", email: "bad.otp@test.com", identities: [{ id: "id-8" }] },
      },
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/register"]}>
          <Register />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp(mockSubAdminSamrik.organization_name, "i"))).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Rohan Das" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "bad.otp@test.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543213" } });
    fireEvent.change(screen.getByTestId("reg-sub-admin"), { target: { value: mockSubAdminSamrik.id } });
    fireEvent.change(screen.getByTestId("reg-state"), { target: { value: "Gujarat" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Surat" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "RohanPass#123" } });
    fireEvent.change(screen.getByLabelText(/Confirm Pass/i), { target: { value: "RohanPass#123" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(screen.getByText("Verify Your Email")).toBeInTheDocument();
    });

    // Enter wrong OTP
    const otpInput = document.querySelector("input") as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify OTP/i }));

    await waitFor(() => {
      // Must display error message
      expect(screen.getByText(/Invalid verification code/i)).toBeInTheDocument();
      // Must NOT upsert agent profile as 'pending'
      expect(mockAgentProfilesUpsert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
        })
      );
      // Must NOT insert any approval notification
      expect(mockNotificationsInsert).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SCENARIO 9: Verify duplicate submissions do not create duplicate agent records or approval requests
  // =========================================================================
  it("Scenario 9: duplicate verify clicks do NOT create duplicate approval requests", async () => {
    vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "Verification code sent to your email",
      cooldownSeconds: 60,
      expiresInSeconds: 300,
    });

    let resolveVerify: any;
    const delayedVerify = new Promise<{
      success: boolean;
      message: string;
    }>((resolve) => {
      resolveVerify = resolve;
    });

    const verifyOtpSpy = vi.spyOn(otpClient, "verifyOtpRequest").mockImplementation(() => delayedVerify as any);

    const mockNotificationsInsert = vi.fn().mockResolvedValue({ error: null });
    const mockAgentProfilesUpsert = vi.fn().mockResolvedValue({ error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === "is_active") {
                return {
                  order: vi.fn().mockResolvedValue({
                    data: [mockSubAdminSamrik],
                    error: null,
                  }),
                };
              }
              if (col === "id") {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockSubAdminSamrik,
                    error: null,
                  }),
                };
              }
              return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          }),
        };
      }
      if (table === "notifications") {
        return { insert: mockNotificationsInsert };
      }
      if (table === "agent_profiles") {
        return { upsert: mockAgentProfilesUpsert };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    (supabase.auth.signUp as any).mockResolvedValue({
      data: {
        user: { id: "agent-dup-test", email: "dup.agent@test.com", identities: [{ id: "id-9" }] },
      },
      error: null,
    });

    (supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: {
        user: { id: "agent-dup-test", email: "dup.agent@test.com" },
      },
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/register"]}>
          <Register />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp(mockSubAdminSamrik.organization_name, "i"))).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Vikas Sharma" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "dup.agent@test.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9876543214" } });
    fireEvent.change(screen.getByTestId("reg-sub-admin"), { target: { value: mockSubAdminSamrik.id } });
    fireEvent.change(screen.getByTestId("reg-state"), { target: { value: "Haryana" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Gurugram" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "VikasPass#123" } });
    fireEvent.change(screen.getByLabelText(/Confirm Pass/i), { target: { value: "VikasPass#123" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(screen.getByText("Verify Your Email")).toBeInTheDocument();
    });

    const otpInput = document.querySelector("input") as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: "112233" } });

    const verifyBtn = screen.getByRole("button", { name: /Verify OTP/i });
    // Click verify multiple times rapidly
    fireEvent.click(verifyBtn);
    fireEvent.click(verifyBtn);
    fireEvent.click(verifyBtn);

    // Resolve in-flight verification
    resolveVerify({
      success: true,
      message: "Email verified successfully!",
    });

    await waitFor(() => {
      // verifyOtpRequest should only be called once, protected by isVerifyingRef
      expect(verifyOtpSpy).toHaveBeenCalledTimes(1);
      // Notification must only be inserted once
      expect(mockNotificationsInsert).toHaveBeenCalledTimes(1);
    });
  });
});
