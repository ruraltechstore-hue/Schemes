import { Link } from "react-router-dom";
import { UserPlus, Upload, ShieldCheck, ListChecks, ArrowRight, Lock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Disclaimer } from "@/components/Disclaimer";

export default Index;

const steps = [
  { icon: UserPlus, title: "Register", text: "Create a free account with your basic details." },
  { icon: Upload, title: "Upload Documents", text: "Securely add Aadhaar, income and other certificates." },
  { icon: ShieldCheck, title: "Check Eligibility", text: "We compare your profile against scheme rules." },
  { icon: ListChecks, title: "View Schemes", text: "See matches, missing documents and how to apply." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <div className="tricolor-bar h-1" />
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Login</Link></Button>
            <Button asChild><Link to="/register">Get Started</Link></Button>
          </div>
        </div>
      </header>

      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="mb-4 inline-block rounded-full border border-primary-foreground/30 px-3 py-1 text-xs uppercase tracking-wider">Citizen services</p>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">Find Government Schemes You May Be Eligible For</h1>
            <p className="mt-5 max-w-xl text-lg text-primary-foreground/80">
              Tell us about yourself once. We check your profile and documents against central and state schemes for farmers, students, women, workers and families — and show you what to do next.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-saffron text-saffron-foreground hover:bg-saffron/90">
                <Link to="/register">Get Started <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/auth">Login</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-xl bg-card p-6 text-card-foreground shadow-card">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Search className="h-4 w-4" /> Sample match</div>
            <h3 className="mt-3 text-lg font-semibold">PM-KISAN Samman Nidhi</h3>
            <p className="text-sm text-muted-foreground">₹6,000 per year income support</p>
            <div className="mt-4 h-2 rounded-full bg-muted"><div className="h-2 w-[86%] rounded-full bg-success" /></div>
            <p className="mt-2 text-sm font-medium text-success">86% match · You may be eligible</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Your documents stay private to you</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-primary">How It Works</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-lg border bg-card p-6 shadow-card">
              <span className="absolute right-4 top-4 font-display text-3xl font-bold text-muted">{i + 1}</span>
              <s.icon className="h-8 w-8 text-saffron" />
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16"><Disclaimer /></section>
      <footer className="border-t bg-card py-6 text-center text-sm text-muted-foreground">
        Government Scheme Finder · An information service for citizens
      </footer>
    </div>
  );
}
