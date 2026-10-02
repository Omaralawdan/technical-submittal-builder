'use client';

import SectionShell from '../components/SectionShell';

export default function DataSheetsPage() {
  return (
    <SectionShell
      title="07 — Data Sheets"
      subtitle="Manage product data sheets included in the technical submission."
    >
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Data Sheets
            </h2>
            <p className="text-sm text-slate-500">
              Add product part numbers and attach the corresponding data sheets.
            </p>
          </div>

          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            + Add Data Sheet
          </button>
        </div>

        <div className="rounded-xl border-2 border-dashed border-slate-300 p-10 text-center">
          <p className="font-medium text-slate-700">
            No data sheets added yet.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            You will be able to Browse or Drag & Drop files here.
          </p>
        </div>
      </div>
    </SectionShell>
  );
}
