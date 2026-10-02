'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function SectionShell({ title, subtitle, children }: Props) {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back
        </button>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 text-sm font-medium text-blue-600">
                Technical Submittal
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
              <p className="mt-2 text-slate-500">{subtitle}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Print / Save PDF
            </button>
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}
