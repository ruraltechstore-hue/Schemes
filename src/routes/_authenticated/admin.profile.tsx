import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  Camera,
  Trash2,
  Lock,
  User,
  Mail,
  Calendar,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  FileCheck2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin, useProfile, useUser } from "@/hooks/use-app-data";
import {
  formatAccountDate,
  getInitials,
  removeAdminAvatar,
  uploadAdminAvatar,
  validateAvatarFile,
} from "@/lib/profile-helpers";

export default AdminProfile;

function AdminProfile() {
  const qc = useQueryClient();
  const { data: user, isLoading: userLoading } = useUser();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  // Profile Edit State
  const [fullName, setFullName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Change Password State
  const [activeTab, setActiveTab] = useState("profile");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Current saved values
  const currentFullName = profile?.full_name || user?.user_metadata?.full_name || "";
  const currentAvatarUrl = user?.user_metadata?.avatar_url || (profile as any)?.avatar_url || null;
  const currentAvatarPath = user?.user_metadata?.avatar_path || null;
  const adminEmail = user?.email || profile?.email || "N/A";
  const initials = getInitials(fullName || currentFullName, adminEmail);
  const createdAtFormatted = formatAccountDate(user?.created_at || profile?.created_at);

  // Sync state when data loads or changes
  useEffect(() => {
    if (currentFullName) {
      setFullName(currentFullName);
    }
  }, [currentFullName]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setIsPhotoRemoved(false);
    toast.info("Image selected. Click 'Save Changes' to apply.");
  };

  // Handle remove photo
  const handleRemovePhoto = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsPhotoRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Reset profile edits to current server state
  const handleCancelProfile = () => {
    setFullName(currentFullName);
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsPhotoRemoved(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Save profile changes (full name & avatar)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error("Full name cannot be empty");
      return;
    }

    setIsSavingProfile(true);

    try {
      let finalAvatarUrl = currentAvatarUrl;
      let finalAvatarPath = currentAvatarPath;

      // 1. If photo was marked for removal
      if (isPhotoRemoved) {
        if (currentAvatarPath) {
          await removeAdminAvatar(currentAvatarPath);
        }
        finalAvatarUrl = null;
        finalAvatarPath = null;
      }
      // 2. If a new photo file was chosen
      else if (selectedFile) {
        // Upload to storage
        const { signedUrl, path } = await uploadAdminAvatar(user.id, selectedFile);
        // Clean up previous image file if it existed
        if (currentAvatarPath && currentAvatarPath !== path) {
          await removeAdminAvatar(currentAvatarPath);
        }
        finalAvatarUrl = signedUrl;
        finalAvatarPath = path;
      }

      // 3. Update Supabase Auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          avatar_url: finalAvatarUrl,
          avatar_path: finalAvatarPath,
        },
      });

      if (authError) throw authError;

      // 4. Update profiles table
      const profileUpdate: Record<string, any> = {
        full_name: trimmedName,
        updated_at: new Date().toISOString(),
      };
      if (finalAvatarUrl !== undefined) {
        profileUpdate.avatar_url = finalAvatarUrl;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);

      // If profiles update failed due to missing avatar_url column, retry without it
      if (profileError && profileError.message?.includes("avatar_url")) {
        delete profileUpdate.avatar_url;
        const { error: retryError } = await supabase
          .from("profiles")
          .update(profileUpdate)
          .eq("id", user.id);
        if (retryError) throw retryError;
      } else if (profileError) {
        throw profileError;
      }

      // 5. Invalidate TanStack query caches to refresh header immediately
      await qc.invalidateQueries({ queryKey: ["user"] });
      await qc.invalidateQueries({ queryKey: ["profile"] });

      setSelectedFile(null);
      setIsPhotoRemoved(false);
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";

      toast.success("Admin profile updated successfully");
    } catch (err: any) {
      console.error("Save profile error:", err);
      toast.error(err.message || "Failed to update admin profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Change password handler
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error("Please enter both password fields");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match. Please verify and try again.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Password changed successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Update password error:", err);
      toast.error(err.message || "Failed to change password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Loading state
  if (userLoading || adminLoading || profileLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading admin profile...</p>
      </div>
    );
  }

  // Security guard: Access Denied for non-admins
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center" data-testid="admin-access-denied">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Access Restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You do not have administrative privileges to access this profile. This page is
          strictly reserved for authenticated administrators.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="default">
            <Link to="/dashboard">Go to Citizen Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Active avatar display source
  const effectiveAvatar = isPhotoRemoved
    ? null
    : previewUrl || currentAvatarUrl;

  const hasUnsavedProfileChanges =
    fullName.trim() !== currentFullName.trim() ||
    selectedFile !== null ||
    isPhotoRemoved;

  return (
    <div className="space-y-6" data-testid="admin-profile-page">
      <PageHeader
        title="Admin Profile"
        subtitle="Manage your administrator account details, profile photo, and password security."
        action={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4" />
              Back to Schemes Dashboard
            </Link>
          </Button>
        }
      />

      {/* Admin Profile Overview Banner */}
      <Card className="overflow-hidden border shadow-sm">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-md ring-4 ring-background">
                  {effectiveAvatar && (
                    <AvatarImage
                      src={effectiveAvatar}
                      alt={fullName || currentFullName}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-primary text-xl font-bold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div
                  className="absolute bottom-0 right-0 rounded-full bg-background p-1 shadow-sm ring-1 ring-border"
                  title="Administrator Account"
                >
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-2xl font-bold tracking-tight">
                    {fullName || currentFullName || "Admin"}
                  </h1>
                  <Badge variant="default" className="gap-1 bg-primary text-xs font-semibold">
                    <ShieldCheck className="h-3 w-3" /> Admin
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground sm:justify-start">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {adminEmail}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Member since {createdAtFormatted}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Authenticated via Supabase
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Tabbed Management Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger
            value="profile"
            onClick={() => setActiveTab("profile")}
            data-testid="tab-profile"
            className="gap-2"
          >
            <User className="h-4 w-4" />
            Edit Profile
          </TabsTrigger>
          <TabsTrigger
            value="security"
            onClick={() => setActiveTab("security")}
            data-testid="tab-security"
            className="gap-2"
          >
            <KeyRound className="h-4 w-4" />
            Change Password
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Edit Profile */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
              <CardDescription>
                Update your administrator display name and profile picture.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveProfile}>
              <CardContent className="space-y-6">
                {/* Profile Photo Uploader */}
                <div className="space-y-3">
                  <Label>Profile Photo</Label>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Avatar className="h-20 w-20 border shadow-sm">
                      {effectiveAvatar && (
                        <AvatarImage
                          src={effectiveAvatar}
                          alt="Avatar Preview"
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback className="bg-muted text-base font-semibold text-muted-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-1.5"
                        >
                          <Camera className="h-4 w-4" />
                          Choose Photo
                        </Button>

                        {(effectiveAvatar || selectedFile) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemovePhoto}
                            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Supports JPG, JPEG, and PNG. Maximum size 5 MB.
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handleFileChange}
                      className="hidden"
                      aria-label="Upload admin profile photo"
                    />
                  </div>
                </div>

                {/* Full Name & Email Input Fields */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin-full-name">Full Name</Label>
                    <Input
                      id="admin-full-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Test Admin"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email Address</Label>
                    <Input
                      id="admin-email"
                      value={adminEmail}
                      disabled
                      className="cursor-not-allowed bg-muted text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email address is managed by Supabase Authentication.
                    </p>
                  </div>
                </div>

                {/* Account Metadata Quick View */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">Role:</span>
                      <span className="font-medium">Administrator</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Account Created:</span>
                      <span className="font-medium">{createdAtFormatted}</span>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/10 py-4">
                <span className="text-xs text-muted-foreground">
                  {hasUnsavedProfileChanges
                    ? "You have unsaved changes."
                    : "All details are saved."}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancelProfile}
                    disabled={isSavingProfile || !hasUnsavedProfileChanges}
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingProfile || !hasUnsavedProfileChanges}
                    className="gap-1.5"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Tab 2: Change Password */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Ensure your administrator account stays secure with a strong password.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdatePassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 6 characters)"
                      minLength={6}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7 text-muted-foreground"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      minLength={6}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7 text-muted-foreground"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {newPassword && confirmPassword && (
                  <div
                    className={`flex items-center gap-2 rounded-md p-2.5 text-xs ${
                      newPassword === confirmPassword
                        ? "bg-green-500/10 text-green-700 dark:text-green-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {newPassword === confirmPassword ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Passwords match.</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Passwords do not match yet.</span>
                      </>
                    )}
                  </div>
                )}

                <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Password requirements:</p>
                  <ul className="mt-1.5 list-inside list-disc space-y-1">
                    <li>Minimum 6 characters long</li>
                    <li>Securely hashed and updated via Supabase Auth</li>
                    <li>Never stored or displayed in plain text</li>
                  </ul>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end gap-2 border-t bg-muted/10 py-4">
                <Button
                  type="submit"
                  disabled={
                    isUpdatingPassword ||
                    !newPassword ||
                    !confirmPassword ||
                    newPassword !== confirmPassword
                  }
                  className="gap-1.5"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Update Password
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
