import Link from 'next/link';
import { type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export function LegalDoc({
  title,
  effectiveDate,
  intro,
  sections,
}: {
  title: string;
  effectiveDate: string;
  intro: ReactNode;
  sections: { heading: string; body: ReactNode }[];
}) {
  return (
    <div className="relative">
      <section className="relative pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
            Legal
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-white/55">
            Effective date: {effectiveDate}
          </p>

          <div className="mt-8 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100/90">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
            <p>
              <span className="font-semibold text-amber-100">
                Final legal review required.
              </span>{' '}
              This document is a polished placeholder authored by the Splash
              team. It must be reviewed and approved by qualified counsel
              before public launch.
            </p>
          </div>

          <div className="mt-10 text-[15px] leading-relaxed text-white/75">
            {intro}
          </div>
        </div>
      </section>

      <section className="relative py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">
            {sections.map((s, i) => (
              <article key={s.heading}>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  <span className="mr-3 text-white/40">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.heading}
                </h2>
                <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-white/70">
                  {s.body}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-sm text-white/65">
            <p>
              Questions about this document? Email{' '}
              <Link href="/contact" className="text-[#5EB1FF] hover:underline">
                the Splash team
              </Link>{' '}
              and we&apos;ll route you to the right person.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
