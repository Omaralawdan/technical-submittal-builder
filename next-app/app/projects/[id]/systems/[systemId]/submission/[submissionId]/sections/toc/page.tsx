'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type Section = {
  id: string;
  title: string;
  section_order: number;
  is_custom: boolean;
};

export default function TableOfContentsPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;
  const systemId = params.systemId as string;
  const submissionId = params.submissionId as string;

  const supabase = createClient();

  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSections() {
      setLoading(true);
      setError('');

      try {
        const { data: structureData, error: structureError } =
          await supabase
            .from('submission_structures')
            .select('id')
            .eq('submission_id', submissionId)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (structureError) {
          throw new Error(structureError.message);
        }

        const { data: sectionsData, error: sectionsError } =
          await supabase
            .from('submission_sections')
            .select(
              'id, title, section_order, is_custom'
            )
            .eq('structure_id', structureData.id)
            .order('section_order', { ascending: true });

        if (sectionsError) {
          throw new Error(sectionsError.message);
        }

        setSections(sectionsData || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load table of contents'
        );
      } finally {
        setLoading(false);
      }
    }

    loadSections();
  }, [submissionId]);

  function getSectionUrl(section: Section) {
    if (section.title === 'Cover') {
      return `/projects/${projectId}/systems/${systemId}/submission/${submissionId}/sections/cover`;
    }

    if (section.title === 'Table of Contents') {
      return `/projects/${projectId}/systems/${systemId}/submission/${submissionId}/sections/toc`;
    }

    return '#';
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-gray-600">
            Loading table of contents...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-red-600">
            Could not load table of contents
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/projects/${projectId}/systems/${systemId}/submission/${submissionId}`
              )
            }
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to Submission
          </button>

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Table of Contents
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Submission sections and document order.
          </p>
        </div>

        {/* Preview */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-lg">

          {/* Document Header */}
          <div className="border-b-4 border-blue-900 px-8 py-7 md:px-12">
            <div className="flex items-center justify-between">

              <div>
                <div className="text-2xl font-extrabold tracking-wide text-gray-900">
                  PETROKIMA
                </div>

                <div className="mt-1 text-xs font-medium uppercase tracking-[0.25em] text-gray-500">
                  Engineering & Contracting
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Technical Submittal
                </div>

                <div className="mt-1 text-sm font-semibold text-gray-700">
                  Table of Contents
                </div>
              </div>

            </div>
          </div>

          {/* Contents */}
          <div className="px-8 py-12 md:px-14 md:py-16">

            <div className="mx-auto max-w-3xl">

              <div className="mb-10">
                <h2 className="text-3xl font-extrabold text-gray-900">
                  Table of Contents
                </h2>

                <div className="mt-4 h-1 w-20 rounded-full bg-blue-900" />
              </div>

              <div className="space-y-1">

                {sections.map((section) => (
                  <div
                    key={section.id}
                    className="flex items-center gap-4 border-b border-gray-100 py-4"
                  >

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600">
                      {String(section.section_order).padStart(2, '0')}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800">
                        {section.title}
                      </p>

                      {section.is_custom && (
                        <p className="mt-1 text-xs text-gray-400">
                          Custom Section
                        </p>
                      )}
                    </div>

                    <div className="hidden flex-1 border-b border-dotted border-gray-300 md:block" />

                    <div className="text-sm font-semibold text-gray-500">
                      {section.section_order}
                    </div>

                  </div>
                ))}

              </div>

              {sections.length === 0 && (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <p className="text-sm text-gray-500">
                    No sections found.
                  </p>
                </div>
              )}

            </div>

          </div>

          {/* Footer */}
          <div className="border-t bg-gray-50 px-8 py-6 md:px-12">
            <div className="flex flex-col gap-2 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
              <span>
                PETROKIMA Engineering & Contracting
              </span>

              <span>
                Technical Submittal Builder
              </span>
            </div>
          </div>

        </div>

        {/* Information */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Automatic Contents
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            This table of contents is generated automatically from
            the sections configured in the submission. Any future
            section added, removed, or reordered will be reflected
            here automatically.
          </p>
        </div>

      </div>
    </main>
  );
}