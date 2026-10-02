'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

type Project = {
  id: string;
  project_name: string;
  client_name: string | null;
  consultant: string | null;
  contractor: string | null;
};

export default function ProjectsPage() {
  const supabase = createClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      const { data, error } = await supabase
        .from('projects')
        .select(
          'id, project_name, client_name, consultant, contractor'
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.error('PROJECTS ERROR:', error.message);
      } else {
        setProjects(data || []);
      }

      setLoading(false);
    }

    loadProjects();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading projects...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">

      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-8 py-5">
          <h1 className="text-2xl font-bold text-gray-900">
            Projects
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage your technical submission projects.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-10">

        <div className="mb-6 flex items-center justify-between">

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Project List
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Select a project to open its details.
            </p>
          </div>

          <a
            href="/projects/new"
            className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            + New Project
          </a>

        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-gray-500">
              No projects found.
            </p>
          </div>
        ) : (
          <div className="grid gap-5">

            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >

                <a
                  href={`/projects/${project.id}`}
                  className="block"
                >
                  <h3 className="text-lg font-semibold text-blue-600 hover:underline">
                    {project.project_name}
                  </h3>
                </a>

                <div className="mt-4 grid gap-4 md:grid-cols-3">

                  <div>
                    <p className="text-xs text-gray-500">
                      Client
                    </p>

                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {project.client_name || '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Consultant
                    </p>

                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {project.consultant || '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Contractor
                    </p>

                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {project.contractor || '-'}
                    </p>
                  </div>

                </div>

              </div>
            ))}

          </div>
        )}

      </div>
    </main>
  );
}