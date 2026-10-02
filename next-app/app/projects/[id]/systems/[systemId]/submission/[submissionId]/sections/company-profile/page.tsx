'use client';

import { DragEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type CompanyDocument = {
  id: string;
  document_name: string;
  document_type: string;
  description: string | null;
  file_name: string | null;
  file_path: string | null;
  expiry_date: string | null;
  is_active: boolean;
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

export default function CompanyProfilePage() {
  const params = useParams();

  const projectId = params.id as string;
  const systemId = params.systemId as string;
  const submissionId = params.submissionId as string;

  const supabase = createClient();

  const masterInputRef = useRef<HTMLInputElement | null>(null);
  const overrideInputRef = useRef<HTMLInputElement | null>(null);

  const [masterDocument, setMasterDocument] =
    useState<CompanyDocument | null>(null);

  const [override, setOverride] =
    useState<SubmissionContent | null>(null);

  const [sectionId, setSectionId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploadingMaster, setUploadingMaster] = useState(false);
  const [uploadingOverride, setUploadingOverride] = useState(false);

  const [masterDragActive, setMasterDragActive] = useState(false);
  const [overrideDragActive, setOverrideDragActive] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadPage() {
    try {
      setLoading(true);
      setError('');

      const { data: masterData, error: masterError } =
        await supabase
          .from('company_documents')
          .select(`
            id,
            document_name,
            document_type,
            description,
            file_name,
            file_path,
            expiry_date,
            is_active
          `)
          .eq('document_type', 'company_profile')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

      if (masterError) {
        throw new Error(
          `Could not load Company Profile Master: ${masterError.message}`
        );
      }

      const { data: structureData, error: structureError } =
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

      if (!structureData?.id) {
        throw new Error(
          'Submission structure was not found.'
        );
      }

      const { data: sectionData, error: sectionError } =
        await supabase
          .from('submission_sections')
          .select('id, title')
          .eq('structure_id', structureData.id)
          .eq('title', 'Company Profile')
          .limit(1)
          .maybeSingle();

      if (sectionError) {
        throw new Error(
          `Could not load Company Profile section: ${sectionError.message}`
        );
      }

      if (!sectionData?.id) {
        throw new Error(
          'Company Profile section was not found in this Submission.'
        );
      }

      const { data: overrideData, error: overrideError } =
        await supabase
          .from('submission_content')
          .select(`
            id,
            submission_id,
            section_id,
            document_id,
            title,
            source_type,
            file_name,
            file_path,
            content_order
          `)
          .eq('submission_id', submissionId)
          .eq('section_id', sectionData.id)
          .eq('source_type', 'upload')
          .order('content_order', { ascending: true })
          .limit(1)
          .maybeSingle();

      if (overrideError) {
        throw new Error(
          `Could not load Company Profile Override: ${overrideError.message}`
        );
      }

      setMasterDocument(masterData);
      setSectionId(sectionData.id);
      setOverride(overrideData);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not load Company Profile.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, [submissionId]);

  /*
   * Private Storage:
   * Use Signed URL instead of getPublicUrl().
   */
  async function openFile(filePath: string | null) {
    if (!filePath) {
      setError(
        'This document does not have a Storage file yet.'
      );
      return;
    }

    setError('');
    setSuccess('');

    const { data, error: signedUrlError } =
      await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60 * 10);

    if (signedUrlError || !data?.signedUrl) {
      console.error(signedUrlError);

      setError(
        signedUrlError?.message ||
          'Could not create a secure link for this document.'
      );

      return;
    }

    window.open(data.signedUrl, '_blank');
  }

  function browseMaster() {
    if (uploadingMaster) return;

    if (masterInputRef.current) {
      masterInputRef.current.value = '';
      masterInputRef.current.click();
    }
  }

  function browseOverride() {
    if (uploadingOverride) return;

    if (overrideInputRef.current) {
      overrideInputRef.current.value = '';
      overrideInputRef.current.click();
    }
  }

  async function uploadMaster(file: File) {
    if (!file) return;

    setUploadingMaster(true);
    setError('');
    setSuccess('');

    let uploadedPath = '';

    try {
      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-');

      uploadedPath =
        `company-profile/master/` +
        `${Date.now()}-${safeFileName}`;

      const { error: uploadError } =
        await supabase.storage
          .from('documents')
          .upload(uploadedPath, file, {
            upsert: false,
          });

      if (uploadError) {
        throw new Error(
          `Master upload failed: ${uploadError.message}`
        );
      }

      if (masterDocument?.file_path) {
        const { error: oldFileError } =
          await supabase.storage
            .from('documents')
            .remove([masterDocument.file_path]);

        if (oldFileError) {
          console.warn(
            'Could not remove old Master file:',
            oldFileError
          );
        }
      }

      if (masterDocument?.id) {
        const { data: updatedMaster, error: updateError } =
          await supabase
            .from('company_documents')
            .update({
              file_name: file.name,
              file_path: uploadedPath,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', masterDocument.id)
            .select(`
              id,
              document_name,
              document_type,
              description,
              file_name,
              file_path,
              expiry_date,
              is_active
            `)
            .single();

        if (updateError) {
          throw new Error(
            `Could not update Master Company Profile: ${updateError.message}`
          );
        }

        setMasterDocument(updatedMaster);
      } else {
        const { data: newMaster, error: insertError } =
          await supabase
            .from('company_documents')
            .insert({
              document_name:
                'Petrokima Company Profile',
              document_type: 'company_profile',
              description:
                'Master Company Profile document.',
              file_name: file.name,
              file_path: uploadedPath,
              is_active: true,
            })
            .select(`
              id,
              document_name,
              document_type,
              description,
              file_name,
              file_path,
              expiry_date,
              is_active
            `)
            .single();

        if (insertError) {
          throw new Error(
            `Could not create Master Company Profile: ${insertError.message}`
          );
        }

        setMasterDocument(newMaster);
      }

      setSuccess(
        'Master Company Profile uploaded successfully.'
      );
    } catch (err: any) {
      console.error(err);

      if (uploadedPath) {
        await supabase.storage
          .from('documents')
          .remove([uploadedPath]);
      }

      setError(
        err?.message ||
          'Could not upload Master Company Profile.'
      );
    } finally {
      setUploadingMaster(false);
    }
  }

  async function uploadOverride(file: File) {
    if (!sectionId) {
      setError(
        'Company Profile section was not found.'
      );
      return;
    }

    setUploadingOverride(true);
    setError('');
    setSuccess('');

    let uploadedPath = '';

    try {
      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-');

      uploadedPath =
        `${submissionId}/company-profile/override/` +
        `${Date.now()}-${safeFileName}`;

      const { error: uploadError } =
        await supabase.storage
          .from('documents')
          .upload(uploadedPath, file, {
            upsert: false,
          });

      if (uploadError) {
        throw new Error(
          `Override upload failed: ${uploadError.message}`
        );
      }

      if (override?.id) {
        const { error: deleteError } =
          await supabase
            .from('submission_content')
            .delete()
            .eq('id', override.id);

        if (deleteError) {
          throw new Error(
            `Could not replace previous Override: ${deleteError.message}`
          );
        }

        if (override.file_path) {
          await supabase.storage
            .from('documents')
            .remove([override.file_path]);
        }
      }

      const { data: newOverride, error: insertError } =
        await supabase
          .from('submission_content')
          .insert({
            submission_id: submissionId,
            section_id: sectionId,
            document_id: null,
            title: 'Company Profile',
            source_type: 'upload',
            file_name: file.name,
            file_path: uploadedPath,
            content_order: 1,
          })
          .select(`
            id,
            submission_id,
            section_id,
            document_id,
            title,
            source_type,
            file_name,
            file_path,
            content_order
          `)
          .single();

      if (insertError) {
        await supabase.storage
          .from('documents')
          .remove([uploadedPath]);

        throw new Error(
          `Could not save Override: ${insertError.message}`
        );
      }

      setOverride(newOverride);

      setSuccess(
        'Company Profile Override uploaded successfully.'
      );
    } catch (err: any) {
      console.error(err);

      if (uploadedPath) {
        await supabase.storage
          .from('documents')
          .remove([uploadedPath]);
      }

      setError(
        err?.message ||
          'Could not upload Company Profile Override.'
      );
    } finally {
      setUploadingOverride(false);
    }
  }

  function handleMasterDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    setMasterDragActive(false);

    if (uploadingMaster) return;

    const file = event.dataTransfer.files?.[0];

    if (file) {
      uploadMaster(file);
    }
  }

  function handleOverrideDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    setOverrideDragActive(false);

    if (uploadingOverride) return;

    const file = event.dataTransfer.files?.[0];

    if (file) {
      uploadOverride(file);
    }
  }

  async function removeOverride() {
    if (!override) return;

    const confirmed = window.confirm(
      'Remove the Company Profile Override? The Master Company Profile will remain unchanged.'
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');

    try {
      if (override.file_path) {
        const { error: storageError } =
          await supabase.storage
            .from('documents')
            .remove([override.file_path]);

        if (storageError) {
          console.warn(
            'Could not remove Override file:',
            storageError
          );
        }
      }

      const { error: deleteError } =
        await supabase
          .from('submission_content')
          .delete()
          .eq('id', override.id);

      if (deleteError) {
        throw new Error(
          `Could not remove Override: ${deleteError.message}`
        );
      }

      setOverride(null);

      setSuccess(
        'Override removed. Master Company Profile is active again.'
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not remove Override.'
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-slate-500">
            Loading Company Profile...
          </p>
        </div>
      </main>
    );
  }

  const activeSource = override
    ? 'Submission Override'
    : masterDocument
      ? 'Master Document'
      : 'Not Available';

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">

        <div className="mb-6">
          <a
            href={
              `/projects/${projectId}` +
              `/systems/${systemId}` +
              `/submission/${submissionId}`
            }
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to Submission
          </a>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">

            <div>
              <p className="text-sm font-medium text-blue-600">
                Technical Submittal
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Company Profile
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Master Company Profile with optional
                Submission Override.
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 px-5 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Active Source
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {activeSource}
              </p>
            </div>

          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              {error}
            </p>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">
              {success}
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">

          {/* MASTER DOCUMENT */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Master Document
            </p>

            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Company Profile
            </h2>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();

                if (!uploadingMaster) {
                  setMasterDragActive(true);
                }
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();

                setMasterDragActive(false);
              }}
              onDrop={handleMasterDrop}
              className={`mt-5 rounded-xl border-2 border-dashed p-5 transition ${
                masterDragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 bg-slate-50'
              }`}
            >

              {masterDocument ? (
                <>
                  <p className="font-semibold text-slate-900">
                    {masterDocument.document_name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {masterDocument.file_name ||
                      'No file uploaded'}
                  </p>

                  {masterDocument.description && (
                    <p className="mt-3 text-sm text-slate-600">
                      {masterDocument.description}
                    </p>
                  )}

                  {!masterDocument.file_path && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                      Master record exists, but no Storage
                      file is linked yet.
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">

                    {masterDocument.file_path && (
                      <button
                        type="button"
                        onClick={() =>
                          openFile(
                            masterDocument.file_path
                          )
                        }
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Open Master
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={browseMaster}
                      disabled={uploadingMaster}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {uploadingMaster
                        ? 'Uploading...'
                        : masterDocument.file_path
                          ? 'Replace Master'
                          : 'Upload Master'}
                    </button>

                  </div>
                </>
              ) : (
                <>
                  <p className="font-medium text-slate-900">
                    No Master Company Profile
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Drag & Drop the Master PDF here or
                    browse for a file.
                  </p>

                  <button
                    type="button"
                    onClick={browseMaster}
                    disabled={uploadingMaster}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploadingMaster
                      ? 'Uploading...'
                      : 'Upload Master'}
                  </button>
                </>
              )}

            </div>
          </div>

          {/* SUBMISSION OVERRIDE */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
              Submission Override
            </p>

            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Project-specific Company Profile
            </h2>

            {override ? (
              <div className="mt-5 rounded-xl border border-purple-200 bg-purple-50 p-5">

                <p className="font-semibold text-slate-900">
                  {override.file_name}
                </p>

                <p className="mt-2 text-sm text-purple-700">
                  This file overrides the Master Company
                  Profile for this Submission only.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      openFile(override.file_path)
                    }
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Open Override
                  </button>

                  <button
                    type="button"
                    onClick={browseOverride}
                    disabled={uploadingOverride}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {uploadingOverride
                      ? 'Uploading...'
                      : 'Replace'}
                  </button>

                  <button
                    type="button"
                    onClick={removeOverride}
                    disabled={uploadingOverride}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>

                </div>

              </div>
            ) : (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  if (!uploadingOverride) {
                    setOverrideDragActive(true);
                  }
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  setOverrideDragActive(false);
                }}
                onDrop={handleOverrideDrop}
                className={`mt-5 rounded-xl border-2 border-dashed p-6 text-center transition ${
                  overrideDragActive
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-300 bg-slate-50'
                }`}
              >

                <p className="font-medium text-slate-900">
                  No Submission Override
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Drag & Drop a project-specific Company
                  Profile or browse.
                </p>

                <button
                  type="button"
                  onClick={browseOverride}
                  disabled={uploadingOverride}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadingOverride
                    ? 'Uploading...'
                    : 'Browse'}
                </button>

              </div>
            )}

          </div>
        </div>

        <input
          ref={masterInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              uploadMaster(file);
            }
          }}
        />

        <input
          ref={overrideInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              uploadOverride(file);
            }
          }}
        />

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">

          <p className="font-semibold text-blue-900">
            Active source rule
          </p>

          <p className="mt-2 text-sm text-blue-800">
            Submission Override takes priority. If no
            Override exists, the active Master Company
            Profile is used.
          </p>

        </div>

      </div>
    </main>
  );
}