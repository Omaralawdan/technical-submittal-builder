'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type Project = {
  id: string;
  project_name: string;
  client_name: string | null;
  consultant: string | null;
  contractor: string | null;
};

type SystemInfo = {
  id: string;
  custom_system_name: string | null;
  system_id: string | null;
  systems:
    | {
        id: string;
        name: string;
        description: string | null;
      }
    | null;
};

type Submission = {
  id: string;
  revision: string | null;
  submission_date: string | null;
  status: string;
};

export default function CoverPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;
  const systemId = params.systemId as string;
  const submissionId = params.submissionId as string;

  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCoverData() {
      setLoading(true);
      setError('');

      try {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select(
            'id, project_name, client_name, consultant, contractor'
          )
          .eq('id', projectId)
          .single();

        if (projectError) {
          throw new Error(projectError.message);
        }

        const { data: systemData, error: systemError } = await supabase
          .from('project_systems')
          .select(`
            id,
            custom_system_name,
            system_id,
            systems (
              id,
              name,
              description
            )
          `)
          .eq('id', systemId)
          .eq('project_id', projectId)
          .single();

        if (systemError) {
          throw new Error(systemError.message);
        }

        const { data: submissionData, error: submissionError } =
          await supabase
            .from('submissions')
            .select(
              'id, revision, submission_date, status'
            )
            .eq('id', submissionId)
            .eq('project_system_id', systemId)
            .single();

        if (submissionError) {
          throw new Error(submissionError.message);
        }

        setProject(projectData);
        setSystem(systemData as unknown as SystemInfo);
        setSubmission(submissionData);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load cover data'
        );
      } finally {
        setLoading(false);
      }
    }

    loadCoverData();
  }, [projectId, systemId, submissionId]);

  function getSystemName() {
    if (!system) return '';

    if (system.custom_system_name) {
      return system.custom_system_name;
    }

    return system.systems?.name || 'System';
  }

  function formatDate(date: string | null) {
    if (!date) return '—';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString('en-GB');
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-gray-600">Loading cover...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-red-600">
            Could not load cover
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!project || !system || !submission) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-gray-600">
            Cover information not found.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">

        {/* Top Bar */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              onClick={() =>
                router.push(
                  `/projects/${projectId}/systems/${systemId}/submission/${submissionId}`
                )
              }
              className="mb-2 text-sm font-medium text-blue-600 hover:underline"
            >
              ← Back to Submission
            </button>

            <h1 className="text-3xl font-bold text-gray-900">
              Cover
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Submission cover configuration
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Print / Save PDF
          </button>
        </div>

        {/* Cover Preview */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-lg">

          {/* Header */}
          <div className="border-b-4 border-blue-900 bg-white px-8 py-7 md:px-12">
            <div className="flex items-start justify-between gap-6">

              <div>
                <div className="text-2xl font-extrabold tracking-wide text-gray-900">
                  PETROKIMA
                </div>

                <div className="mt-1 text-xs font-medium uppercase tracking-[0.25em] text-gray-500">
                  Engineering & Contracting
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Technical Submittal
                </div>

                <div className="mt-1 text-sm font-semibold text-gray-800">
                  Revision {submission.revision || '—'}
                </div>
              </div>

            </div>
          </div>

          {/* Main Cover */}
          <div className="px-8 py-14 md:px-16 md:py-20">

            <div className="mx-auto max-w-4xl text-center">

              <div className="mb-8 inline-flex rounded-full border border-gray-200 bg-gray-50 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
                Technical Submittal
              </div>

              <h2 className="text-4xl font-extrabold leading-tight text-gray-900 md:text-5xl">
                {getSystemName()}
              </h2>

              <div className="mx-auto mt-6 h-1 w-24 rounded-full bg-blue-900" />

              <p className="mt-8 text-2xl font-semibold text-gray-700">
                {project.project_name}
              </p>

              <p className="mt-3 text-base text-gray-500">
                Technical Material Submission
              </p>

            </div>

            {/* Project Information */}
            <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-xl border border-gray-200">

              <div className="border-b bg-gray-50 px-6 py-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                  Project Information
                </h3>
              </div>

              <div className="grid md:grid-cols-2">

                <InfoRow
                  label="Project"
                  value={project.project_name}
                />

                <InfoRow
                  label="System"
                  value={getSystemName()}
                />

                <InfoRow
                  label="Client"
                  value={project.client_name || '—'}
                />

                <InfoRow
                  label="Consultant"
                  value={project.consultant || '—'}
                />

                <InfoRow
                  label="Contractor"
                  value={project.contractor || '—'}
                />

                <InfoRow
                  label="Revision"
                  value={submission.revision || '—'}
                />

                <InfoRow
                  label="Submission Date"
                  value={formatDate(submission.submission_date)}
                />

                <InfoRow
                  label="Status"
                  value={submission.status}
                />

              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="border-t bg-gray-50 px-8 py-6 md:px-12">

            <div className="flex flex-col gap-3 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">

              <div>
                PETROKIMA Engineering & Contracting
              </div>

              <div>
                Technical Submittal Builder
              </div>

            </div>

          </div>

        </div>

        {/* Future Controls */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">

          <h2 className="text-lg font-semibold text-gray-900">
            Cover Controls
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Cover template, logos, colors and other visual settings
            will be configurable here in the next stage.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">

            <button
              disabled
              className="rounded-lg border px-4 py-2 text-sm text-gray-400"
            >
              Change Template
            </button>

            <button
              disabled
              className="rounded-lg border px-4 py-2 text-sm text-gray-400"
            >
              Upload Logo
            </button>

            <button
              disabled
              className="rounded-lg border px-4 py-2 text-sm text-gray-400"
            >
              Customize Colors
            </button>

          </div>

        </div>

      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-gray-200 px-6 py-5 last:border-b-0 md:nth-[odd]:border-r">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-gray-800">
        {value}
      </div>
    </div>
  );
}