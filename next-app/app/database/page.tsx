'use client';

import Link from 'next/link';

type DatabaseCard = {
  title: string;
  description: string;
  table: string;
};

const databaseCards: DatabaseCard[] = [
  {
    title: 'Products & Systems',
    description:
      'Manage systems and product information used in technical submittals.',
    table: 'systems / project systems',
  },
  {
    title: 'Data Sheets',
    description:
      'Manage product datasheets and technical documents used in submissions.',
    table: 'documents / documents library',
  },
  {
    title: 'References',
    description:
      'Manage company reference documents and previous project references.',
    table: 'company documents',
  },
  {
    title: 'Previous Approvals',
    description:
      'Manage previously approved technical submittal documents.',
    table: 'previous approvals',
  },
  {
    title: 'Company Documents',
    description:
      'Manage company-level documents available for technical submissions.',
    table: 'company documents',
  },
  {
    title: 'Company Branding',
    description:
      'Manage company logos used throughout technical submittals.',
    table: 'company branding',
  },
];

export default function DatabasePage() {
  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b-4 border-red-700 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Technical Submittal Builder
            </h1>

            <p className="text-sm text-gray-500">
              Technical Submission Management System
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-10">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Database
          </h2>

          <p className="mt-1 text-gray-600">
            Manage the documents, products and company information
            used in technical submittals.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {databaseCards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-5 h-1.5 w-14 rounded-full bg-red-700" />

              <h3 className="text-xl font-semibold text-gray-900">
                {card.title}
              </h3>

              <p className="mt-2 min-h-[48px] text-gray-600">
                {card.description}
              </p>

              <div className="mt-5 rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Database
                </p>

                <p className="mt-1 text-sm text-gray-600">
                  {card.table}
                </p>
              </div>

              <button
                type="button"
                disabled
                className="mt-6 rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400"
              >
                Manage — Coming Next
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
