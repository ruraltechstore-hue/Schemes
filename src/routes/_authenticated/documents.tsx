import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Trash2, Upload, Lock, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { useDocuments, useUser } from "@/hooks/use-app-data";
import { DOC_TYPES } from "@/lib/constants";

export default Docs;

const ACCEPT = ["application/pdf", "image/jpeg", "image/png"];

function Docs() {
  const { data: user } = useUser();
  const { data: docs } = useDocuments();
  const qc = useQueryClient();
  const [type, setType] = useState("");
  const [isOther, setIsOther] = useState(false);
  const [customDocName, setCustomDocName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = isOther ? customDocName.trim() : type;
    if (!finalType) {
      toast.error(isOther ? "Please enter the document name" : "Choose a document type and file");
      return;
    }
    if (!file || !user) {
      toast.error("Choose a document type and file");
      return;
    }
    if (!ACCEPT.includes(file.type)) {
      toast.error("Only PDF, JPG, JPEG or PNG allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max file size is 10 MB");
      return;
    }
    setBusy(true);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) {
      setBusy(false);
      toast.error(upErr.message);
      return;
    }
    const { error } = await supabase.from("documents").insert({
      doc_type: finalType,
      file_name: file.name,
      file_path: path,
      mime_type: file.type,
      status: "Verified",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Document uploaded");
    setFile(null);
    setType("");
    setCustomDocName("");
    setIsOther(false);
    const fileInput = document.getElementById("file") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const view = async (path: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const del = async (id: string, path: string) => {
    if (!confirm("Delete this document?")) return;
    await supabase.storage.from("documents").remove([path]);
    await supabase.from("documents").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Deleted");
  };

  return (
    <div>
      <PageHeader title="My Documents" subtitle="Documents are private and visible only to you." />
      <form onSubmit={upload} className="mb-8 grid gap-4 rounded-lg border bg-card p-6 shadow-card md:grid-cols-[1.2fr_1.5fr_auto] md:items-end">
        <div>
          {isOther ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="custom-doc-name">Document name</Label>
                <button
                  type="button"
                  onClick={() => {
                    setIsOther(false);
                    setType("");
                    setCustomDocName("");
                  }}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Choose from list
                </button>
              </div>
              <div className="relative">
                <Input
                  id="custom-doc-name"
                  type="text"
                  autoFocus
                  placeholder="Enter document name (e.g. Ration Card)"
                  value={customDocName}
                  onChange={(e) => setCustomDocName(e.target.value)}
                  className="pr-8"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsOther(false);
                    setType("");
                    setCustomDocName("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Back to list"
                  aria-label="Back to document type list"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="doc-type-trigger">Document type</Label>
              <Select
                value={type}
                onValueChange={(val) => {
                  if (val === "Other Documents") {
                    setIsOther(true);
                    setType("");
                    setCustomDocName("");
                  } else {
                    setType(val);
                    setIsOther(false);
                  }
                }}
              >
                <SelectTrigger id="doc-type-trigger">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="file">File (PDF, JPG, JPEG, PNG)</Label>
          <Input id="file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button disabled={busy}><Upload className="h-4 w-4" />{busy ? "Uploading…" : "Upload"}</Button>
        <p className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-3"><Lock className="h-3.5 w-3.5" />Files are stored securely and only you can access them.</p>
      </form>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground"><tr>
            <th className="p-3">Document name</th><th className="p-3">Type</th><th className="p-3">Uploaded</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {docs?.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground"><FileText className="mx-auto mb-2 h-8 w-8" />No documents yet</td></tr>}
            {docs?.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="max-w-[200px] truncate p-3 font-medium">{d.file_name}</td>
                <td className="p-3 font-medium">{d.doc_type}</td>
                <td className="p-3">{new Date(d.created_at!).toLocaleDateString("en-IN")}</td>
                <td className="p-3"><Badge className="bg-success text-success-foreground">{d.status}</Badge></td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => view(d.file_path)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(d.id, d.file_path)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
