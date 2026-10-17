import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { useApplications } from "@/hooks/use-app-data";
import { APP_STATUSES } from "@/lib/constants";

export default Apps;

const tone: Record<string, string> = {
  Interested: "bg-secondary text-secondary-foreground", "Planning to Apply": "bg-accent text-accent-foreground",
  Applied: "bg-saffron text-saffron-foreground", Approved: "bg-success text-success-foreground", Rejected: "bg-destructive text-destructive-foreground",
};

function Apps() {
  const { data } = useApplications(); const qc = useQueryClient();
  const update = async (id: string, status: string) => {
    const { error } = await supabase.from("applications").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["applications"] });
  };
  const remove = async (id: string) => { await supabase.from("applications").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["applications"] }); };
  return (
    <div>
      <PageHeader title="Applications" subtitle="Track your progress on each scheme." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {APP_STATUSES.map((s) => (
          <div key={s} className="rounded-lg border bg-card p-3 text-center shadow-card">
            <div className="text-2xl font-bold text-primary">{data?.filter((a) => a.status === s).length ?? 0}</div>
            <div className="text-xs text-muted-foreground">{s}</div>
          </div>
        ))}
      </div>
      {data?.length === 0 && (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground"><ClipboardList className="mx-auto mb-2 h-8 w-8" />
          No tracked schemes yet. <Link to="/schemes" className="text-primary underline">Browse schemes</Link></div>
      )}
      <div className="space-y-3">
        {data?.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 shadow-card">
            <div className="min-w-0 flex-1">
              <Link to={`/schemes/${a.scheme_id}`} className="font-semibold hover:underline">{a.schemes?.name}</Link>
              <p className="text-xs text-muted-foreground">Updated {new Date(a.updated_at!).toLocaleDateString("en-IN")}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone[a.status]}`}>{a.status}</span>
            <Select value={a.status} onValueChange={(v) => update(a.id, v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{APP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => { remove(a.id); toast.success("Removed"); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
