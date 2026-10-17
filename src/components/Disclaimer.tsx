import { Info } from "lucide-react";
import { DISCLAIMER } from "@/lib/constants";

export function Disclaimer() {
  return (
    <div className="flex gap-3 rounded-lg border border-saffron/40 bg-saffron/10 p-4 text-sm text-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-saffron-foreground" />
      <p>{DISCLAIMER}</p>
    </div>
  );
}
