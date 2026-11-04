import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  UploadCloud,
  Search,
  CheckCircle,
  Pencil,
  Trash2,
  BadgeCheck,
  FileText,
  Filter,
  X,
  RotateCw,
  Building2,
  Calendar,
  Save,
  Eye,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useManagedUsers, useUser } from "@/hooks/use-app-data";
import { CASTE_CATEGORIES, GENDERS, OCCUPATIONS, STATES } from "@/lib/constants";

export default function AllUsers() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: users = [], isLoading, refetch } = useManagedUsers();
  const { data: currentUser } = useUser();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState("All");
  const [selectedDistrict, setSelectedDistrict] = useState("All");
  const [selectedGender, setSelectedGender] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedArea, setSelectedArea] = useState("All");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit User State
  const [editUser, setEditUser] = useState<any | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Delete User State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Derived list of districts based on selectedState
  const availableDistricts = Array.from(
    new Set(
      users
        .filter((u) => selectedState === "All" || u.state === selectedState)
        .map((u) => u.district)
        .filter(Boolean)
    )
  ).sort();

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.mobile?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.district?.toLowerCase().includes(q) ||
      u.state?.toLowerCase().includes(q) ||
      u.occupation?.toLowerCase().includes(q);

    const matchesState = selectedState === "All" || u.state === selectedState;
    const matchesDistrict =
      selectedDistrict === "All" ||
      (u.district || "").toLowerCase() === selectedDistrict.toLowerCase();
    const matchesGender = selectedGender === "All" || u.gender === selectedGender;
    const matchesCategory = selectedCategory === "All" || u.category === selectedCategory;
    const matchesArea = selectedArea === "All" || u.area === selectedArea;

    return matchesSearch && matchesState && matchesDistrict && matchesGender && matchesCategory && matchesArea;
  });

  const allDisplayedSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u.id));

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    const next = new Set(selectedIds);
    if (checked) {
      filteredUsers.forEach((u) => next.add(u.id));
    } else {
      filteredUsers.forEach((u) => next.delete(u.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectUser = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const openEditDialog = (u: any) => {
    setEditUser({ ...u });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("managed_users")
        .update({
          full_name: editUser.full_name?.trim(),
          dob: editUser.dob || null,
          age: editUser.age ? parseInt(String(editUser.age), 10) : null,
          gender: editUser.gender,
          mobile: editUser.mobile?.trim() || null,
          email: editUser.email?.trim().toLowerCase() || null,
          state: editUser.state,
          district: editUser.district?.trim(),
          area: editUser.area || "Rural",
          annual_income: editUser.annual_income ? parseFloat(String(editUser.annual_income)) : 0,
          occupation: editUser.occupation || null,
          education: editUser.education || null,
          category: editUser.category || "General",
          has_disability: editUser.has_disability,
          disability_percentage: editUser.disability_percentage ? parseInt(String(editUser.disability_percentage), 10) : null,
          is_farmer: editUser.is_farmer,
          is_student: editUser.is_student,
          marital_status: editUser.marital_status || null,
          family_size: editUser.family_size ? parseInt(String(editUser.family_size), 10) : 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editUser.id);

      if (error) throw error;

      toast.success("Beneficiary updated successfully");
      setIsEditOpen(false);
      qc.invalidateQueries({ queryKey: ["managedUsers"] });
    } catch (err: any) {
      toast.error("Failed to update beneficiary: " + (err.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("managed_users")
        .delete()
        .eq("id", deleteTargetId);

      if (error) throw error;

      toast.success("Beneficiary profile deleted");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTargetId);
        return next;
      });
      setIsDeleteDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["managedUsers"] });
    } catch (err: any) {
      toast.error("Failed to delete beneficiary: " + (err.message || "Unknown error"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCheckSelected = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds).join(",");
    navigate(`/eligible?userIds=${ids}`);
  };

  const handleCheckAll = () => {
    navigate(`/eligible?target=all`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Managed Beneficiaries</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} {users.length === 1 ? "citizen" : "citizens"} registered under your agency account
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={handleCheckSelected}
            >
              <CheckCircle className="h-4 w-4" />
              Check Eligibility ({selectedIds.size})
            </Button>
          )}
          {users.length > 0 && (
            <Button variant="outline" onClick={handleCheckAll} className="gap-1.5">
              <BadgeCheck className="h-4 w-4" />
              Check All ({users.length})
            </Button>
          )}
          <Button asChild className="gap-1.5">
            <Link to="/users/new">
              <UserPlus className="h-4 w-4" />
              Add Beneficiary
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, mobile, district, occupation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={selectedState}
          onValueChange={(val) => {
            setSelectedState(val);
            setSelectedDistrict("All");
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All States</SelectItem>
            {STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Districts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Districts</SelectItem>
            {availableDistricts.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedGender} onValueChange={setSelectedGender}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Genders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Genders</SelectItem>
            {GENDERS.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {CASTE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedArea} onValueChange={setSelectedArea}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Areas</SelectItem>
            <SelectItem value="Rural">Rural</SelectItem>
            <SelectItem value="Urban">Urban</SelectItem>
          </SelectContent>
        </Select>

        {(searchTerm || selectedState !== "All" || selectedDistrict !== "All" || selectedGender !== "All" || selectedCategory !== "All" || selectedArea !== "All") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setSelectedState("All");
              setSelectedDistrict("All");
              setSelectedGender("All");
              setSelectedCategory("All");
              setSelectedArea("All");
            }}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Selected Action Banner */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2 text-primary font-medium">
            <span>{selectedIds.size} beneficiaries selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleCheckSelected} className="gap-1.5 h-8">
              <CheckCircle className="h-3.5 w-3.5" />
              Check Eligibility
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 text-xs">
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* Beneficiaries Table */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <RotateCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
          Loading beneficiaries...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center shadow-card">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-3 text-lg font-semibold text-foreground">
            {users.length === 0 ? "No Beneficiaries Registered Yet" : "No Matching Beneficiaries Found"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            {users.length === 0
              ? "Start adding citizen profiles to manage records, upload documents, and check scheme eligibility."
              : "Try adjusting your search query or filters to find registered beneficiaries."}
          </p>
          {users.length === 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/users/new">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First Beneficiary
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={allDisplayedSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3">User Name</th>
                  <th className="px-4 py-3">Mobile Number</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3">Gender</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Date Added</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => {
                  const isChecked = selectedIds.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isChecked ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelectUser(u.id)}
                          aria-label={`Select ${u.full_name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/agent/users/${u.id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors hover:underline block"
                        >
                          {u.full_name}
                        </Link>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-muted">
                            {u.category || "General"}
                          </span>
                          {u.occupation && (
                            <span>• {u.occupation}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {u.mobile ? (
                          <span className="font-mono text-xs">{u.mobile}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {u.age != null ? `${u.age} yrs` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {u.gender || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {u.state || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {u.district || "—"}
                        <span className="text-xs text-muted-foreground block">
                          {u.area || "Rural"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="h-8 px-2.5 bg-primary text-primary-foreground hover:bg-primary/90 gap-1 text-xs font-medium shadow-xs"
                            onClick={() => navigate(`/agent/users/${u.id}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            title="Check Scheme Eligibility"
                            onClick={() => navigate(`/agent/users/${u.id}?check=1`)}
                          >
                            <BadgeCheck className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Edit Beneficiary"
                            onClick={() => openEditDialog(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            title="Delete Beneficiary"
                            onClick={() => openDeleteDialog(u.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Beneficiary Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Beneficiary Details</DialogTitle>
          </DialogHeader>
          {editUser && (
            <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit_name">Full Name *</Label>
                  <Input
                    id="edit_name"
                    required
                    value={editUser.full_name || ""}
                    onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_gender">Gender *</Label>
                  <Select
                    value={editUser.gender || ""}
                    onValueChange={(v) => setEditUser({ ...editUser, gender: v })}
                  >
                    <SelectTrigger id="edit_gender">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="edit_dob">Date of Birth</Label>
                  <Input
                    id="edit_dob"
                    type="date"
                    value={editUser.dob || ""}
                    onChange={(e) => setEditUser({ ...editUser, dob: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_age">Age</Label>
                  <Input
                    id="edit_age"
                    type="number"
                    value={editUser.age ?? ""}
                    onChange={(e) => setEditUser({ ...editUser, age: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_mobile">Mobile Number</Label>
                  <Input
                    id="edit_mobile"
                    maxLength={10}
                    value={editUser.mobile || ""}
                    onChange={(e) => setEditUser({ ...editUser, mobile: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="edit_state">State *</Label>
                  <Select
                    value={editUser.state || ""}
                    onValueChange={(v) => setEditUser({ ...editUser, state: v })}
                  >
                    <SelectTrigger id="edit_state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_district">District *</Label>
                  <Input
                    id="edit_district"
                    required
                    value={editUser.district || ""}
                    onChange={(e) => setEditUser({ ...editUser, district: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_area">Area (Rural/Urban)</Label>
                  <Select
                    value={editUser.area || "Rural"}
                    onValueChange={(v) => setEditUser({ ...editUser, area: v })}
                  >
                    <SelectTrigger id="edit_area">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rural">Rural</SelectItem>
                      <SelectItem value="Urban">Urban</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="edit_income">Annual Income (₹)</Label>
                  <Input
                    id="edit_income"
                    type="number"
                    value={editUser.annual_income ?? ""}
                    onChange={(e) => setEditUser({ ...editUser, annual_income: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_category">Social Category</Label>
                  <Select
                    value={editUser.category || "General"}
                    onValueChange={(v) => setEditUser({ ...editUser, category: v })}
                  >
                    <SelectTrigger id="edit_category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CASTE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_occupation">Occupation</Label>
                  <Select
                    value={editUser.occupation || ""}
                    onValueChange={(v) => setEditUser({ ...editUser, occupation: v })}
                  >
                    <SelectTrigger id="edit_occupation">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {OCCUPATIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="flex items-center justify-between border rounded p-2.5">
                  <span className="text-xs font-medium">Farmer</span>
                  <Switch
                    checked={!!editUser.is_farmer}
                    onCheckedChange={(c) => setEditUser({ ...editUser, is_farmer: c })}
                  />
                </div>
                <div className="flex items-center justify-between border rounded p-2.5">
                  <span className="text-xs font-medium">Student</span>
                  <Switch
                    checked={!!editUser.is_student}
                    onCheckedChange={(c) => setEditUser({ ...editUser, is_student: c })}
                  />
                </div>
                <div className="flex items-center justify-between border rounded p-2.5">
                  <span className="text-xs font-medium">Disability</span>
                  <Switch
                    checked={!!editUser.has_disability}
                    onCheckedChange={(c) => setEditUser({ ...editUser, has_disability: c })}
                  />
                </div>
              </div>

              {editUser.has_disability && (
                <div>
                  <Label htmlFor="edit_disability_p">Disability Percentage (%)</Label>
                  <Input
                    id="edit_disability_p"
                    type="number"
                    min="1"
                    max="100"
                    value={editUser.disability_percentage ?? ""}
                    onChange={(e) =>
                      setEditUser({ ...editUser, disability_percentage: e.target.value })
                    }
                  />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="gap-1.5">
                  {isSaving ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Beneficiary Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this beneficiary's details and any matched scheme records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? "Deleting..." : "Delete Beneficiary"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
