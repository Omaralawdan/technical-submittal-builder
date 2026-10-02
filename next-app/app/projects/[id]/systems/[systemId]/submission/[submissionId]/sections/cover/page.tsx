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

  const [revision, setRevision] = useState('');
  const [submissionDate, setSubmissionDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
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

        setRevision(submissionData.revision || '');

        if (submissionData.submission_date) {
          setSubmissionDate(
            submissionData.submission_date.slice(0, 10)
          );
        } else {
          setSubmissionDate('');
        }
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

  async function handleSaveCoverSettings() {
    setSaving(true);
    setSaveMessage('');
    setError('');

    try {
      const { data, error: updateError } = await supabase
        .from('submissions')
        .update({
          revision: revision.trim() || null,
          submission_date: submissionDate || null,
        })
        .eq('id', submissionId)
        .eq('project_system_id', systemId)
        .select('id, revision, submission_date, status')
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSubmission(data);
      setRevision(data.revision || '');

      setSubmissionDate(
        data.submission_date
          ? data.submission_date.slice(0, 10)
          : ''
      );

      setSaveMessage('Cover settings saved successfully.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save cover settings'
      );
    } finally {
      setSaving(false);
    }
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

  if (error && (!project || !system || !submission)) {
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
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">

      <div className="mx-auto max-w-5xl">

        {/* Top Navigation */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <button
            type="button"
            onClick={() => router.back()}
            className="text-left text-sm font-medium text-red-700 hover:underline"
          >
            ← Back to Submission
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900"
          >
            Print / Save PDF
          </button>

        </div>

        {/* Cover */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">

          {/* Header */}
          <div className="border-b-4 border-red-800 bg-white px-8 py-7 md:px-12">

            <div className="flex items-start justify-between gap-6">

              <div>
                <div className="text-2xl font-extrabold tracking-tight text-red-800">
                  PETROKIMA
                </div>

                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Engineering & Contracting
                </div>
              </div>

              <div className="text-right text-xs text-gray-500">
                Technical Submittal
              </div>

            </div>

            <div className="mx-auto mt-12 max-w-4xl text-center">

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-700">
                Technical Material Submission
              </p>

              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900">
                {getSystemName()}
              </h1>

              <p className="mt-8 text-2xl font-semibold text-gray-700">
                {project.project_name}
              </p>

              <p className="mt-3 text-base text-gray-500">
                Technical Material Submission
              </p>

            </div>

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

          {/* Footer */}
          <div className="mt-16 border-t bg-gray-50 px-8 py-6 md:px-12">

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

        {/* Cover Controls */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              Cover Controls
            </h2>

            <p className="text-sm text-gray-500">
              Edit the submission-specific information shown on the cover.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">

            <div>
              <label
                htmlFor="revision"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Revision
              </label>

              <input
                id="revision"
                type="text"
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                placeholder="e.g. A"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-1 focus:ring-red-700"
              />
            </div>

            <div>
              <label
                htmlFor="submission-date"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Submission Date
              </label>

              <input
                id="submission-date"
                type="date"
                value={submissionDate}
                onChange={(event) => setSubmissionDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-1 focus:ring-red-700"
              />
            </div>

          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">

            <button
              type="button"
              onClick={handleSaveCoverSettings}
              disabled={saving}
              className="rounded-lg bg-red-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Cover Settings'}
            </button>

            {saveMessage && (
              <p className="text-sm font-medium text-green-700">
                {saveMessage}
              </p>
            )}

          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

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
