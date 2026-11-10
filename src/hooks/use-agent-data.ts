import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-app-data";

export function useAgentProfile(userId?: string) {
  const { data: user } = useUser();
  const id = userId || user?.id;

  return useQuery({
    queryKey: ["agentProfile", id],
    enabled: !!id && typeof supabase?.from === "function",
    queryFn: async () => {
      if (typeof supabase?.from !== "function") return null;
      try {
        const { data, error } = await supabase
          .from("agent_profiles")
          .select("*")
          .eq("id", id!)
          .maybeSingle();

        if (error) {
          console.warn("Error fetching agent profile:", error);
          return null;
        }
        return data;
      } catch {
        return null;
      }
    },
  });
}

export function useIsApprovedAgent() {
  const { data: user } = useUser();

  return useQuery({
    queryKey: ["isApprovedAgent", user?.id],
    enabled: !!user && typeof supabase?.from === "function",
    queryFn: async () => {
      if (typeof supabase?.from !== "function") return false;
      try {
        const { data, error } = await supabase
          .from("agent_profiles")
          .select("status")
          .eq("id", user!.id)
          .maybeSingle();

        if (error || !data) return false;
        return data.status === "approved";
      } catch {
        return false;
      }
    },
  });
}

export function useAllAgentProfiles() {
  return useQuery({
    queryKey: ["allAgentProfiles"],
    enabled: typeof supabase?.from === "function",
    queryFn: async () => {
      if (typeof supabase?.from !== "function") return [];
      try {
        const { data, error } = await supabase
          .from("agent_profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("Error fetching all agent profiles:", error);
          return [];
        }
        return data ?? [];
      } catch {
        return [];
      }
    },
  });
}

export function useManagedUsers() {
  const { data: user } = useUser();

  return useQuery({
    queryKey: ["managedUsers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managed_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("Error fetching managed users:", error);
        return [];
      }
      return data ?? [];
    },
  });
}

export function useManagedUser(id?: string) {
  return useQuery({
    queryKey: ["managedUser", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managed_users")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useEligibilityCheckHistory() {
  const { data: user } = useUser();

  return useQuery({
    queryKey: ["eligibilityCheckHistory", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eligibility_check_history")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("Error fetching check history:", error);
        return [];
      }
      return data ?? [];
    },
  });
}

export function useUserSchemeMatches(userId?: string) {
  return useQuery({
    queryKey: ["userSchemeMatches", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_scheme_matches")
        .select("*, schemes(*)")
        .eq("user_id", userId!)
        .order("match_percentage", { ascending: false });
      if (error) {
        console.warn("Error fetching user scheme matches:", error);
        return [];
      }
      return data ?? [];
    },
  });
}

export function useAllAgentSchemeMatches() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["allAgentSchemeMatches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_scheme_matches")
        .select("*, schemes(*)")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("Error fetching all agent scheme matches:", error);
        return [];
      }
      return data ?? [];
    },
  });
}

export function useBeneficiaryDocuments(userId?: string) {
  return useQuery({
    queryKey: ["beneficiaryDocuments", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      try {
        // Query documents table
        const { data: docs } = await supabase
          .from("documents")
          .select("*")
          .order("created_at", { ascending: false });

        const matchingDocs = (docs || []).filter((d: any) => {
          if (d.managed_user_id === userId) return true;
          if (d.file_path && d.file_path.includes(userId)) return true;
          return false;
        });

        // Also check managed_users.extra_criteria for document metadata
        const { data: managedUser } = await supabase
          .from("managed_users")
          .select("extra_criteria")
          .eq("id", userId)
          .maybeSingle();

        const extraDocs: any[] = (managedUser?.extra_criteria as any)?.documents || [];

        const docsMap = new Map<string, any>();
        const pathToKey = new Map<string, string>();
        const idToKey = new Map<string, string>();

        const addOrMerge = (d: any, preferExistingId = true) => {
          if (!d) return;

          const normPath =
            d.file_path && typeof d.file_path === "string" && d.file_path.trim()
              ? d.file_path.trim().toLowerCase().replace(/\\/g, "/").replace(/^\/+/, "")
              : null;
          const id =
            d.id && typeof d.id === "string" && d.id.trim() ? d.id.trim() : null;

          // Find existing key by path or id
          let existingKey: string | undefined;
          if (normPath && pathToKey.has(normPath)) {
            existingKey = pathToKey.get(normPath);
          } else if (id && idToKey.has(id)) {
            existingKey = idToKey.get(id);
          }

          if (existingKey && docsMap.has(existingKey)) {
            const existing = docsMap.get(existingKey);
            // Merge fields, keeping the DB id if preferExistingId is true, or keeping existing.id if truthy
            const merged = {
              ...d,
              ...existing,
              id: preferExistingId && existing.id ? existing.id : d.id || existing.id,
              file_path: existing.file_path || d.file_path,
              doc_type: existing.doc_type || d.doc_type,
              file_name: existing.file_name || d.file_name,
              mime_type: existing.mime_type || d.mime_type,
              status: existing.status || d.status || "Verified",
              created_at: existing.created_at || d.created_at || d.uploaded_at,
              uploaded_at: existing.uploaded_at || d.uploaded_at || d.created_at,
              scheme_id: existing.scheme_id || d.scheme_id,
            };
            docsMap.set(existingKey, merged);
            if (normPath) pathToKey.set(normPath, existingKey);
            if (id) idToKey.set(id, existingKey);
          } else {
            const primaryKey = normPath
              ? `path:${normPath}`
              : id
              ? `id:${id}`
              : `doc:${d.doc_type || ""}_${d.file_name || ""}_${docsMap.size}`;
            docsMap.set(primaryKey, { ...d });
            if (normPath) pathToKey.set(normPath, primaryKey);
            if (id) idToKey.set(id, primaryKey);
          }
        };

        // Process matchingDocs (from database table) first so their DB row IDs are authoritative
        matchingDocs.forEach((d: any) => addOrMerge(d, true));

        // Process extraDocs (from managed_users.extra_criteria.documents)
        extraDocs.forEach((d: any) => addOrMerge(d, true));

        return Array.from(docsMap.values());
      } catch (err) {
        console.warn("Failed to fetch beneficiary documents:", err);
        return [];
      }
    },
  });
}

export function useBeneficiaryCheckHistory(userId?: string) {
  return useQuery({
    queryKey: ["beneficiaryCheckHistory", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      try {
        const query = supabase
          .from("eligibility_check_history")
          .select("*")
          .eq("batch_id", `user_${userId}`);

        const { data, error } = typeof (query as any)?.order === "function"
          ? await (query as any).order("created_at", { ascending: false })
          : await query;

        if (error) {
          console.warn("Error fetching check history:", error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn("Failed to fetch beneficiary check history:", err);
        return [];
      }
    },
  });
}
