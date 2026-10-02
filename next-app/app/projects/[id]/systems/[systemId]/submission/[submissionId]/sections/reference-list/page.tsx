'use client';

import { DragEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type DocumentRecord = {
  id: string;
  document_name: string;
  file_name: string | null;
  file_path: string | null;
  created_at: string | null;
};

type OverrideRecord = {
  id: string;
  submission_id: string;
  section_id: string;
  document_id: string | null;
  title: string;
  source_type: string;
  file_name: string | null;
  file_path: string | null;
  content_order: number;
  created_at: string | null;
};

const REFERENCE_LIST_TYPE_ID =
  '150ca4b7-9e6c-42f9-8cfa-afc1aeedb1a9';

export default function ReferenceListPage() {
  const params = useParams();

  const projectId = String(params.id);
  const systemId = String(params.systemId);
  const submissionId = String(params.submissionId);

  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [masterDocument, setMasterDocument] =
    useState<DocumentRecord | null>(null);

  const [overrideDocument, setOverrideDocument] =
    useState<OverrideRecord | null>(null);

  const [sectionId, setSectionId] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadReferenceList();
  }, [submissionId]);

  async function loadReferenceList() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data: master, error: masterError } =
        await supabase
          .from('documents_library')
          .select(
            'id, document_name, file_name, file_path, created_at'
          )
          .eq('document_type_id', REFERENCE_LIST_TYPE_ID)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

      if (masterError) {
        throw new Error(
          `Could not load Master Reference List: ${masterError.message}`
        );
      }

      setMasterDocument(master);

      const { data: structure, error: structureError } =
        await supabase
          .from('submission_structures')
          .select('id')
          .eq('submission_id', submissionId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

      if (structureError) {
        throw new Error(
          `Could not load submission structure: ${structureError.message}`
        );
      }

      if (!structure?.id) {
        throw new Error(
          'No submission structure was found for this submission.'
        );
      }

      const { data: section, error: sectionError } =
        await supabase
          .from('submission_sections')
          .select('id, title')
          .eq('structure_id', structure.id)
          .eq('title', 'Reference List')
          .limit(1)
          .maybeSingle();

      if (sectionError) {
        throw new Error(
          `Could not load Reference List section: ${sectionError.message}`
        );
      }

      if (!section?.id) {
        throw new Error(
          'Reference List section was not found in this submission.'
        );
      }

      setSectionId(section.id);

      const { data: override, error: overrideError } =
        await supabase
          .from('submission_content')
          .select(
            `
              id,
              submission_id,
              section_id,
              document_id,
              title,
              source_type,
              file_name,
              file_path,
              content_order,
              created_at
            `
          )
          .eq('submission_id', submissionId)
          .eq('section_id', section.id)
          .eq('source_type', 'upload')
          .order('content_order', { ascending: true })
          .limit(1)
          .maybeSingle();

      if (overrideError) {
        throw new Error(
          `Could not load Submission Override: ${overrideError.message}`
        );
      }

      setOverrideDocument(override);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load Reference List.'
      );
    } finally {
      setLoading(false);
    }
  }

  function chooseFile() {
    if (uploading) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  function handleFileSelected(file?: File) {
    if (!file) return;

    setError('');
    setMessage('');

    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      setError('Reference List must be a PDF file.');
      return;
    }

    setSelectedFile(file);
  }

  function handleInputChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    handleFileSelected(event.target.files?.[0]);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!uploading) {
      setDragging(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (uploading) return;

    handleFileSelected(event.dataTransfer.files?.[0]);
  }

  async function uploadOverride() {
    if (!selectedFile || !sectionId) return;

    setUploading(true);
    setError('');
    setMessage('');

    try {
      if (overrideDocument?.file_path) {
        const { error: oldStorageError } =
          await supabase.storage
            .from('documents')
            .remove([overrideDocument.file_path]);

        if (oldStorageError) {
          throw new Error(
            `Could not remove previous override file: ${oldStorageError.message}`
          );
        }
      }

      const safeFileName = selectedFile.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );

      const filePath =
        `${submissionId}/reference-list/override/` +
        `${Date.now()}-${safeFileName}`;

      const { error: uploadError } =
        await supabase.storage
          .from('documents')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
            contentType:
              selectedFile.type || 'application/pdf',
          });

      if (uploadError) {
        throw new Error(
          `Storage upload failed: ${uploadError.message}`
        );
      }

      if (overrideDocument) {
        const { error: deleteError } =
          await supabase
            .from('submission_content')
            .delete()
            .eq('id', overrideDocument.id);

        if (deleteError) {
          await supabase.storage
            .from('documents')
            .remove([filePath]);

          throw new Error(
            `Could not replace previous override: ${deleteError.message}`
          );
        }
      }

      const { data: insertedOverride, error: insertError } =
        await supabase
          .from('submission_content')
          .insert({
            submission_id: submissionId,
            section_id: sectionId,
            document_id: null,
            title: 'Reference List',
            source_type: 'upload',
            file_name: selectedFile.name,
            file_path: filePath,
            content_order: 1,
          })
          .select(
            `
              id,
              submission_id,
              section_id,
              document_id,
              title,
              source_type,
              file_name,
              file_path,
              content_order,
              created_at
            `
          )
          .single();

      if (insertError) {
        await supabase.storage
          .from('documents')
          .remove([filePath]);

        throw new Error(
          `Database registration failed: ${insertError.message}`
        );
      }

      setOverrideDocument(insertedOverride);
      setSelectedFile(null);

      setMessage(
        'Submission Reference List override saved successfully.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save Submission Override.'
      );
    } finally {
      setUploading(false);
    }
  }

  async function openMaster() {
    if (!masterDocument?.file_path) return;

    setError('');

    const { data, error } =
      await supabase.storage
        .from('documents')
        .createSignedUrl(
          masterDocument.file_path,
          60 * 10
        );

    if (error || !data?.signedUrl) {
      setError(
        `Could not open Master Reference List: ${
          error?.message || 'No signed URL returned.'
        }`
      );
      return;
    }

    window.open(
      data.signedUrl,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async function openOverride() {
    if (!overrideDocument?.file_path) return;

    setError('');

    const { data, error } =
      await supabase.storage
        .from('documents')
        .createSignedUrl(
          overrideDocument.file_path,
          60 * 10
        );

    if (error || !data?.signedUrl) {
      setError(
        `Could not open Submission Override: ${
          error?.message || 'No signed URL returned.'
        }`
      );
      return;
    }

    window.open(
      data.signedUrl,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async function removeOverride() {
    if (!overrideDocument) return;

    const confirmed = window.confirm(
      'Remove the Submission Override? The Master Reference List will remain unchanged.'
    );

    if (!confirmed) return;

    setUploading(true);
    setError('');
    setMessage('');

    try {
      if (overrideDocument.file_path) {
        const { error: storageError } =
          await supabase.storage
            .from('documents')
            .remove([overrideDocument.file_path]);

        if (storageError) {
          throw new Error(
            `Could not remove override file: ${storageError.message}`
          );
        }
      }

      const { error: deleteError } =
        await supabase
          .from('submission_content')
          .delete()
          .eq('id', overrideDocument.id);

      if (deleteError) {
        throw new Error(
          `Could not remove override record: ${deleteError.message}`
        );
      }

      setOverrideDocument(null);
      setSelectedFile(null);

      setMessage(
        'Submission Override removed. The Master Reference List will be used.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not remove Submission Override.'
      );
    } finally {
      setUploading(false);
    }
  }

  function backToSubmission() {
    window.location.href =
      `/projects/${projectId}` +
      `/systems/${systemId}` +
      `/submission/${submissionId}`;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Reference List
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Master Reference List with optional Submission Override.
            </p>
          </div>

          <button
            type="button"
            onClick={backToSubmission}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to Submission
          </button>
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
            Loading Reference List...
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                <div>
                  <div className="mb-2 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    MASTER DOCUMENT
                  </div>

                  {masterDocument ? (
                    <>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {masterDocument.document_name}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {masterDocument.file_name ||
                          'Reference List PDF'}
                      </p>

                      <p className="mt-2 text-xs text-slate-400">
                        Company Master Reference List. This file
                        is not changed by Submission Override.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold text-slate-900">
                        No Master Reference List
                      </h2>

                      <p className="mt-2 text-sm text-slate-500">
                        No Master Reference List is currently
                        registered in the database.
                      </p>
                    </>
                  )}
                </div>

                {masterDocument && (
                  <button
                    type="button"
                    onClick={openMaster}
                    disabled={uploading}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Open Master
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">

              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                <div>
                  <div className="mb-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    SUBMISSION OVERRIDE
                  </div>

                  {overrideDocument ? (
                    <>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {overrideDocument.title}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {overrideDocument.file_name ||
                          'Reference List PDF'}
                      </p>

                      <p className="mt-2 text-xs text-blue-600">
                        This file will be used for this Submission
                        instead of the Master.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold text-slate-900">
                        Using Master Reference List
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        No Submission Override has been added.
                      </p>

                      <p className="mt-2 text-xs text-slate-400">
                        This Submission will automatically use the
                        Master Reference List.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">

                  {overrideDocument && (
                    <>
                      <button
                        type="button"
                        onClick={openOverride}
                        disabled={uploading}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Open Override
                      </button>

                      <button
                        type="button"
                        onClick={removeOverride}
                        disabled={uploading}
                        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove Override
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={chooseFile}
                    disabled={uploading}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {overrideDocument
                      ? 'Replace Override'
                      : 'Add Override'}
                  </button>

                </div>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-6 rounded-xl border-2 border-dashed p-6 text-center transition ${
                  dragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 bg-slate-50'
                }`}
              >
                <p className="text-sm font-medium text-slate-700">
                  Drag & Drop a Submission Reference List here
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  This creates or replaces an override for this
                  Submission only. The Master remains unchanged.
                </p>

                <button
                  type="button"
                  onClick={chooseFile}
                  disabled={uploading}
                  className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Browse File
                </button>
              </div>
            </section>
          </>
        )}

        {selectedFile && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Selected File
                </p>

                <p className="mt-1 text-sm text-blue-800">
                  {selectedFile.name}
                </p>

                <p className="mt-1 text-xs text-blue-600">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="flex gap-2">

                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  disabled={uploading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={uploadOverride}
                  disabled={uploading || !sectionId}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading
                    ? 'Uploading...'
                    : overrideDocument
                      ? 'Replace Override'
                      : 'Save Override'}
                </button>

              </div>
            </div>
          </section>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <strong>How it works:</strong>{' '}
          The Master Reference List is stored in the company
          document library. Each Submission can optionally have
          its own Reference List Override. If no override exists,
          the Submission automatically uses the Master.
        </div>

      </div>
    </main>
  );
}