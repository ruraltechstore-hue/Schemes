import { useState, useMemo, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  FileText,
  Printer,
  Download,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  Calendar,
  Sparkles,
  Search,
  Building,
  Video,
  FileCheck2,
  ArrowLeft,
  ChevronDown,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { useManagedUsers, useSchemes, useAllAgentSchemeMatches } from "@/hooks/use-app-data";
import { matchScheme, type ManagedUser, type Scheme } from "@/lib/matching";

export default function Reports() {
  const [searchParams] = useSearchParams();
  const initialUserId = searchParams.get("userId");

  const { data: users = [], isLoading: usersLoading } = useManagedUsers();
  const { data: schemes = [] } = useSchemes();
  const { data: storedMatches = [] } = useAllAgentSchemeMatches();

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"eligible" | "verification" | "ineligible">("eligible");

  useEffect(() => {
    if (initialUserId && users.some((u) => u.id === initialUserId)) {
      setSelectedUserId(initialUserId);
    } else if (users.length > 0 && !selectedUserId) {
      setSelectedUserId(users[0].id);
    }
  }, [users, initialUserId, selectedUserId]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId),
    [users, selectedUserId]
  );

  // Compute live match evaluations for the selected user against all schemes
  const evaluationResults = useMemo(() => {
    if (!selectedUser || schemes.length === 0) return [];

    return schemes.map((s) => {
      const match = matchScheme(s, selectedUser, []);
      return {
        scheme: s,
        status: match.status,
        eligible: match.eligible,
        percentage: match.percentage,
        reasons: match.reasons,
        missing: match.missing,
      };
    });
  }, [selectedUser, schemes]);

  const eligibleList = useMemo(
    () => evaluationResults.filter((r) => r.status === "eligible"),
    [evaluationResults]
  );
  const needsVerificationList = useMemo(
    () => evaluationResults.filter((r) => r.status === "needs_verification"),
    [evaluationResults]
  );
  const ineligibleList = useMemo(
    () => evaluationResults.filter((r) => r.status === "ineligible"),
    [evaluationResults]
  );

  // Helper to extract YouTube video ID if URL is present
  const getYouTubeEmbedUrl = (url?: string | null) => {
    if (!url) return null;
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
    } catch {
      return null;
    }
  };

  // Export Individual User Report CSV
  const exportIndividualCSV = () => {
    if (!selectedUser) return;
    const rows = [
      ["Beneficiary Name", selectedUser.full_name],
      ["Mobile", selectedUser.mobile || "N/A"],
      ["Gender", selectedUser.gender || "N/A"],
      ["Age", selectedUser.age?.toString() || "N/A"],
      ["State", selectedUser.state || "N/A"],
      ["District", selectedUser.district || "N/A"],
      ["Category", selectedUser.category || "General"],
      ["Annual Income", selectedUser.annual_income != null ? `INR ${selectedUser.annual_income}` : "N/A"],
      ["Total Schemes Evaluated", evaluationResults.length.toString()],
      ["Eligible Schemes", eligibleList.length.toString()],
      ["Needs Verification", needsVerificationList.length.toString()],
      ["Ineligible Schemes", ineligibleList.length.toString()],
      ["Report Date", new Date().toLocaleString()],
      [],
      ["Scheme Name", "Ministry", "Status", "Match %", "Benefits", "Required Documents", "Application Deadline", "Official URL"]
    ];

    evaluationResults.forEach((r) => {
      rows.push([
        r.scheme.name,
        r.scheme.ministry || "Central Govt",
        r.status.toUpperCase(),
        `${r.percentage}%`,
        `"${(r.scheme.benefits || "").replace(/"/g, '""')}"`,
        `"${(r.scheme.required_documents || []).join(", ").replace(/"/g, '""')}"`,
        r.scheme.application_deadline ? new Date(r.scheme.application_deadline).toLocaleDateString() : "Open",
        r.scheme.official_website_url || "N/A"
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Scheme_Report_${selectedUser.full_name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Consolidated Report for ALL Users CSV
  const exportConsolidatedCSV = () => {
    if (users.length === 0) return;

    const rows = [
      [
        "Beneficiary ID",
        "Full Name",
        "Mobile",
        "Age",
        "Gender",
        "State",
        "District",
        "Residence",
        "Category",
        "Annual Income",
        "Occupation",
        "Total Schemes Evaluated",
        "Eligible Count",
        "Needs Verification Count",
        "Ineligible Count",
        "Eligible Schemes List"
      ]
    ];

    users.forEach((u) => {
      const userMatches = schemes.map((s) => matchScheme(s, u, []));
      const el = userMatches.filter((m) => m.status === "eligible");
      const nv = userMatches.filter((m) => m.status === "needs_verification");
      const inel = userMatches.filter((m) => m.status === "ineligible");

      const eligibleSchemeNames = el.map((e) => e.scheme.name).join("; ");

      rows.push([
        u.id,
        `"${u.full_name}"`,
        u.mobile || "N/A",
        u.age?.toString() || "N/A",
        u.gender || "N/A",
        u.state || "N/A",
        u.district || "N/A",
        u.area || "N/A",
        u.category || "General",
        u.annual_income != null ? u.annual_income.toString() : "N/A",
        u.occupation || "N/A",
        schemes.length.toString(),
        el.length.toString(),
        nv.length.toString(),
        inel.length.toString(),
        `"${eligibleSchemeNames.replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Consolidated_Beneficiary_Schemes_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <PageHeader
          title="Beneficiary Eligibility Reports"
          subtitle="Generate in-depth scheme eligibility reports, printable dossiers, and consolidated spreadsheets."
        />
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={exportConsolidatedCSV} disabled={users.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Consolidated Report (CSV)
          </Button>
          {selectedUser && (
            <>
              <Button variant="outline" onClick={exportIndividualCSV}>
                <Download className="mr-2 h-4 w-4" /> Download User CSV
              </Button>
              <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* User Selection Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-card print:hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-80">
            <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">
              Select Beneficiary
            </label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a citizen beneficiary..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} ({u.district ? `${u.district}, ` : ""}{u.state || "India"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 text-xs text-muted-foreground">
            {selectedUser ? (
              <span>
                Viewing report for <b>{selectedUser.full_name}</b> • Phone: {selectedUser.mobile || "N/A"} • Category: {selectedUser.category || "General"}
              </span>
            ) : (
              <span>Please select a beneficiary to view detailed scheme eligibility report.</span>
            )}
          </div>

          <Button asChild variant="ghost" size="sm">
            <Link to="/users">
              <Users className="mr-1.5 h-4 w-4" /> All Users Directory
            </Link>
          </Button>
        </div>
      </div>

      {usersLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading reports data...</div>
      ) : !selectedUser ? (
        <div className="rounded-xl border border-dashed p-12 text-center bg-card">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No Beneficiaries Found</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            You have not registered any citizen beneficiaries yet. Add beneficiaries to generate scheme eligibility dossiers.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link to="/users/new">Add New Beneficiary</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Printable Report Header / Summary Dossier */}
          <div className="rounded-xl border bg-card p-6 shadow-card space-y-6">
            <div className="border-b pb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Official Scheme Assessment Dossier
                </span>
                <h2 className="text-2xl font-extrabold text-foreground mt-0.5">
                  {selectedUser.full_name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Assessment generated on {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>

              <div className="flex gap-2">
                <Badge className="bg-emerald-600 text-white text-xs px-3 py-1">
                  {eligibleList.length} Eligible
                </Badge>
                <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs px-3 py-1">
                  {needsVerificationList.length} Needs Verification
                </Badge>
                <Badge variant="outline" className="border-rose-400 text-rose-600 text-xs px-3 py-1">
                  {ineligibleList.length} Ineligible
                </Badge>
              </div>
            </div>

            {/* User Demographic Summary Grid */}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 bg-muted/30 p-4 rounded-lg text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Age & Gender</span>
                <span className="font-semibold text-foreground">
                  {selectedUser.age ? `${selectedUser.age} Years` : "N/A"}, {selectedUser.gender || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Location</span>
                <span className="font-semibold text-foreground">
                  {selectedUser.district ? `${selectedUser.district}, ` : ""}{selectedUser.state || "N/A"} ({selectedUser.area || "Rural"})
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Annual Family Income</span>
                <span className="font-semibold text-foreground">
                  {selectedUser.annual_income != null ? `₹${selectedUser.annual_income.toLocaleString("en-IN")}` : "Not Disclosed"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Category & Occupation</span>
                <span className="font-semibold text-foreground">
                  {selectedUser.category || "General"} • {selectedUser.occupation || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Mobile Number</span>
                <span className="font-semibold text-foreground">{selectedUser.mobile || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Email Address</span>
                <span className="font-semibold text-foreground">{selectedUser.email || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Disability Status</span>
                <span className="font-semibold text-foreground">
                  {selectedUser.has_disability ? "Yes (Persons with Disability)" : "No"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Total Schemes Checked</span>
                <span className="font-semibold text-foreground">{evaluationResults.length} Schemes</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation (Hidden during print) */}
          <div className="flex border-b text-sm font-medium gap-2 print:hidden">
            <button
              onClick={() => setActiveTab("eligible")}
              className={`pb-3 px-4 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
                activeTab === "eligible"
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" /> Eligible Schemes ({eligibleList.length})
            </button>
            <button
              onClick={() => setActiveTab("verification")}
              className={`pb-3 px-4 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
                activeTab === "verification"
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <HelpCircle className="h-4 w-4" /> Needs Additional Information ({needsVerificationList.length})
            </button>
            <button
              onClick={() => setActiveTab("ineligible")}
              className={`pb-3 px-4 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
                activeTab === "ineligible"
                  ? "border-rose-500 text-rose-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <XCircle className="h-4 w-4" /> Ineligible Schemes ({ineligibleList.length})
            </button>
          </div>

          {/* Scheme Cards Display */}
          <div className="space-y-6">
            {(activeTab === "eligible" || window.matchMedia?.("print")?.matches) && (
              <div className="space-y-4">
                <div className="hidden print:block font-bold text-lg text-emerald-700 border-b pb-1">
                  Eligible Government Schemes ({eligibleList.length})
                </div>

                {eligibleList.length === 0 ? (
                  <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                    No fully matching schemes found for current parameters.
                  </div>
                ) : (
                  eligibleList.map(({ scheme, percentage }) => {
                    const embedUrl = getYouTubeEmbedUrl(scheme.tutorial_video_url);
                    return (
                      <div
                        key={scheme.id}
                        className="rounded-xl border border-emerald-500/20 bg-card p-6 shadow-card space-y-4 break-inside-avoid"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-600 text-white">
                                {percentage}% Match Satisfied
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {scheme.ministry || "Central Govt"}
                              </Badge>
                              {scheme.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {scheme.category}
                                </Badge>
                              )}
                            </div>
                            <h3 className="mt-2 text-xl font-bold text-foreground">
                              {scheme.name}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {scheme.description}
                            </p>
                          </div>

                          <div className="text-right">
                            {scheme.application_deadline && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                <Calendar className="h-3.5 w-3.5" />
                                Deadline: {new Date(scheme.application_deadline).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Benefits Section */}
                        {scheme.benefits && (
                          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-4 border border-emerald-200 dark:border-emerald-900/30">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                              Scheme Benefits & Financial Assistance
                            </h4>
                            <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">
                              {scheme.benefits}
                            </p>
                          </div>
                        )}

                        {/* Application Process */}
                        {scheme.application_process && (
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Application Process
                            </h4>
                            <p className="text-sm text-foreground whitespace-pre-line bg-muted/30 p-3 rounded-lg">
                              {scheme.application_process}
                            </p>
                          </div>
                        )}

                        {/* Required Documents */}
                        {scheme.required_documents && scheme.required_documents.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                              <FileCheck2 className="h-4 w-4 text-primary" /> Required Documents for Application
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {scheme.required_documents.map((doc, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                                >
                                  {doc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tutorial Video Player (YouTube embed) */}
                        {embedUrl && (
                          <div className="space-y-2 pt-2 border-t print:hidden">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Video className="h-4 w-4 text-red-500" /> Application Tutorial Video
                            </h4>
                            <div className="aspect-video w-full max-w-lg rounded-lg overflow-hidden border">
                              <iframe
                                src={embedUrl}
                                title={`${scheme.name} Tutorial`}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        )}

                        {/* Official Links & Actions */}
                        <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-muted-foreground">
                            Eligible under standard state & demographic rules.
                          </div>
                          <div className="flex gap-2">
                            {scheme.official_website_url && (
                              <Button asChild size="sm" variant="outline" className="text-xs">
                                <a
                                  href={scheme.official_website_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Official Website <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            <Button asChild size="sm" variant="ghost" className="text-xs">
                              <Link to={`/schemes/${scheme.id}`}>
                                Full Scheme Dossier
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {(activeTab === "verification" || window.matchMedia?.("print")?.matches) && (
              <div className="space-y-4">
                <div className="hidden print:block font-bold text-lg text-amber-700 border-b pb-1 mt-6">
                  Schemes Requiring Additional Verification ({needsVerificationList.length})
                </div>

                {needsVerificationList.length === 0 ? (
                  <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                    No schemes pending missing verification data.
                  </div>
                ) : (
                  needsVerificationList.map(({ scheme, missing, percentage }) => (
                    <div
                      key={scheme.id}
                      className="rounded-xl border border-amber-500/30 bg-card p-6 shadow-card space-y-4 break-inside-avoid"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-amber-500 text-amber-600">
                              Requires Additional Information
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {scheme.ministry || "Govt"}
                            </span>
                          </div>
                          <h3 className="mt-2 text-xl font-bold text-foreground">
                            {scheme.name}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {scheme.description}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-amber-500/10 p-4 border border-amber-500/20">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                          Missing Information Needed to Determine Eligibility:
                        </h4>
                        <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-200 list-disc list-inside">
                          {missing.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>

                      {scheme.required_documents && scheme.required_documents.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Required Documents Checklist:
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {scheme.required_documents.map((doc, idx) => (
                              <span
                                key={idx}
                                className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                              >
                                {doc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {(activeTab === "ineligible" || window.matchMedia?.("print")?.matches) && (
              <div className="space-y-4">
                <div className="hidden print:block font-bold text-lg text-rose-700 border-b pb-1 mt-6">
                  Ineligible Schemes ({ineligibleList.length})
                </div>

                {ineligibleList.length === 0 ? (
                  <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                    No disqualified schemes.
                  </div>
                ) : (
                  ineligibleList.map(({ scheme, reasons }) => (
                    <div
                      key={scheme.id}
                      className="rounded-xl border border-destructive/20 bg-card p-5 shadow-card space-y-3 break-inside-avoid"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-foreground text-base">
                          {scheme.name}
                        </h3>
                        <Badge variant="destructive" className="text-xs">
                          Ineligible
                        </Badge>
                      </div>
                      <div className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg space-y-1">
                        <span className="font-semibold block">Reasons for Ineligibility:</span>
                        <ul className="list-disc list-inside space-y-0.5">
                          {reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
