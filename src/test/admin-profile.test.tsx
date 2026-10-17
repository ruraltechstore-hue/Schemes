import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminProfile from "../routes/_authenticated/admin.profile";
import { supabase } from "../integrations/supabase/client";
import {
  getInitials,
  validateAvatarFile,
  formatAccountDate,
} from "../lib/profile-helpers";

// Mock Supabase
const mockUpdateUser = vi.fn();
const mockProfilesUpdate = vi.fn();
const mockProfilesEq = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();
const mockStorageRemove = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      updateUser: (...args: any[]) => mockUpdateUser(...args),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          update: mockProfilesUpdate.mockReturnValue({
            eq: mockProfilesEq,
          }),
        };
      }
      return {};
    }),
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        createSignedUrl: mockStorageCreateSignedUrl,
        remove: mockStorageRemove,
      })),
    },
  },
}));

// Default mock hook returns
let mockIsAdmin = true;
let mockIsAdminLoading = false;
let mockUser = {
  id: "admin-123",
  email: "admin@test.gov.in",
  created_at: "2026-10-09T10:00:00Z",
  user_metadata: {
    full_name: "Test Admin",
    avatar_url: null,
    avatar_path: null,
  },
};
let mockProfile = {
  id: "admin-123",
  full_name: "Test Admin",
  email: "admin@test.gov.in",
  created_at: "2026-10-09T10:00:00Z",
  updated_at: "2026-10-09T10:00:00Z",
  avatar_url: null,
};

vi.mock("@/hooks/use-app-data", () => ({
  useIsAdmin: () => ({ data: mockIsAdmin, isLoading: mockIsAdminLoading }),
  useUser: () => ({ data: mockUser, isLoading: false }),
  useProfile: () => ({ data: mockProfile, isLoading: false }),
}));

function renderComponent() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminProfile />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Admin Profile - Unit & Helper Tests", () => {
  it("getInitials formats single name, multi-word name, and email correctly", () => {
    expect(getInitials("Rahul Sharma")).toBe("RS");
    expect(getInitials("Administrator")).toBe("AD");
    expect(getInitials("", "officer@gov.in")).toBe("OF");
    expect(getInitials(null, null)).toBe("AD");
  });

  it("validateAvatarFile validates image mime types and maximum 5MB size", () => {
    const validJpg = new File(["dummy"], "avatar.jpg", { type: "image/jpeg" });
    expect(validateAvatarFile(validJpg).valid).toBe(true);

    const validPng = new File(["dummy"], "avatar.png", { type: "image/png" });
    expect(validateAvatarFile(validPng).valid).toBe(true);

    const invalidPdf = new File(["dummy"], "document.pdf", { type: "application/pdf" });
    const pdfRes = validateAvatarFile(invalidPdf);
    expect(pdfRes.valid).toBe(false);
    expect(pdfRes.error).toContain("Only JPG and PNG");

    // Oversized file > 5MB
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" });
    const sizeRes = validateAvatarFile(bigFile);
    expect(sizeRes.valid).toBe(false);
    expect(sizeRes.error).toContain("Maximum allowed size is 5 MB");
  });

  it("formatAccountDate formats ISO date strings accurately", () => {
    const formatted = formatAccountDate("2026-10-09T10:00:00Z");
    expect(formatted).toBe("October 9, 2026");
    expect(formatAccountDate(null)).toBe("Not available");
    expect(formatAccountDate("invalid-date")).toBe("Not available");
  });
});

describe("Admin Profile - UI & Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockIsAdminLoading = false;
    mockUser = {
      id: "admin-123",
      email: "admin@test.gov.in",
      created_at: "2026-10-09T10:00:00Z",
      user_metadata: {
        full_name: "Test Admin",
        avatar_url: null,
        avatar_path: null,
      },
    };
    mockProfile = {
      id: "admin-123",
      full_name: "Test Admin",
      email: "admin@test.gov.in",
      created_at: "2026-10-09T10:00:00Z",
      updated_at: "2026-10-09T10:00:00Z",
      avatar_url: null,
    };
    mockProfilesEq.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ data: { user: mockUser }, error: null });
  });

  it("denies access to non-admin users", () => {
    mockIsAdmin = false;
    renderComponent();

    expect(screen.getByTestId("admin-access-denied")).toBeInTheDocument();
    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    expect(screen.getByText("Go to Citizen Dashboard")).toBeInTheDocument();
  });

  it("displays admin details including full name, email, admin role, and creation date", () => {
    renderComponent();

    expect(screen.getByTestId("admin-profile-page")).toBeInTheDocument();
    expect(screen.getAllByText("Test Admin").length).toBeGreaterThan(0);
    expect(screen.getByText("admin@test.gov.in")).toBeInTheDocument();
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.getByText(/Member since October 9, 2026/)).toBeInTheDocument();
  });

  it("allows admin to edit their full name and save changes", async () => {
    renderComponent();

    const nameInput = screen.getByLabelText("Full Name");
    expect(nameInput).toHaveValue("Test Admin");

    fireEvent.change(nameInput, { target: { value: "Super Administrator" } });
    expect(nameInput).toHaveValue("Super Administrator");
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: /Save Changes/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({
          full_name: "Super Administrator",
        }),
      });
      expect(mockProfilesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "Super Administrator",
        })
      );
    });
  });

  it("allows admin to cancel edits and resets form back to initial state", () => {
    renderComponent();

    const nameInput = screen.getByLabelText("Full Name");
    fireEvent.change(nameInput, { target: { value: "Changed Name" } });
    expect(nameInput).toHaveValue("Changed Name");

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(nameInput).toHaveValue("Test Admin");
    expect(screen.getByText("All details are saved.")).toBeInTheDocument();
  });

  it("handles photo file upload and saves signed URL to user profile", async () => {
    mockStorageUpload.mockResolvedValue({ data: { path: "admin-123/avatars/avatar-1.jpg" }, error: null });
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/avatar-signed.jpg" },
      error: null,
    });

    renderComponent();

    const fileInput = screen.getByLabelText("Upload admin profile photo");
    const testFile = new File(["image-binary"], "new-avatar.jpg", { type: "image/jpeg" });

    // Mock URL.createObjectURL and revokeObjectURL
    const originalCreateObjectUrl = window.URL.createObjectURL;
    const originalRevokeObjectUrl = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/fake-blob");
    window.URL.revokeObjectURL = vi.fn();

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockStorageUpload).toHaveBeenCalled();
      expect(mockStorageCreateSignedUrl).toHaveBeenCalled();
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({
          avatar_url: "https://example.com/avatar-signed.jpg",
        }),
      });
    });

    window.URL.createObjectURL = originalCreateObjectUrl;
    window.URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it("validates password change requirements and updates password via Supabase Auth", async () => {
    renderComponent();

    // Switch to Change Password tab
    const securityTab = screen.getByTestId("tab-security");
    fireEvent.click(securityTab);

    const newPasswordInput = screen.getByLabelText("New Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm New Password");
    const updateButton = screen.getByRole("button", { name: /Update Password/i });

    // Initially disabled because inputs are empty
    expect(updateButton).toBeDisabled();

    // Type mismatched passwords
    fireEvent.change(newPasswordInput, { target: { value: "secret123" } });
    fireEvent.change(confirmPasswordInput, { target: { value: "different123" } });

    expect(screen.getByText("Passwords do not match yet.")).toBeInTheDocument();
    expect(updateButton).toBeDisabled();

    // Type matching passwords
    fireEvent.change(confirmPasswordInput, { target: { value: "secret123" } });
    expect(screen.getByText("Passwords match.")).toBeInTheDocument();
    expect(updateButton).not.toBeDisabled();

    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "secret123",
      });
    });

    // Inputs should be cleared after success
    await waitFor(() => {
      expect(newPasswordInput).toHaveValue("");
      expect(confirmPasswordInput).toHaveValue("");
    });
  });
});
