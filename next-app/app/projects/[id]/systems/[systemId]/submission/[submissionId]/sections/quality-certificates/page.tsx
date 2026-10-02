'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type CompanyDocument = {
  id: string;
  document_name: string;
  document_type: string;
  description: string | null;
  file_name: string | null;
  file_path: string | null;
  is_active: boolean;
};

type SubmissionContent = {
  id: string;
  title: string;
  source_type: string;
  file_name: string | null;
  file_path: string | null;
};

export default function QualityCertificatesPage() {
  const supabase = createClient();
  const params = useParams();

  const submissionId = params.submissionId as string;

  const [master, setMaster] = useState<CompanyDocument | null>(null);
  const [override, setOverride] = useState<SubmissionContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  async function loadData() {
    setLoading(true);

    const { data: masterData } = await supabase
      .from('company_documents')
      .select(
        'id, document_name, document_type, description, file_name, file_path, is_active'
      )
      .in('document_type', [
        'quality_certificate',
        'iso_certificate',
      ])
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: overrideData } = await supabase
      .from('submission_content')
      .select(
        'id, title, source_type, file_name, file_path'
      )
      .eq('submission_id', submissionId)
      .eq('source_type', 'upload')
      .eq('title', 'Quality Certificates Override')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setMaster(masterData);
    setOverride(overrideData);
    setLoading(false);
  }

  useEffect(() => {
    if (submissionId) {
      loadData();
    }
  }, [submissionId]);

  async function openFile(filePath: string | null) {
    if (!filePath) {
      setMessage('No file is stored for this document.');
      return;
    }

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60 * 10);

    if (error || !data?.signedUrl) {
      setMessage(
        `Could not open file: ${error?.message || 'Unknown error'}`
      );
      return;
    }

    window.open(data.signedUrl, '_blank');
  }

  async function uploadOverride(file: File) {
    if (file.type !== 'application/pdf') {
      setMessage('Please select a PDF file.');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      if (override?.file_path) {
        await supabase.storage
          .from('documents')
          .remove([override.file_path]);
      }

      if (override?.id) {
        await supabase
          .from('submission_content')
          .delete()
          .eq('id', override.id);
      }

      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );

      const path =
        `${submissionId}/quality-certificates/override/` +
        `${Date.now()}-${safeName}`;

      const { error: uploadError } =
        await supabase.storage
          .from('documents')
          .upload(path, file, {
            contentType: 'application/pdf',
            upsert: false,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { error: dbError } = await supabase
        .from('submission_content')
        .insert({
          submission_id: submissionId,
          section_id: null,
          document_id: null,
          title: 'Quality Certificates Override',
          source_type: 'upload',
          file_name: file.name,
          file_path: path,
          content_order: 1,
        });

      if (dbError) {
        await supabase.storage
          .from('documents')
          .remove([path]);

        throw dbError;
      }

      setMessage('Quality Certificates uploaded successfully.');
      await loadData();
    } catch (error: any) {
      setMessage(
        `Upload failed: ${error?.message || 'Unknown error'}`
      );
    } finally {
      setUploading(false);
    }
  }

  async function removeOverride() {
    if (!override) return;

    setMessage('');

    if (override.file_path) {
      await supabase.storage
        .from('documents')
        .remove([override.file_path]);
    }

    const { error } = await supabase
      .from('submission_content')
      .delete()
      .eq('id', override.id);

    if (error) {
      setMessage(`Remove failed: ${error.message}`);
      return;
    }

    setOverride(null);
    setMessage('Override removed successfully.');
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">
          Loading Quality Certificates...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-5xl px-8 py-10">

        <h1 className="text-2xl font-bold text-gray-900">
          Quality Certificates
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Company quality and ISO certificates.
        </p>

        {message && (
          <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Master Quality Certificate
          </h2>

          {master ? (
            <div className="mt-4 rounded-xl border bg-gray-50 p-5">
              <p className="font-medium text-gray-900">
                {master.document_name}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {master.file_name || 'PDF document'}
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openFile(master.file_path)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Open
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              No Master Quality Certificate found.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Submission Override
          </h2>

          {override ? (
            <div className="mt-4 rounded-xl border bg-gray-50 p-5">
              <p className="font-medium text-gray-900">
                {override.file_name}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => openFile(override.file_path)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Open
                </button>

                <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">
                  Replace
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadOverride(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>

                <button
                  onClick={removeOverride}
                  className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) uploadOverride(file);
              }}
              className="mt-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center"
            >
              <p className="text-sm text-gray-500">
                Drag & Drop a PDF here
              </p>

              <label className="mt-4 inline-block cursor-pointer rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white">
                Browse
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadOverride(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
