'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import SectionShell from '../components/SectionShell';

export default function MaterialSelectionPage() {
  const params = useParams();
  const supabase = createClient();

  const submissionId = params.submissionId as string;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [savedFile, setSavedFile] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const storageFolder = `${submissionId}/material-selection`;

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

    setSavedFile(data && data.length > 0 ? data[0].name : null);
    setLoading(false);
  }

  function selectFile(selectedFiles: FileList | null) {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setFile(selectedFiles[0]);
    setMessage('');
    setError('');
  }

  function openPicker() {
    if (!fileInputRef.current) return;

    fileInputRef.current.value = '';
    fileInputRef.current.click();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);
    selectFile(event.dataTransfer.files);
  }

  async function uploadFile() {
    if (!file) return;

    setUploading(true);
    setMessage('');
    setError('');

    try {
      if (savedFile) {
        const { error: removeError } = await supabase.storage
          .from('documents')
          .remove([`${storageFolder}/${savedFile}`]);

        if (removeError) throw removeError;
      }

      const extension = file.name.includes('.')
        ? file.name.split('.').pop()
        : 'file';

      const filePath = `${storageFolder}/material-selection.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || undefined,
        });

      if (uploadError) throw uploadError;

      setSavedFile(`material-selection.${extension}`);
      setFile(null);
      setMessage(
        savedFile
          ? 'Material Selection replaced successfully.'
          : 'Material Selection uploaded successfully.'
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function openFile() {
    if (!savedFile) return;

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(`${storageFolder}/${savedFile}`, 600);

    if (error) {
      setError(error.message);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  }

  async function removeFile() {
    if (!savedFile) return;

    setUploading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.storage
      .from('documents')
      .remove([`${storageFolder}/${savedFile}`]);

    if (error) {
      setError(error.message);
    } else {
      setSavedFile(null);
      setMessage('Material Selection removed successfully.');
    }

    setUploading(false);
  }

  function cancelFile() {
    setFile(null);
    setMessage('');
    setError('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <SectionShell
      title="Material Selection / Technical Selection"
      subtitle="Database content can be used when available, with manual file upload as a fallback."
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Material Selection
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            If the required material selection is not available from the
            database, you can upload it manually.
          </p>

          {loading ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              Loading...
            </div>
          ) : savedFile ? (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-green-700">
                    Material Selection Available
                  </div>

                  <div className="mt-1 break-all text-sm font-semibold text-slate-900">
                    {savedFile}
                  </div>

                  <div className="mt-1 text-xs text-green-700">
                    You can open it, replace it, or remove it.
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
                    onClick={openPicker}
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
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              className={`mt-6 rounded-2xl border-2 border-dashed p-10 text-center transition ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 bg-slate-50'
              }`}
            >
              <div className="text-4xl">📄</div>

              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                No Material Selection Found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Drag & Drop your file here or browse your computer.
              </p>

              <button
                type="button"
                onClick={openPicker}
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
            className="hidden"
            onChange={(event) => selectFile(event.target.files)}
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
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelFile}
                    disabled={uploading}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
      </div>
    </SectionShell>
  );
}
