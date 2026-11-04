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

        const map = new Map<string, any>();
        matchingDocs.forEach((d: any) => map.set(d.id || d.file_path, d));
        extraDocs.forEach((d: any) => {
          const key = d.id || d.file_path;
          if (!map.has(key)) {
            map.set(key, d);
          }
        });

        return Array.from(map.values());
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
        const { data, error } = await supabase
          .from("eligibility_check_history")
          .select("*")
          .eq("batch_id", `user_${userId}`)
          .order("created_at", { ascending: false });

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
