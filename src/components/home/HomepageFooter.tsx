import { useState } from "react";
import { Mail, Phone } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FooterModalKey =
  "about-us" | "about-scheme-finder" | "privacy" | "terms" | "disclaimer" | "cookies" | null;

const MODAL_CONTENT: Record<
  Exclude<FooterModalKey, null>,
  { title: string; subtitle: string; body: string[] }
> = {
  "about-us": {
    title: "About Us",
    subtitle: "Rural Tech Store — Citizen Welfare Initiative",
    body: [
      "Rural Tech Store provides Government Scheme Finder to help citizens across urban and rural India discover welfare schemes they may qualify for without navigating fragmented portals alone.",
      "Our goal is to make public scheme information transparent, structured, and easy to prepare for by summarizing benefits, eligibility attributes, required documents, and official application links.",
    ],
  },
  "about-scheme-finder": {
    title: "About Scheme Finder",
    subtitle: "How Our Portal Helps Citizens",
    body: [
      "Government Scheme Finder indexes Central and State Government initiatives across agriculture, education, healthcare, housing, women empowerment, entrepreneurship, employment, and social welfare.",
      "Visitors can browse schemes publicly without logging in, or create a free account to organize documents and view personalized eligibility match percentages.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    subtitle: "How Your Profile & Document Data Is Handled",
    body: [
      "Information you enter in your citizen profile—such as age, state, income bracket, occupation, category, and uploaded eligibility documents—is used solely to compute scheme eligibility matches and help you track applications on this platform.",
      "Data is stored in authenticated Supabase infrastructure governed by role-based and row-level access controls. You control what details you provide, and no private user documents are exposed on public pages.",
    ],
  },
  terms: {
    title: "Terms & Conditions",
    subtitle: "Platform Usage Guidelines",
    body: [
      "Government Scheme Finder is an informational facilitation tool. While care is taken to maintain accurate summaries of listed Central and State schemes, scheme rules, deadlines, and benefits may change by official government notification.",
      "Users are responsible for verifying final criteria directly on the official government website linked on each scheme detail page before submitting an application.",
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    subtitle: "Informational Eligibility & Official Approval",
    body: [
      "Scheme recommendations and eligibility match percentages are calculated strictly from the information and documents provided by the user for guidance only.",
      "Eligibility indication on this portal does not guarantee grant approval. Final eligibility determination and benefit disbursement rest solely with the concerned government ministry or department.",
    ],
  },
  cookies: {
    title: "Cookies",
    subtitle: "Essential Browser Storage & Session Cookies",
    body: [
      "Government Scheme Finder uses essential session cookies and browser local storage strictly to keep authenticated sign-in sessions active and remember core interface state.",
      "We do not deploy third-party advertising trackers or sell browsing data.",
    ],
  },
};

export function HomepageFooter() {
  const [activeModal, setActiveModal] = useState<FooterModalKey>(null);
  const modal = activeModal ? MODAL_CONTENT[activeModal] : null;

  return (
    <footer className="border-t bg-hero text-primary-foreground">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:flex-wrap lg:flex-nowrap lg:items-start lg:justify-between">
          <div className="max-w-xs shrink-0">
            <Logo light />
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/80">
              An information service helping citizens explore Central and State Government welfare
              programs, document requirements, and estimated eligibility.
            </p>
          </div>

          <div className="shrink-0">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-saffron">Company</h3>
            <ul className="mt-3 space-y-2 text-sm text-primary-foreground/80">
              <li>
                <button
                  type="button"
                  onClick={() => setActiveModal("about-us")}
                  className="text-left transition hover:text-primary-foreground hover:underline"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveModal("about-scheme-finder")}
                  className="text-left transition hover:text-primary-foreground hover:underline"
                >
                  About Scheme Finder
                </button>
              </li>
            </ul>
          </div>

          <div className="shrink-0">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-saffron">
              Quick Links
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-primary-foreground/80">
              <li>
                <a href="#top" className="transition hover:text-primary-foreground hover:underline">
                  Home
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="transition hover:text-primary-foreground hover:underline"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#faqs"
                  className="transition hover:text-primary-foreground hover:underline"
                >
                  FAQs
                </a>
              </li>
            </ul>
          </div>

          <div className="shrink-0">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-saffron">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm text-primary-foreground/80">
              <li>
                <button
                  type="button"
                  onClick={() => setActiveModal("privacy")}
                  className="text-left transition hover:text-primary-foreground hover:underline"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveModal("terms")}
                  className="text-left transition hover:text-primary-foreground hover:underline"
                >
                  Terms &amp; Conditions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveModal("disclaimer")}
                  className="text-left transition hover:text-primary-foreground hover:underline"
                >
                  Disclaimer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveModal("cookies")}
                  className="text-left transition hover:text-primary-foreground hover:underline"
                >
                  Cookies
                </button>
              </li>
            </ul>
          </div>

          <div className="shrink-0">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-saffron">
              Contact Info
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-primary-foreground/80">
              <li className="flex items-center gap-2 whitespace-nowrap">
                <Phone className="h-3.5 w-3.5 shrink-0 text-saffron" />
                <span>
                  Phone Number:{" "}
                  <a
                    href="tel:+919392898733"
                    className="font-medium text-primary-foreground transition hover:text-saffron hover:underline"
                  >
                    +91 93928 98733
                  </a>
                </span>
              </li>
              <li className="flex items-center gap-2 whitespace-nowrap">
                <Mail className="h-3.5 w-3.5 shrink-0 text-saffron" />
                <span>
                  Email ID:{" "}
                  <a
                    href="mailto:support@services.ruraltechstore.com"
                    className="font-medium text-primary-foreground transition hover:text-saffron hover:underline"
                  >
                    support@services.ruraltechstore.com
                  </a>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/15 pt-6 text-xs text-primary-foreground/75 sm:flex-row">
          <span>
            Rural Tech Store · Government Scheme Finder · An information service for citizens
          </span>
          <span>
            Eligibility results are informational; final decisions rest with official government
            departments.
          </span>
        </div>
      </div>

      <Dialog
        open={Boolean(activeModal)}
        onOpenChange={(open) => {
          if (!open) setActiveModal(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary">{modal?.title}</DialogTitle>
            <DialogDescription>{modal?.subtitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {modal?.body.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
