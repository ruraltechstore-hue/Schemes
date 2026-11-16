import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSchemesCount() {
  return useQuery({
    queryKey: ["schemes", "count"],
    queryFn: async () => {
      try {
        // Use Supabase exact count query with head: true to retrieve exact count without 1,000-row limit
        const res = await supabase.from("schemes").select("id", { count: "exact", head: true });
        if (res.error) throw res.error;
        if (typeof res.count === "number") return res.count;
        if (Array.isArray(res.data)) return res.data.length;
        return null;
      } catch (e) {
        // In mock environments where select does not return count or promise
        return null;
      }
    },
    refetchOnMount: "always",
  });
}
