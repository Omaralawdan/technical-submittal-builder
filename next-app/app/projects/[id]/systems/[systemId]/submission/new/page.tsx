'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const STANDARD_SECTIONS = [
  { code: 'COVER', name: 'Cover' },
  { code: 'TOC', name: 'Table of Contents' },
  { code: 'COMPLIANCE_SHEET', name: 'Compliance Sheet' },
  { code: 'MATERIAL_LIST', name: 'Material List' },
  { code: 'COUNTRY_OF_ORIGIN', name: 'Country of Origin' },
  { code: 'MATERIAL_SELECTION', name: 'Material Selection / Technical Selection' },
  { code: 'DATA_SHEETS', name: 'Data Sheets' },
  { code: 'REFERENCE_LIST', name: 'Reference List' },
];

export default function NewSubmissionPage() {
  const router = useRouter();
  const params = useParams();

  const projectId = params.id as string;
  const systemId = params.systemId as string;

  const supabase = createClient();

  const [revision, setRevision] = useState('');
  const [submissionDate, setSubmissionDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createSubmission() {
    setLoading(true);
    setError('');

    try {
      // 1. Create submission
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          project_system_id: systemId,
          revision: revision || null,
          submission_date: submissionDate || null,
          status: 'draft',
        })
        .select('id')
        .single();

      if (submissionError) {
        throw new Error(submissionError.message);
      }

      // 2. Create standard structure
      const { data: structure, error: structureError } = await supabase
        .from('submission_structures')
        .insert({
          submission_id: submission.id,
          structure_name: 'Standard',
        })
        .select('id')
        .single();

      if (structureError) {
        await supabase
          .from('submissions')
          .delete()
          .eq('id', submission.id);

        throw new Error(structureError.message);
      }

      // 3. Get section types
      const { data: sectionTypes, error: sectionTypesError } =
        await supabase
          .from('section_types')
          .select('id, code');

      if (sectionTypesError) {
        await supabase
          .from('submission_structures')
          .delete()
          .eq('id', structure.id);

        await supabase
          .from('submissions')
          .delete()
          .eq('id', submission.id);

        throw new Error(sectionTypesError.message);
      }

      // 4. Prepare standard sections
      const sectionsToInsert = STANDARD_SECTIONS.map((section, index) => {
        const sectionType = sectionTypes?.find(
          (item) => item.code === section.code
        );

        return {
          structure_id: structure.id,
          section_type_id: sectionType?.id ?? null,
          title: section.name,
          section_order: index + 1,
          is_custom: false,
        };
      });

      // 5. Create sections
      const { error: sectionsError } = await supabase
        .from('submission_sections')
        .insert(sectionsToInsert);

      if (sectionsError) {
        await supabase
          .from('submission_structures')
          .delete()
          .eq('id', structure.id);

        await supabase
          .from('submissions')
          .delete()
          .eq('id', submission.id);

        throw new Error(sectionsError.message);
      }

      // 6. Open the created submission
      router.push(
        `/projects/${projectId}/systems/${systemId}/submission/${submission.id}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not create submission: ${err.message}`
          : 'Could not create submission: Unknown error'
      );

      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/projects/${projectId}/systems/${systemId}`
              )
            }
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to System
          </button>

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Create Submission
          </h1>

          <p className="mt-2 text-gray-600">
            Create a new technical submission for this system.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Revision
              </label>

              <input
                type="text"
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                placeholder="e.g. A"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Submission Date
              </label>

              <input
                type="date"
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Standard Submission Structure
            </h2>

            <div className="mt-4 space-y-3">
              {STANDARD_SECTIONS.map((section, index) => (
                <div
                  key={section.code}
                  className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {index + 1}
                  </div>

                  <div className="font-medium text-gray-800">
                    {section.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={createSubmission}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Create Submission'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}