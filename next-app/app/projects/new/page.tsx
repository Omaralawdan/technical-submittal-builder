'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function NewProjectPage() {
  const supabase = createClient();
  const router = useRouter();

  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [consultant, setConsultant] = useState('');
  const [contractor, setContractor] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!projectName.trim()) {
      setError('Project Name is required.');
      return;
    }

    setLoading(true);
    setError('');

    const { error } = await supabase.from('projects').insert({
      project_name: projectName.trim(),
      client_name: clientName.trim() || null,
      consultant: consultant.trim() || null,
      contractor: contractor.trim() || null,
    });

    if (error) {
      console.error('CREATE PROJECT ERROR:', error.message);
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/projects');
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-8 py-5">
          <h1 className="text-2xl font-bold text-gray-900">
            New Project
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create a new project.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <form onSubmit={handleCreate} className="space-y-6">

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Project Name *
              </label>

              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Enter project name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Client Name
              </label>

              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Enter client name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Consultant
              </label>

              <input
                type="text"
                value={consultant}
                onChange={(e) => setConsultant(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Enter consultant"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Contractor
              </label>

              <input
                type="text"
                value={contractor}
                onChange={(e) => setContractor(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Enter contractor"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push('/projects')}
                className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Project'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </main>
  );
}