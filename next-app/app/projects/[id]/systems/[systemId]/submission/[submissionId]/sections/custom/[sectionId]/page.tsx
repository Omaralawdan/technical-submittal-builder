'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type Section = {
  id: string;
  title: string;
  section_order: number;
  is_custom: boolean;
};

type SubmissionContent = {
  id: string;
  submission_id: string;
  section_id: string;
  document_id: string | null;
  title: string;
  source_type: string;
  file_name: string | null;
  file_path: string | null;
  content_order: number;
};

export default function CustomSectionPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;
  const systemId = params.systemId as string;
  const submissionId = params.submissionId as string;
  const sectionId = params.sectionId as string;

  const supabase = createClient();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [section, setSection] = useState<Section | null>(null);
  const [content, setContent] = useState<SubmissionContent | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSection();
  }, [sectionId, submissionId]);

  async function loadSection() {
    try {
      setLoading(true);
      setError('');

      const { data: sectionData, error: sectionError } =
        await supabase
          .from('submission_sections')
          .select(
            'id, title, section_order, is_custom'
          )
          .eq('id', sectionId)
          .single();

      if (sectionError) {
        throw sectionError;
      }

      if (!sectionData) {
        throw new Error('Custom Section was not found.');
      }

      if (!sectionData.is_custom) {
        throw new Error(
          'This section is not a Custom Section.'
        );
      }

      setSection(sectionData);

      const { data: contentData, error: contentError } =
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
              content_order
            `
          )
          .eq('submission_id', submissionId)
          .eq('section_id', sectionId)
          .order('content_order', {
            ascending: true,
          })
          .limit(1)
          .maybeSingle();

      if (contentError) {
        throw contentError;
      }

      setContent(contentData || null);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not load Custom Section.'
      );
    } finally {
      setLoading(false);
    }
  }

  function backToSubmission() {
    router.push(
      `/projects/${projectId}` +
        `/systems/${systemId}` +
        `/submission/${submissionId}`
    );
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileInput(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    uploadFile(file);

    event.target.value = '';
  }

  function handleDragOver(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    setDragging(true);
  }

  function handleDragLeave(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    setDragging(false);
  }

  function handleDrop(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    setDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    uploadFile(file);
  }

  async function uploadFile(file: File) {
    try {
      setUploading(true);
      setError('');
      setMessage('');

      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_');

      const filePath =
        `${submissionId}/custom-sections/` +
        `${sectionId}/` +
        `${Date.now()}-${safeFileName}`;

      /*
       * Upload to private Supabase Storage bucket.
       */
      const { error: uploadError } =
        await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

      if (uploadError) {
        throw uploadError;
      }

      /*
       * If this Custom Section already has content,
       * remove the old database record.
       *
       * We intentionally do not delete the old storage
       * file here because keeping it avoids accidental
       * data loss.
       */
      if (content) {
        const { error: deleteError } =
          await supabase
            .from('submission_content')
            .delete()
            .eq('id', content.id);

        if (deleteError) {
          console.error(
            'Could not remove old content record:',
            deleteError
          );
        }
      }

      /*
       * Insert the new uploaded content.
       *
       * source_type MUST be "upload"
       * because of the database CHECK constraint.
       */
      const { data: newContent, error: insertError } =
        await supabase
          .from('submission_content')
          .insert({
            submission_id: submissionId,
            section_id: sectionId,
            document_id: null,
            title: file.name,
            source_type: 'upload',
            file_name: file.name,
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
              content_order
            `
          )
          .single();

      if (insertError) {
        /*
         * If database insert fails, remove the uploaded
         * storage file so we don't leave an orphan file.
         */
        await supabase.storage
          .from('documents')
          .remove([filePath]);

        throw insertError;
      }

      setContent(newContent);

      setMessage(
        'File uploaded successfully.'
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not upload the file.'
      );
    } finally {
      setUploading(false);
    }
  }

  async function openUploadedFile() {
    if (!content?.file_path) {
      return;
    }

    try {
      setError('');

      const { data, error: signedUrlError } =
        await supabase.storage
          .from('documents')
          .createSignedUrl(
            content.file_path,
            60 * 10
          );

      if (signedUrlError) {
        throw signedUrlError;
      }

      if (!data?.signedUrl) {
        throw new Error(
          'Could not create file access link.'
        );
      }

      window.open(
        data.signedUrl,
        '_blank',
        'noopener,noreferrer'
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not open the file.'
      );
    }
  }

  async function removeFile() {
    if (!content) {
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to remove this file?'
    );

    if (!confirmed) {
      return;
    }

    try {
      setError('');
      setMessage('');

      /*
       * Remove database record first.
       */
      const { error: deleteError } =
        await supabase
          .from('submission_content')
          .delete()
          .eq('id', content.id);

      if (deleteError) {
        throw deleteError;
      }

      /*
       * Then remove the actual file from Storage.
       */
      if (content.file_path) {
        const { error: storageError } =
          await supabase.storage
            .from('documents')
            .remove([
              content.file_path,
            ]);

        if (storageError) {
          console.error(
            'Storage delete error:',
            storageError
          );
        }
      }

      setContent(null);

      setMessage(
        'File removed successfully.'
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not remove the file.'
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-slate-500">
              Loading Custom Section...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !section) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">

          <button
            type="button"
            onClick={backToSubmission}
            className="mb-6 text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to Submission
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-semibold text-red-800">
              Could not load Custom Section
            </h1>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">

        <button
          type="button"
          onClick={backToSubmission}
          className="mb-6 text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to Submission
        </button>

        <div className="rounded-2xl bg-white p-8 shadow-sm">

          {/* Header */}
          <div className="mb-8">

            <p className="text-sm font-medium text-purple-600">
              Custom Section
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {section?.title}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Section{' '}
              {String(
                section?.section_order || 0
              ).padStart(2, '0')}
            </p>

          </div>

          {/* Messages */}
          {message && (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!content ? (

            /*
             * Upload Area
             */
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={[
                'rounded-2xl border-2 border-dashed p-12 text-center transition',
                dragging
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-slate-300 bg-slate-50',
              ].join(' ')}
            >

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileInput}
              />

              <div className="mx-auto max-w-xl">

                <div className="mb-4 text-4xl">
                  📄
                </div>

                <h2 className="text-xl font-semibold text-slate-800">
                  Upload {section?.title}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Drag & Drop your file here
                </p>

                <p className="my-3 text-sm text-slate-400">
                  or
                </p>

                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={uploading}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading
                    ? 'Uploading...'
                    : 'Browse'}
                </button>

                <p className="mt-4 text-xs text-slate-400">
                  You can upload PDF, Word, Excel,
                  images, or other project documents.
                </p>

              </div>

            </div>

          ) : (

            /*
             * Uploaded File
             */
            <div className="rounded-2xl border border-slate-200 bg-white p-6">

              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex min-w-0 items-center gap-4">

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-2xl">
                    📄
                  </div>

                  <div className="min-w-0">

                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Uploaded File
                    </p>

                    <p className="mt-1 truncate text-base font-semibold text-slate-800">
                      {content.file_name ||
                        content.title}
                    </p>

                  </div>

                </div>

                <div className="flex flex-wrap gap-2">

                  <button
                    type="button"
                    onClick={openUploadedFile}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </button>

                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={uploading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading
                      ? 'Uploading...'
                      : 'Replace'}
                  </button>

                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={uploading}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>

                </div>

              </div>

              {/* Hidden input for Replace */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileInput}
              />

              {/* Replace Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={[
                  'mt-6 rounded-xl border border-dashed p-5 text-center transition',
                  dragging
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 bg-slate-50',
                ].join(' ')}
              >
                <p className="text-sm text-slate-500">
                  Drag & Drop another file here to replace
                  the current file
                </p>
              </div>

            </div>

          )}

        </div>

      </div>
    </main>
  );
}