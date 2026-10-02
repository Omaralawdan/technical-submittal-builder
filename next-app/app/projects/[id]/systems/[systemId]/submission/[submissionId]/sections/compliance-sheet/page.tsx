'use client';

import { DragEvent, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function ComplianceSheetPage() {
  const params = useParams();
  const router = useRouter();

  const submissionId = params.submissionId as string;

  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [savedFile, setSavedFile] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const storageFolder = `${submissionId}/compliance-sheet`;

  useEffect(() => {
    loadExistingFile();
  }, []);

  async function loadExistingFile() {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase.storage
        .from('documents')
        .list(storageFolder, {
          limit: 100,
          sortBy: {
            column: 'created_at',
            order: 'desc',
          },
        });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setSavedFile(data[0].name);
      } else {
        setSavedFile(null);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not load existing file.');
    } finally {
      setLoading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setFile(files[0]);
    setError('');
    setMessage('');
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);

    handleFiles(event.dataTransfer.files);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);
  }

  async function uploadFile() {
    if (!file) {
      return;
    }

    try {
      setUploading(true);
      setError('');
      setMessage('');

      /*
       * If a previous file exists, remove it first.
       * This makes Replace a real replacement.
       */
      if (savedFile) {
        const oldPath = `${storageFolder}/${savedFile}`;

        const { error: removeOldError } =
          await supabase.storage
            .from('documents')
            .remove([oldPath]);

        if (removeOldError) {
          throw removeOldError;
        }
      }

      const extension =
        file.name.includes('.')
          ? file.name.split('.').pop()
          : 'file';

      const filePath =
        `${storageFolder}/compliance-sheet.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type || undefined,
          });

      if (uploadError) {
        throw uploadError;
      }

      setSavedFile(`compliance-sheet.${extension}`);
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setMessage('Compliance Sheet uploaded successfully.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function removeFile() {
    if (!savedFile) {
      return;
    }

    try {
      setUploading(true);
      setError('');
      setMessage('');

      const filePath = `${storageFolder}/${savedFile}`;

      const { error: removeError } =
        await supabase.storage
          .from('documents')
          .remove([filePath]);

      if (removeError) {
        throw removeError;
      }

      setSavedFile(null);

      setMessage('Compliance Sheet removed.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not remove file.');
    } finally {
      setUploading(false);
    }
  }

  async function openFile() {
    if (!savedFile) {
      return;
    }

    try {
      setError('');

      const filePath = `${storageFolder}/${savedFile}`;

      const { data, error: signedUrlError } =
        await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 60 * 10);

      if (signedUrlError) {
        throw signedUrlError;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not open file.');
    }
  }

  function cancelSelectedFile() {
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setMessage('');
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">

        <button
          onClick={() => router.back()}
          className="mb-6 text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back
        </button>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-blue-600">
            Technical Submittal
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            03 — Compliance Sheet
          </h1>

          <p className="mt-2 text-slate-500">
            Upload the project compliance sheet for this submission.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">

          {loading ? (
            <div className="rounded-xl bg-slate-50 p-10 text-center">
              <p className="text-slate-500">
                Loading...
              </p>
            </div>
          ) : (
            <>
              {savedFile && !file && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-6">

                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                    <div className="flex items-center gap-4">

                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-xl">
                        📄
                      </div>

                      <div>
                        <p className="text-sm font-medium text-green-700">
                          Compliance Sheet
                        </p>

                        <p className="mt-1 font-semibold text-slate-900">
                          {savedFile}
                        </p>

                        <p className="mt-1 text-xs text-green-700">
                          File uploaded successfully
                        </p>
                      </div>

                    </div>

                    <div className="flex flex-wrap gap-2">

                      <button
                        onClick={openFile}
                        disabled={uploading}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Open
                      </button>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Replace
                      </button>

                      <button
                        onClick={removeFile}
                        disabled={uploading}
                        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>

                    </div>

                  </div>

                </div>
              )}

              {!savedFile && !file && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-2xl border-2 border-dashed p-14 text-center transition ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >

                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl">
                    📄
                  </div>

                  <h2 className="mt-5 text-xl font-semibold text-slate-900">
                    Drag & Drop your Compliance Sheet
                  </h2>

                  <p className="mt-2 text-slate-500">
                    Drop your file anywhere in this area
                  </p>

                  <p className="my-4 text-sm font-medium text-slate-400">
                    OR
                  </p>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Browse File
                  </button>

                  <p className="mt-4 text-xs text-slate-400">
                    PDF, Excel, Word or other project document
                  </p>

                </div>
              )}

              {file && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">

                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <div>
                      <p className="text-sm font-medium text-blue-700">
                        {savedFile
                          ? 'Replacement File'
                          : 'Selected File'}
                      </p>

                      <p className="mt-1 font-semibold text-slate-900">
                        {file.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <div className="flex gap-2">

                      <button
                        onClick={cancelSelectedFile}
                        disabled={uploading}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={uploadFile}
                        disabled={uploading}
                        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {uploading
                          ? 'Uploading...'
                          : savedFile
                            ? 'Replace File'
                            : 'Upload'}
                      </button>

                    </div>

                  </div>

                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  handleFiles(event.target.files);
                }}
              />
            </>
          )}

          {message && (
            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}