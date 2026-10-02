'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

type UserProfile = {
  full_name: string | null;
  role: 'admin' | 'engineer' | 'viewer';
};

export default function Home() {
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();

      console.log('USER:', user);
      console.log('PROFILE:', data);
      console.log('PROFILE ERROR:', error?.message);

      setProfile(data);
    }

    loadProfile();
  }, []);

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

          <div className="text-right">
            <p className="font-medium text-gray-900">
              {profile?.full_name || 'User'}
            </p>

            <p className="text-sm capitalize text-gray-500">
              {profile?.role || 'Loading...'}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-10">
        <h2 className="text-2xl font-semibold text-gray-900">
          Dashboard
        </h2>

        <p className="mt-1 text-gray-600">
          Manage your technical submissions and project database.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-5 h-1.5 w-14 rounded-full bg-red-700" />

            <h3 className="text-xl font-semibold text-gray-900">
              Projects
            </h3>

            <p className="mt-2 text-gray-600">
              Create and manage projects and systems.
            </p>

            <Link
              href="/projects"
              className="mt-6 inline-flex rounded-lg bg-red-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-800"
            >
              Open Projects
            </Link>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-5 h-1.5 w-14 rounded-full bg-red-700" />

            <h3 className="text-xl font-semibold text-gray-900">
              Submissions
            </h3>

            <p className="mt-2 text-gray-600">
              Create, edit and generate technical submissions.
            </p>

            <Link
              href="/submissions"
              className="mt-6 inline-flex rounded-lg bg-red-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-800"
            >
              Open Submissions
            </Link>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-5 h-1.5 w-14 rounded-full bg-red-700" />

            <h3 className="text-xl font-semibold text-gray-900">
              Database
            </h3>

            <p className="mt-2 text-gray-600">
              Products, datasheets, references and company documents.
            </p>

            <Link
              href="/database"
              className="mt-6 inline-flex rounded-lg bg-red-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-800"
            >
              Open Database
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
