import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchScheme, type Scheme } from "@/lib/matching";

export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
}

export function useProfile() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsAdmin() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["isAdmin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin");
      return (data?.length ?? 0) > 0;
    },
  });
}

export function useDocuments() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["documents", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export { useSchemesCount } from "./use-schemes-count";

export function useSchemes() {
  return useQuery({
    queryKey: ["schemes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schemes").select("*").order("name");
      if (error) throw error;
      if (!data) return [];

      let allData = [...data];
      // PostgREST limits single queries to 1000 rows by default.
      // If 1000 records are returned, fetch subsequent pages so all schemes are loaded.
      if (data.length === 1000) {
        let from = 1000;
        while (true) {
          try {
            const query = supabase.from("schemes").select("*").order("name");
            const rangeQuery = query as unknown as {
              range?: (
                from: number,
                to: number,
              ) => Promise<{ data: Scheme[] | null; error: unknown }>;
            };
            if (typeof rangeQuery.range !== "function") break;
            const nextRes = await rangeQuery.range(from, from + 999);
            if (nextRes.error || !nextRes.data || nextRes.data.length === 0) break;
            allData = allData.concat(nextRes.data);
            if (nextRes.data.length < 1000) break;
            from += 1000;
          } catch {
            break;
          }
        }
      }

      // Ensure only valid, active, non-empty, and deduplicated database records are returned
      const seenIds = new Set<string>();
      const valid: Scheme[] = [];

      for (const item of allData) {
        if (!item || !item.id) continue;
        const name = typeof item.name === "string" ? item.name.trim() : "";
        if (!name) continue; // Skip empty rows or records with missing name

        const rec = item as Record<string, unknown>;
        // If soft-deleted schemes exist, exclude them from the active total
        if (rec["is_deleted"] === true || rec["deleted_at"] || rec["status"] === "deleted") {
          continue;
        }

        // Avoid counting the same scheme multiple times (by unique id)
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);

        valid.push(item);
      }

      return valid;
    },
  });
}

export function useApplications() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, schemes(*)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMatches() {
  const profile = useProfile();
  const docs = useDocuments();
  const schemes = useSchemes();
  const docTypes = Array.from(new Set((docs.data ?? []).map((d) => d.doc_type)));
  const all = (schemes.data ?? []).map((s) => matchScheme(s, profile.data ?? null, docTypes));
  const eligible = all.filter((m) => m.eligible).sort((a, b) => b.percent - a.percent);
  return { all, eligible, isLoading: profile.isLoading || docs.isLoading || schemes.isLoading };
}

export * from "./use-agent-data";
