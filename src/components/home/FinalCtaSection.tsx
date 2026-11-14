import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <div className="relative overflow-hidden rounded-2xl bg-hero px-6 py-12 text-center text-primary-foreground shadow-card md:px-12 md:py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Don&apos;t Miss the Government Benefits You May Be Eligible For
          </h2>
          <p className="mt-4 text-base text-primary-foreground/85 md:text-lg">
            Create your account, provide your details and discover government schemes that match your profile.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-saffron text-saffron-foreground hover:bg-saffron/90"
            >
              <Link to="/register">
                Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

