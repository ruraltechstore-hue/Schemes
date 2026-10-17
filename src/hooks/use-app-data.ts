import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchScheme } from "@/lib/matching";

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
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
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
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin");
      return (data?.length ?? 0) > 0;
    },
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSchemes() {
  return useQuery({
    queryKey: ["schemes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schemes").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useApplications() {
  return useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*, schemes(*)").order("updated_at", { ascending: false });
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
