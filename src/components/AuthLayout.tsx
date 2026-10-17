import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="tricolor-bar h-1" />
      <div className="mx-auto flex max-w-md flex-col px-4 py-10">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-xl border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold text-primary">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
