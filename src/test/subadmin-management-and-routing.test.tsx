import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Register from "../routes/register";
import SubAdminDashboard from "../routes/_authenticated/subadmin";
import Admin from "../routes/_authenticated/admin";
import Login from "../routes/auth";
import { supabase } from "../integrations/supabase/client";
import * as appDataHooks from "../hooks/use-app-data";
import * as agentDataHooks from "../hooks/use-agent-data";
import * as otpClient from "../lib/otp-client";
import * as subAdminClient from "../lib/subadmin-client";

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
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock Select component for jsdom compatibility
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, id, disabled }: any) => (
    <select
      id={id}
      aria-label={id || "Select"}
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
      data-testid={id}
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

describe("Dynamic Sub-Admin Management and Approval Routing System", () => {
  let queryClient: QueryClient;

  const mockSubAdminA = {
    id: "subadmin-1",
    full_name: "Rajesh Kumar",
    email: "rajesh@navogiz.org",
    mobile: "9876543210",
    organization_name: "Navogiz Foundation",
    designation: "State Director",
    avatar_url: null,
    is_active: true,
  };

  const mockSubAdminB = {
    id: "subadmin-2",
    full_name: "Pooja Sharma",
    email: "pooja@samrik.org",
    mobile: "9876543211",
    organization_name: "Samrik Welfare Trust",
    designation: "Regional Head",
    avatar_url: null,
    is_active: true,
  };

  const mockInactiveSubAdmin = {
    id: "subadmin-3",
    full_name: "Amit Verma",
    email: "amit@inactive.org",
    mobile: "9876543212",
    organization_name: "Old Partner Org",
    designation: "Coordinator",
    avatar_url: null,
    is_active: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [mockSubAdminA, mockSubAdminB], error: null }),
            }),
          }),
        };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });
  });

  // TEST 1: Agent Registration displays active Sub-Admins dynamically and excludes deactivated ones
  it("displays only active Sub-Admin organizations in Agent Registration and excludes deactivated accounts", async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [mockSubAdminA, mockSubAdminB], error: null }),
            }),
          }),
        };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify "Select Your Sub-Admin" select exists
    expect(screen.getByText(/Select Your Sub-Admin/i)).toBeInTheDocument();

    // Verify active Sub-Admin organizations are rendered
    await waitFor(() => {
      expect(screen.getByText(new RegExp(mockSubAdminA.organization_name, "i"))).toBeInTheDocument();
      expect(screen.getByText(new RegExp(mockSubAdminB.organization_name, "i"))).toBeInTheDocument();
    });

    // Deactivated Sub-Admin must NOT be present
    expect(screen.queryByText(new RegExp(mockInactiveSubAdmin.organization_name, "i"))).not.toBeInTheDocument();
  });

  // TEST 2: Agent Registration blocks submission when no active Sub-Admin exists
  it("shows a warning and disables registration if no active Sub-Admins exist", async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify warning message is displayed
    await waitFor(() => {
      expect(screen.getByText(/No active Sub-Admin is currently available/i)).toBeInTheDocument();
    });

    // Submit button should be disabled
    const submitBtn = screen.getByRole("button", { name: /Create Account/i });
    expect(submitBtn).toBeDisabled();
  });

  // TEST 3: Selecting a Sub-Admin associates sub_admin_id during agent registration
  it("saves sub_admin_id when an agent registers under a selected organization", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "sub_admin_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [mockSubAdminA], error: null }),
            }),
          }),
        };
      }
      return {
        upsert: mockUpsert,
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    (supabase.auth.signUp as any).mockResolvedValue({
      data: { user: { id: "new-agent-999", email: "agent@test.com" } },
      error: null,
    });

    vi.spyOn(otpClient, "sendOtpRequest").mockResolvedValue({
      success: true,
      message: "OTP sent",
      cooldownSeconds: 60,
      expiresInSeconds: 300,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp(mockSubAdminA.organization_name, "i"))).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Suresh Patil" } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "suresh@patil.com" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "9823456789" } });
    fireEvent.change(screen.getByTestId("reg-sub-admin"), { target: { value: mockSubAdminA.id } });
    fireEvent.change(screen.getByTestId("reg-state"), { target: { value: "Maharashtra" } });
    fireEvent.change(screen.getByLabelText(/District/i), { target: { value: "Pune" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText(/Confirm Pass/i), { target: { value: "password123" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            data: expect.objectContaining({
              sub_admin_id: mockSubAdminA.id,
            }),
          }),
        })
      );
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        sub_admin_id: mockSubAdminA.id,
        status: "unverified",
      })
    );
  });

  // TEST 4: Sub-Admin Dashboard displays only assigned agents and isolated metrics
  it("isolates agents and pending approvals to the logged-in Sub-Admin's organization", async () => {
    vi.spyOn(appDataHooks, "useUser").mockReturnValue({
      data: { id: mockSubAdminA.id, email: mockSubAdminA.email },
    } as any);

    vi.spyOn(appDataHooks, "useIsSubAdmin").mockReturnValue({
      data: true,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSubAdminProfile").mockReturnValue({
      data: mockSubAdminA,
      isLoading: false,
    } as any);

    // Agent 1 assigned to Sub-Admin A (pending)
    // Agent 2 assigned to Sub-Admin A (approved)
    const myAgents = [
      {
        id: "agent-1",
        full_name: "Agent Under SubAdmin A",
        email: "a1@test.com",
        mobile: "9123456780",
        agency_name: "Navogiz Pune Agency",
        district: "Pune",
        state: "Maharashtra",
        status: "pending",
        sub_admin_id: mockSubAdminA.id,
        created_at: new Date().toISOString(),
      },
      {
        id: "agent-2",
        full_name: "Approved Agent A",
        email: "a2@test.com",
        mobile: "9123456781",
        agency_name: "Navogiz Mumbai Agency",
        district: "Mumbai",
        state: "Maharashtra",
        status: "approved",
        sub_admin_id: mockSubAdminA.id,
        created_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(agentDataHooks, "useSubAdminAgents").mockReturnValue({
      data: myAgents,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(agentDataHooks, "useNotifications").mockReturnValue({
      data: [],
      refetch: vi.fn(),
    } as any);

    vi.spyOn(agentDataHooks, "useSubAdminApprovalHistory").mockReturnValue({
      data: [],
    } as any);

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/sub-admin?tab=overview"]}>
          <Routes>
            <Route path="/sub-admin" element={<SubAdminDashboard />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify Organization Header
    expect(screen.getByText(mockSubAdminA.organization_name)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockSubAdminA.full_name, "i"))).toBeInTheDocument();

    // Verify Metrics for this Sub-Admin
    expect(screen.getByText("Agent Under SubAdmin A")).toBeInTheDocument();
  });

  // TEST 5: Sub-Admin can approve an agent and write to agent_approval_history
  it("allows Sub-Admin to approve a pending agent and records reviewed_by in database", async () => {
    vi.spyOn(appDataHooks, "useUser").mockReturnValue({
      data: { id: mockSubAdminA.id, email: mockSubAdminA.email },
    } as any);
    vi.spyOn(appDataHooks, "useIsSubAdmin").mockReturnValue({ data: true, isLoading: false } as any);
    vi.spyOn(appDataHooks, "useSubAdminProfile").mockReturnValue({ data: mockSubAdminA, isLoading: false } as any);

    const pendingAgent = {
      id: "agent-pending-1",
      full_name: "Pending Ramesh",
      email: "ramesh@agency.org",
      mobile: "9123456782",
      agency_name: "Citizen Help Agency",
      district: "Nashik",
      state: "Maharashtra",
      status: "pending",
      sub_admin_id: mockSubAdminA.id,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(agentDataHooks, "useSubAdminAgents").mockReturnValue({
      data: [pendingAgent],
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "agent_profiles") {
        return { update: mockUpdate };
      }
      if (table === "agent_approval_history") {
        return { insert: mockInsert };
      }
      return {
        select: vi.fn().mockReturnValue({
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

    expect(screen.getByText("Pending Ramesh")).toBeInTheDocument();

    // Click Approve button
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    fireEvent.click(approveBtn);

    // Confirm in dialog
    const confirmBtn = screen.getByRole("button", { name: "Approve Agent" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "approved",
          reviewed_by: mockSubAdminA.id,
        })
      );
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: pendingAgent.id,
        sub_admin_id: mockSubAdminA.id,
        action: "approved",
        actioned_by: mockSubAdminA.id,
      })
    );
  });

  // TEST 6: Main Admin Dashboard displays Sub-Admin Management and allows agent reassignment
  it("Main Admin can view Sub-Admin accounts and reassign agents across organizations", async () => {
    vi.spyOn(appDataHooks, "useIsAdmin").mockReturnValue({ data: true, isLoading: false } as any);
    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({ data: [] } as any);
    vi.spyOn(agentDataHooks, "useAllAgentProfiles").mockReturnValue({
      data: [
        {
          id: "agent-cross-1",
          full_name: "Agent To Reassign",
          email: "agent.cross@test.com",
          mobile: "9988776655",
          agency_name: "Cross Agency",
          district: "Nagpur",
          state: "Maharashtra",
          status: "approved",
          sub_admin_id: mockSubAdminA.id,
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(agentDataHooks, "useAllSubAdmins").mockReturnValue({
      data: [mockSubAdminA, mockSubAdminB],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin?tab=subadmins"]}>
          <Routes>
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify Sub-Admin Management tab is active and shows Sub-Admins
    expect(screen.getByText(mockSubAdminA.organization_name)).toBeInTheDocument();
    expect(screen.getByText(mockSubAdminB.organization_name)).toBeInTheDocument();
    expect(screen.getByTestId("create-subadmin-button")).toBeInTheDocument();
  });

  // TEST 7: Sub-Admin can log in directly with assigned email and password without OTP verification
  it("Sub-Admin can log in directly with email and password without OTP verification and is redirected to /sub-admin", async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: { user: { id: mockSubAdminA.id, email: mockSubAdminA.email } },
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
                data: mockSubAdminA,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/auth"]}>
          <Routes>
            <Route path="/auth" element={<Login />} />
            <Route path="/sub-admin" element={<div data-testid="sub-admin-dashboard">Sub-Admin Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: mockSubAdminA.email } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /^Login$/i }));

    // Verify Sub-Admin is immediately redirected to /sub-admin without ANY OTP or verification step
    await waitFor(() => {
      expect(screen.getByTestId("sub-admin-dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Verify Your Email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Verification code/i)).not.toBeInTheDocument();
  });

  // TEST 8: Handles unconfirmed email for Sub-Admin by auto-confirming and proceeding without OTP
  it("Sub-Admin login handles unconfirmed email by calling confirm_sub_admin_email and logging in without OTP", async () => {
    (supabase.auth.signInWithPassword as any)
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Email not confirmed" },
      })
      .mockResolvedValueOnce({
        data: { user: { id: mockSubAdminA.id, email: mockSubAdminA.email } },
        error: null,
      });

    (supabase.rpc as any).mockResolvedValue({ data: true, error: null });

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
                data: mockSubAdminA,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/auth"]}>
          <Routes>
            <Route path="/auth" element={<Login />} />
            <Route path="/sub-admin" element={<div data-testid="sub-admin-dashboard">Sub-Admin Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: mockSubAdminA.email } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /^Login$/i }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("confirm_sub_admin_email", {
        _email: mockSubAdminA.email.toLowerCase(),
      });
      expect(screen.getByTestId("sub-admin-dashboard")).toBeInTheDocument();
    });
  });

  // TEST 9: Deactivated Sub-Admin account is blocked from login and dashboard access
  it("Deactivated Sub-Admin account is blocked from login and dashboard access", async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: { user: { id: mockInactiveSubAdmin.id, email: mockInactiveSubAdmin.email } },
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
                data: mockInactiveSubAdmin,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/auth"]}>
          <Routes>
            <Route path="/auth" element={<Login />} />
            <Route path="/sub-admin" element={<div data-testid="sub-admin-dashboard">Sub-Admin Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: mockInactiveSubAdmin.email } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /^Login$/i }));

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(screen.queryByTestId("sub-admin-dashboard")).not.toBeInTheDocument();
    });
  });
});
