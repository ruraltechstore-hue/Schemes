import { Link } from "react-router-dom";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useMatches } from "@/hooks/use-app-data";
import { SCHEME_CATEGORIES } from "@/lib/constants";
import { splitIntoPoints } from "@/lib/point-helpers";

export default AllSchemes;

function AllSchemes() {
  const { all } = useMatches();
  const [q, setQ] = useState(""); const [cats, setCats] = useState<string[]>([]); const [level, setLevel] = useState<string>("All");
  const toggle = (c: string) => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  const list = all.filter(({ scheme: s }) =>
    (!q || `${s.name} ${s.description} ${s.ministry} ${s.benefits}`.toLowerCase().includes(q.toLowerCase())) &&
    (cats.length === 0 || cats.includes(s.category)) && (level === "All" || s.level === level));
  return (
    <div>
      <PageHeader title="All Schemes" subtitle={`${list.length} of ${all.length} schemes`} />
      <div className="mb-6 space-y-4 rounded-lg border bg-card p-4 shadow-card">
        <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search schemes, ministries, benefits…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex flex-wrap gap-2">
          {SCHEME_CATEGORIES.map((c) => (
            <Button key={c} size="sm" variant={cats.includes(c) ? "default" : "outline"} onClick={() => toggle(c)}>{c}</Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", "Central", "State"].map((l) => (
            <Button key={l} size="sm" variant={level === l ? "secondary" : "ghost"} onClick={() => setLevel(l)}>{l === "All" ? "All levels" : `${l} Government`}</Button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map(({ scheme: s, eligible, percent }) => (
          <Link key={s.id} to={`/schemes/${s.id}`} className="block rounded-lg border bg-card p-5 shadow-card transition hover:border-primary">
            <div className="flex flex-wrap gap-2"><Badge variant="secondary">{s.category}</Badge><Badge variant="outline">{s.level}</Badge>
              {eligible && <Badge className="bg-success text-success-foreground">You may be eligible · {percent}%</Badge>}</div>
            <h3 className="mt-3 text-lg font-semibold">{s.name}</h3>
            <p className="text-xs text-muted-foreground">{s.ministry}</p>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground whitespace-pre-line">{s.description}</p>
            <p className="mt-2 text-sm font-medium line-clamp-2 whitespace-pre-line">{s.benefits}</p>
            {s.eligibility_text && (
              <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">Eligibility: </span>
                {splitIntoPoints(s.eligibility_text).join(" • ")}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
