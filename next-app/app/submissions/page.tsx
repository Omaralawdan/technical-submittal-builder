'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

type Submission = {
  id: string;
  revision: string | null;
  submission_date: string | null;
  status: string | null;
  project_system_id: string;
  project_systems: {
    id: string;
    custom_system_name: string | null;
    project_id: string | null;
    systems: {
      name: string | null;
    } | null;
    projects: {
      id: string;
      project_name: string;
    } | null;
  } | null;
};

export default function SubmissionsPage() {
  const supabase = createClient();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadSubmissions() {
      setLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('submissions')
        .select(
          `
            id,
            revision,
            submission_date,
            status,
            project_system_id,
            project_systems (
              id,
              custom_system_name,
              project_id,
              systems (
                name
              ),
              projects (
                id,
                project_name
              )
            )
          `
        )
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error('SUBMISSIONS ERROR:', error.message);
        setErrorMessage(
          `Could not load submissions: ${error.message}`
        );
        setSubmissions([]);
      } else {
        setSubmissions(
          (data || []) as unknown as Submission[]
        );
      }

      setLoading(false);
    }

    loadSubmissions();
  }, []);

  function getSystemName(
    submission: Submission
  ) {
    return (
      submission.project_systems?.custom_system_name ||
      submission.project_systems?.systems?.name ||
      'System'
    );
  }

  function getProjectName(
    submission: Submission
  ) {
    return (
      submission.project_systems?.projects?.project_name ||
      'Project'
    );
  }

  function formatDate(
    date: string | null
  ) {
    if (!date) return '—';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString('en-GB');
  }

  function getStatusClass(
    status: string | null
  ) {
    switch ((status || '').toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-700';

      case 'submitted':
        return 'bg-blue-100 text-blue-700';

      case 'rejected':
        return 'bg-red-100 text-red-700';

      case 'draft':
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

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
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Submissions
            </h2>

            <p className="mt-1 text-gray-600">
              View and open all technical submittals.
            </p>
          </div>

          <Link
            href="/projects"
            className="inline-flex w-fit rounded-lg bg-red-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-800"
          >
            + Create from Project
          </Link>
        </div>

        {loading && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
            Loading submissions...
          </div>
        )}

        {!loading && errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <p className="font-medium">
              Could not load submissions.
            </p>

            <p className="mt-1 text-sm">
              {errorMessage}
            </p>
          </div>
        )}

        {!loading &&
          !errorMessage &&
          submissions.length === 0 && (
            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10 text-center">
              <div className="mx-auto h-1.5 w-14 rounded-full bg-red-700" />

              <h3 className="mt-5 text-xl font-semibold text-gray-900">
                No submissions yet
              </h3>

              <p className="mt-2 text-gray-600">
                Create your first technical submittal from a
                project system.
              </p>

              <Link
                href="/projects"
                className="mt-6 inline-flex rounded-lg bg-red-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-800"
              >
                Open Projects
              </Link>
            </div>
          )}

        {!loading &&
          !errorMessage &&
          submissions.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px]">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Project
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        System
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Revision
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Date
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {submissions.map((submission) => {
                      const projectId =
                        submission.project_systems
                          ?.project_id;

                      const systemId =
                        submission.project_systems?.id;

                      return (
                        <tr
                          key={submission.id}
                          className="transition hover:bg-gray-50"
                        >
                          <td className="px-6 py-5">
                            <div className="font-medium text-gray-900">
                              {getProjectName(
                                submission
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-5">
                            <div className="text-gray-700">
                              {getSystemName(
                                submission
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-5 text-gray-700">
                            {submission.revision || '—'}
                          </td>

                          <td className="px-6 py-5 text-gray-700">
                            {formatDate(
                              submission.submission_date
                            )}
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                                submission.status
                              )}`}
                            >
                              {submission.status ||
                                'Draft'}
                            </span>
                          </td>

                          <td className="px-6 py-5 text-right">
                            {projectId && systemId ? (
                              <Link
                                href={`/projects/${projectId}/systems/${systemId}/submission/${submission.id}`}
                                className="inline-flex rounded-lg border border-red-700 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                              >
                                Open
                              </Link>
                            ) : (
                              <span className="text-sm text-gray-400">
                                Unavailable
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 text-sm text-gray-500">
                Total submissions: {submissions.length}
              </div>
            </div>
          )}
      </div>
    </main>
  );
}
