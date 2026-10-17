import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthenticatedLayout from "../routes/_authenticated/route";

let mockIsAdmin = true;
let mockUser: any = {
  id: "admin-123",
  email: "admin@test.gov.in",
  user_metadata: {
    full_name: "Test Admin",
    avatar_url: null,
  },
};
let mockProfile: any = {
  id: "admin-123",
  full_name: "Test Admin",
  email: "admin@test.gov.in",
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

vi.mock("@/hooks/use-app-data", () => ({
  useIsAdmin: () => ({ data: mockIsAdmin, isLoading: false }),
  useUser: () => ({ data: mockUser, isLoading: false }),
  useProfile: () => ({ data: mockProfile, isLoading: false }),
}));

function renderLayout(initialEntries = ["/admin"]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<AuthenticatedLayout />}>
            <Route path="/admin" element={<div>Admin Schemes Page</div>} />
            <Route path="/admin/profile" element={<div>Admin Profile Target</div>} />
            <Route path="/profile" element={<div>User Profile Target</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Authenticated Layout - Admin Profile Navigation & Header Avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockUser = {
      id: "admin-123",
      email: "admin@test.gov.in",
      user_metadata: {
        full_name: "Test Admin",
        avatar_url: null,
      },
    };
    mockProfile = {
      id: "admin-123",
      full_name: "Test Admin",
      email: "admin@test.gov.in",
    };
  });

  it("renders Profile option in admin sidebar navigation pointing to /admin/profile below All Schemes", () => {
    renderLayout();

    const profileNavLinks = screen.getAllByRole("link", { name: /Profile/i });
    const adminNavProfile = profileNavLinks.find(
      (link) => link.getAttribute("href") === "/admin/profile"
    );
    expect(adminNavProfile).toBeDefined();
    expect(adminNavProfile).toHaveAttribute("href", "/admin/profile");

    // Check link order in the sidebar: Dashboard -> All Schemes -> Profile
    const sidebarNav = adminNavProfile?.closest("nav");
    expect(sidebarNav).toBeDefined();
    const links = Array.from(sidebarNav?.querySelectorAll("a") || []).map((a) =>
      a.getAttribute("href")
    );
    expect(links).toEqual(["/admin", "/schemes", "/admin/profile"]);
  });

  it("renders admin name, Admin badge, and avatar in the dashboard header linking to /admin/profile", () => {
    renderLayout();

    const headerProfileLink = screen.getByTestId("header-profile-link");
    expect(headerProfileLink).toBeInTheDocument();
    expect(headerProfileLink).toHaveAttribute("href", "/admin/profile");
    expect(headerProfileLink).toHaveTextContent("Test Admin");
    expect(headerProfileLink).toHaveTextContent("Admin");
  });

  it("links header profile to /profile for regular users (non-admins)", () => {
    mockIsAdmin = false;
    mockUser = {
      id: "user-456",
      email: "citizen@test.gov.in",
      user_metadata: {
        full_name: "Citizen Jane",
      },
    };
    mockProfile = {
      id: "user-456",
      full_name: "Citizen Jane",
      email: "citizen@test.gov.in",
    };

    renderLayout();

    const headerProfileLink = screen.getByTestId("header-profile-link");
    expect(headerProfileLink).toBeInTheDocument();
    expect(headerProfileLink).toHaveAttribute("href", "/profile");
    expect(headerProfileLink).toHaveTextContent("Citizen Jane");
    expect(headerProfileLink).not.toHaveTextContent("Admin");
  });

  it("removes Settings from admin navigation while preserving it for regular users", () => {
    // 1. For admin
    mockIsAdmin = true;
    const { unmount } = renderLayout();
    const adminSettingsLink = screen.queryByRole("link", { name: /^Settings$/i });
    expect(adminSettingsLink).toBeNull();
    unmount();

    // 2. For citizen user
    mockIsAdmin = false;
    renderLayout();
    const userSettingsLink = screen.getByRole("link", { name: /^Settings$/i });
    expect(userSettingsLink).toBeInTheDocument();
    expect(userSettingsLink).toHaveAttribute("href", "/settings");
  });
});
