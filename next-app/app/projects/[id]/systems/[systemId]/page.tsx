'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type Project = {
  id: string;
  project_name: string;
  client_name: string | null;
  consultant: string | null;
  contractor: string | null;
};

type ProjectSystem = {
  id: string;
  custom_system_name: string | null;
  system_id: string | null;
  systems: {
    id: string;
    name: string;
    description: string | null;
  } | null;
};

type Submission = {
  id: string;
  revision: string | null;
  submission_date: string | null;
  status: string;
};

export default function SystemPage() {
  const supabase = createClient();
  const params = useParams();

  const projectId = params.id as string;
  const systemId = params.systemId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [projectSystem, setProjectSystem] =
    useState<ProjectSystem | null>(null);

  const [submissions, setSubmissions] =
    useState<Submission[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadSystem() {
      setLoading(true);
      setErrorMessage('');

      const [projectResult, systemResult] =
        await Promise.all([
          supabase
            .from('projects')
            .select(
              'id, project_name, client_name, consultant, contractor'
            )
            .eq('id', projectId)
            .single(),

          supabase
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
            .single(),
        ]);

      if (projectResult.error) {
        console.error(
          'PROJECT ERROR:',
          projectResult.error.message
        );

        setErrorMessage(
          `Could not load project: ${projectResult.error.message}`
        );
      } else {
        setProject(projectResult.data);
      }

      if (systemResult.error) {
        console.error(
          'SYSTEM ERROR:',
          systemResult.error.message
        );

        setErrorMessage(
          `Could not load system: ${systemResult.error.message}`
        );
      } else {
        setProjectSystem(
          systemResult.data as unknown as ProjectSystem
        );

        const { data: submissionsData, error: submissionsError } =
          await supabase
            .from('submissions')
            .select(
              'id, revision, submission_date, status'
            )
            .eq('project_system_id', systemId)
            .order('created_at', {
              ascending: false,
            });

        if (submissionsError) {
          console.error(
            'SUBMISSIONS ERROR:',
            submissionsError.message
          );
        } else {
          setSubmissions(submissionsData || []);
        }
      }

      setLoading(false);
    }

    if (projectId && systemId) {
      loadSystem();
    }
  }, [projectId, systemId]);

  const systemName =
    projectSystem?.custom_system_name ||
    projectSystem?.systems?.name ||
    'System';

  const systemDescription =
    projectSystem?.custom_system_name
      ? 'Custom system'
      : projectSystem?.systems?.description ||
        'No description available.';

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">
          Loading system...
        </p>
      </main>
    );
  }

  if (errorMessage || !project || !projectSystem) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">

          <h1 className="text-xl font-semibold text-red-600">
            Unable to load system
          </h1>

          <p className="mt-3 text-gray-600">
            {errorMessage || 'System not found.'}
          </p>

          <a
            href={`/projects/${projectId}`}
            className="mt-6 inline-block rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white"
          >
            ← Back to Project
          </a>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">

      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-8 py-5">

          <a
            href={`/projects/${projectId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Project
          </a>

          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            {systemName}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            {project.project_name}
          </p>

        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-10">

        {/* System Information */}

        <div className="rounded-2xl bg-white p-8 shadow-sm">

          <div className="flex items-start justify-between">

            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                System Information
              </h2>

              <p className="mt-2 text-gray-500">
                {systemDescription}
              </p>
            </div>

            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Active
            </span>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">

            <div>
              <p className="text-sm text-gray-500">
                Project
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {project.project_name}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                System
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {systemName}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Client
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {project.client_name || '-'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Consultant
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {project.consultant || '-'}
              </p>
            </div>

          </div>

        </div>

        {/* Submissions */}

        <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Submissions
              </h2>

              <p className="mt-2 text-gray-500">
                Create and manage technical submissions
                for this system.
              </p>
            </div>

            <a
              href={`/projects/${projectId}/systems/${systemId}/submission/new`}
              className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              + Create Submission
            </a>

          </div>

          {submissions.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">

              <p className="font-medium text-gray-700">
                No submission created yet
              </p>

              <p className="mt-2 text-sm text-gray-500">
                Create a submission to start building
                the technical submittal.
              </p>

            </div>
          ) : (
            <div className="mt-6 space-y-4">

              {submissions.map((submission) => (
                <a
                  key={submission.id}
                  href={`/projects/${projectId}/systems/${systemId}/submission/${submission.id}`}
                  className="block rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-400 hover:bg-gray-50"
                >

                  <div className="flex items-center justify-between">

                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Revision{' '}
                        {submission.revision || '-'}
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        Date:{' '}
                        {submission.submission_date || '-'}
                      </p>
                    </div>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {submission.status}
                    </span>

                  </div>

                </a>
              ))}

            </div>
          )}

        </div>

      </div>

    </main>
  );
}