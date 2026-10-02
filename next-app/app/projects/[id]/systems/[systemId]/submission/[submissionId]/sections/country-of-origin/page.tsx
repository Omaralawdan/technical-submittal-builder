'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import SectionShell from '../components/SectionShell';

export default function CountryOfOriginPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const projectId = params.id as string;
  const systemId = params.systemId as string;
  const submissionId = params.submissionId as string;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [savedFile, setSavedFile] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const storageFolder = `${submissionId}/country-of-origin`;

  useEffect(() => {
    loadExistingFile();
  }, [submissionId]);

  async function loadExistingFile() {
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
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      setSavedFile(data[0].name);
    } else {
      setSavedFile(null);
    }

    setLoading(false);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setFile(files[0]);
    setMessage('');
    setError('');
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  async function uploadFile() {
    if (!file) return;

    setUploading(true);
    setMessage('');
    setError('');

    try {
      if (savedFile) {
        const oldPath = `${storageFolder}/${savedFile}`;

        const { error: removeOldError } = await supabase.storage
          .from('documents')
          .remove([oldPath]);

        if (removeOldError) {
          throw removeOldError;
        }
      }

      const extension = file.name.includes('.')
        ? file.name.split('.').pop()
        : 'file';

      const filePath = `${storageFolder}/country-of-origin.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        throw uploadError;
      }

      setSavedFile(`country-of-origin.${extension}`);
      setFile(null);
      setMessage('Country of Origin file uploaded successfully.');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to upload file.');
    } finally {
      setUploading(false);
    }
  }

  async function removeFile() {
    if (!savedFile) return;

    setUploading(true);
    setMessage('');
    setError('');

    try {
      const filePath = `${storageFolder}/${savedFile}`;

      const { error: removeError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (removeError) {
        throw removeError;
      }

      setSavedFile(null);
      setFile(null);
      setMessage('Country of Origin file removed successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to remove file.');
    } finally {
      setUploading(false);
    }
  }

  async function openFile() {
    if (!savedFile) return;

    setError('');

    const filePath = `${storageFolder}/${savedFile}`;

    const { data, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60 * 10);

    if (signedUrlError) {
      setError(signedUrlError.message);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  }

  function cancelSelectedFile() {
    setFile(null);
    setMessage('');
    setError('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function openFilePicker() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  return (
    <SectionShell
      title="Country of Origin"
      subtitle="Upload and manage the Country of Origin document for this submission."
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Country of Origin Document
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload the approved Country of Origin document for this submission.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Loading...
            </div>
          ) : savedFile ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-green-700">
                    Uploaded File
                  </div>

                  <div className="mt-1 break-all text-sm font-semibold text-slate-900">
                    {savedFile}
                  </div>

                  <div className="mt-1 text-xs text-green-700">
                    File is stored in this submission.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openFile}
                    disabled={uploading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Open
                  </button>

                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={uploading}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Replace
                  </button>

                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={uploading}
                    className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 bg-slate-50'
              }`}
            >
              <div className="text-4xl">📄</div>

              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                Drag & Drop Country of Origin File
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                or browse your computer to select a file
              </p>

              <button
                type="button"
                onClick={openFilePicker}
                disabled={uploading}
                className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Browse File
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            id="country-of-origin-file"
            className="hidden"
            onChange={(event) => {
              handleFiles(event.target.files);
            }}
          />

          {file && (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-700">
                    {savedFile ? 'Replacement File' : 'Selected File'}
                  </div>

                  <div className="mt-1 break-all text-sm font-semibold text-slate-900">
                    {file.name}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={cancelSelectedFile}
                    disabled={uploading}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={uploadFile}
                    disabled={uploading}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {uploading
                      ? 'Uploading...'
                      : savedFile
                        ? 'Replace File'
                        : 'Upload File'}
                  </button>
                </div>
              </div>
            </div>
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

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to Submission
          </button>
        </div>
      </div>
    </SectionShell>
  );
}
