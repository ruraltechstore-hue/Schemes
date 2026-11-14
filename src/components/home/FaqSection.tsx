import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "What is Government Scheme Finder?",
    a: "Government Scheme Finder, offered by Rural Tech Store, is an informational portal that helps citizens discover Central and State Government welfare schemes, review required documents, and check estimated eligibility based on their profile details.",
  },
  {
    q: "How can I find government schemes?",
    a: "You can browse all listed programs on the Explore Schemes page, filter by category, citizen group, or Central/State level, search by keyword or ministry, or register an account to get personalized eligibility matches.",
  },
  {
    q: "How does eligibility checking work?",
    a: "After you sign in and enter profile attributes such as age, state, income, gender, category, occupation, and residence area along with your document checklist, the platform compares your inputs against each scheme's listed criteria and computes an informational match percentage.",
  },
  {
    q: "Which documents are required?",
    a: "Required documents vary by scheme and commonly include identity proof (such as Aadhaar), income certificate, residence or domicile proof, bank account details, caste or category certificate, land records, or educational records. Each scheme detail page lists its specific document checklist.",
  },
  {
    q: "Are both Central and State Government schemes available?",
    a: "Yes. The database stores both Central Government and State Government schemes across multiple ministries and departments, and you can filter by level on the scheme browsing page.",
  },
  {
    q: "Is registration free?",
    a: "Yes, creating an account on Government Scheme Finder and checking your scheme eligibility on this portal is free. Whether an individual government scheme charges a nominal application fee depends strictly on the official government department administering that scheme.",
  },
  {
    q: "How can I apply for a government scheme?",
    a: "Open any scheme's detail page to review eligibility criteria, required documents, tutorial videos (where available), and click the Apply Now link to visit the concerned official government portal to submit your application.",
  },
  {
    q: "Are my uploaded documents secure?",
    a: "Yes. Uploaded documents and profile data are stored in authenticated, access-controlled cloud storage using role-based and row-level security policies so only authorized account owners and approved facilitators can access your records.",
  },
  {
    q: "Can I check eligibility for multiple schemes?",
    a: "Yes. Once your profile details and documents are entered, the platform automatically evaluates your profile across all schemes in the database and displays your match percentage for each one.",
  },
  {
    q: "Does eligibility confirmation guarantee approval of my application?",
    a: "No. Eligibility match results and match percentages shown on Scheme Finder are strictly informational and intended only as guidance. Final eligibility verification, document scrutiny, and application approval depend entirely on the concerned government department.",
  },
];

export function FaqSection() {
  return (
    <section id="faqs" className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-primary">
          Frequently Asked Questions
        </h2>
        <p className="mt-3 text-muted-foreground">
          Clear answers on finding schemes, checking eligibility, document safety, and official applications.
        </p>
      </div>

      <div className="mt-10 rounded-xl border bg-card p-6 shadow-card">
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((item, idx) => (
            <AccordionItem key={item.q} value={`faq-${idx}`}>
              <AccordionTrigger className="text-left text-base font-medium text-primary hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

