'use client';

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useParams, useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase';

type SubmissionStructure = {
  id: string;
  submission_id: string;
  structure_name: string;
};

type SubmissionSection = {
  id: string;
  structure_id: string;
  title: string;
  section_order: number;
};

type SubmissionContent = {
  id: string;
  submission_id: string;
  section_id: string;
  document_id: string | null;
  title: string;
  source_type: 'database' | 'manual' | 'upload';
  file_name: string | null;
  file_path: string | null;
  content_order: number;
};

export default function MaterialListPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = String(params.id);
  const systemId = String(params.systemId);
  const submissionId = String(params.submissionId);

  const supabase = createClient();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [section, setSection] =
    useState<SubmissionSection | null>(null);

  const [content, setContent] =
    useState<SubmissionContent | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');

  const storageFolder =
    `${submissionId}/material-list`;

  useEffect(() => {
    loadMaterialList();
  }, [submissionId]);

  async function loadMaterialList() {
    try {
      setLoading(true);
      setError('');

      /*
       * 1. Load submission structure
       */

      const {
        data: structureData,
        error: structureError,
      } = await supabase
        .from('submission_structures')
        .select(
          'id, submission_id, structure_name'
        )
        .eq('submission_id', submissionId)
        .order('created_at', {
          ascending: true,
        })
        .limit(1)
        .single();

      if (structureError) {
        throw structureError;
      }

      const structure =
        structureData as SubmissionStructure;

      /*
       * 2. Load Material List section
       */

      const {
        data: sectionData,
        error: sectionError,
      } = await supabase
        .from('submission_sections')
        .select(
          'id, structure_id, title, section_order'
        )
        .eq('structure_id', structure.id)
        .eq('title', 'Material List')
        .limit(1)
        .single();

      if (sectionError) {
        throw sectionError;
      }

      const materialSection =
        sectionData as SubmissionSection;

      setSection(materialSection);

      /*
       * 3. Load Material List content
       */

      const {
        data: contentData,
        error: contentError,
      } = await supabase
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
        .eq('section_id', materialSection.id)
        .order('content_order', {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (contentError) {
        throw contentError;
      }

      setContent(
        (contentData as SubmissionContent | null) ??
          null
      );

      console.log(
        'Material List loaded:',
        contentData
      );
    } catch (err) {
      console.error(
        'Could not load Material List:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not load Material List'
      );
    } finally {
      setLoading(false);
    }
  }

  function getExtension(fileName: string) {
    const parts = fileName.split('.');

    if (parts.length < 2) {
      return 'pdf';
    }

    return parts[parts.length - 1].toLowerCase();
  }

  async function uploadMaterialList(file: File) {
    try {
      setUploading(true);
      setError('');

      if (!section) {
        throw new Error(
          'Material List section was not found.'
        );
      }

      console.log(
        'Starting Material List upload:',
        {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          submissionId,
          sectionId: section.id,
        }
      );

      /*
       * 1. Build storage path
       */

      const extension =
        getExtension(file.name);

      const savedFileName =
        `material-list.${extension}`;

      const filePath =
        `${storageFolder}/${savedFileName}`;

      /*
       * 2. Remove old file if one exists
       */

      if (content?.file_path) {
        const {
          error: removeOldError,
        } = await supabase.storage
          .from('documents')
          .remove([
            content.file_path,
          ]);

        if (removeOldError) {
          console.warn(
            'Could not remove old Material List file:',
            removeOldError
          );
        }
      } else {
        const {
          data: oldFiles,
          error: listError,
        } = await supabase.storage
          .from('documents')
          .list(storageFolder);

        if (!listError && oldFiles?.length) {
          const oldPaths =
            oldFiles
              .filter(
                (item) =>
                  item.name &&
                  item.name
                    .toLowerCase()
                    .startsWith(
                      'material-list.'
                    )
              )
              .map(
                (item) =>
                  `${storageFolder}/${item.name}`
              );

          if (oldPaths.length > 0) {
            await supabase.storage
              .from('documents')
              .remove(oldPaths);
          }
        }
      }

      /*
       * 3. Upload file to Storage
       */

      console.log(
        'Uploading file to Storage:',
        filePath
      );

      const {
        error: uploadError,
      } = await supabase.storage
        .from('documents')
        .upload(
          filePath,
          file,
          {
            upsert: true,
            contentType:
              file.type || undefined,
          }
        );

      if (uploadError) {
        console.error(
          'Storage upload error:',
          uploadError
        );

        throw uploadError;
      }

      console.log(
        'Storage upload successful:',
        filePath
      );

      /*
       * 4. Check whether submission_content
       *    already exists
       */

      const {
        data: existingContent,
        error: existingContentError,
      } = await supabase
        .from('submission_content')
        .select('id')
        .eq(
          'submission_id',
          submissionId
        )
        .eq(
          'section_id',
          section.id
        )
        .limit(1)
        .maybeSingle();

      if (existingContentError) {
        console.error(
          'Existing content lookup error:',
          existingContentError
        );

        throw existingContentError;
      }

      console.log(
        'Existing Material List content:',
        existingContent
      );

      /*
       * 5. UPDATE existing content
       */

      if (existingContent?.id) {
        console.log(
          'Updating existing Material List record...'
        );

        const {
          data: updatedContent,
          error: updateError,
        } = await supabase
          .from('submission_content')
          .update({
            document_id: null,
            title: 'Material List',
            source_type: 'upload',
            file_name: file.name,
            file_path: filePath,
            content_order: 1,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            existingContent.id
          )
          .select()
          .single();

        console.log(
          'Material List UPDATE result:',
          {
            updatedContent,
            updateError,
          }
        );

        if (updateError) {
          throw updateError;
        }
      }

      /*
       * 6. INSERT new content
       */

      else {
        console.log(
          'Creating new Material List record...'
        );

        const {
          data: insertedContent,
          error: insertError,
        } = await supabase
          .from('submission_content')
          .insert({
            submission_id:
              submissionId,
            section_id:
              section.id,
            document_id: null,
            title: 'Material List',
            source_type: 'upload',
            file_name: file.name,
            file_path: filePath,
            content_order: 1,
          })
          .select()
          .single();

        console.log(
          'Material List INSERT result:',
          {
            insertedContent,
            insertError,
          }
        );

        if (insertError) {
          throw insertError;
        }
      }

      /*
       * 7. Reload from database
       */

      await loadMaterialList();

    } catch (err) {
      console.error(
        'Could not upload Material List:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not upload Material List'
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    await uploadMaterialList(file);

    event.target.value = '';
  }

  async function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    setDragActive(false);

    const file =
      event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    await uploadMaterialList(file);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function openMaterialList() {
    if (!content?.file_path) {
      return;
    }

    const {
      data,
      error: signedUrlError,
    } = await supabase.storage
      .from('documents')
      .createSignedUrl(
        content.file_path,
        60 * 10
      );

    if (signedUrlError) {
      setError(
        signedUrlError.message
      );

      return;
    }

    if (data?.signedUrl) {
      window.open(
        data.signedUrl,
        '_blank',
        'noopener,noreferrer'
      );
    }
  }

  async function removeMaterialList() {
    if (!section) {
      return;
    }

    try {
      setUploading(true);
      setError('');

      if (content?.file_path) {
        const {
          error: storageError,
        } = await supabase.storage
          .from('documents')
          .remove([
            content.file_path,
          ]);

        if (storageError) {
          throw storageError;
        }
      }

      const {
        error: deleteError,
      } = await supabase
        .from('submission_content')
        .delete()
        .eq(
          'submission_id',
          submissionId
        )
        .eq(
          'section_id',
          section.id
        );

      if (deleteError) {
        throw deleteError;
      }

      setContent(null);

    } catch (err) {
      console.error(
        'Could not remove Material List:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not remove Material List'
      );
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border bg-white p-6">
            Loading Material List...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}

        <div className="flex items-center justify-between">

          <div>

            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="mb-3 text-sm text-slate-600 hover:text-slate-900"
            >
              ← Back
            </button>

            <h1 className="text-2xl font-semibold text-slate-900">
              Material List
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Upload the Material List document for this submission.
            </p>

          </div>

        </div>

        {/* Error */}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Upload / Existing */}

        {!content ? (

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => {
              setDragActive(false);
            }}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-12 text-center transition ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-white'
            }`}
          >

            <div className="mx-auto max-w-md">

              <div className="text-4xl">
                📄
              </div>

              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                Upload Material List
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Drag & drop your file here, or browse from your computer.
              </p>

              <button
                type="button"
                onClick={openFilePicker}
                disabled={uploading}
                className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {uploading
                  ? 'Uploading...'
                  : 'Browse File'}
              </button>

            </div>

          </div>

        ) : (

          <div className="rounded-xl border bg-white p-6">

            <div className="flex items-center justify-between gap-4">

              <div className="min-w-0">

                <div className="text-sm font-medium text-slate-500">
                  Material List
                </div>

                <div className="mt-1 truncate text-lg font-semibold text-slate-900">
                  {content.file_name}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Source: Upload
                </div>

              </div>

              <div className="flex shrink-0 gap-2">

                <button
                  type="button"
                  onClick={openMaterialList}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open
                </button>

                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={uploading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Replace
                </button>

                <button
                  type="button"
                  onClick={removeMaterialList}
                  disabled={uploading}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>

              </div>

            </div>

          </div>

        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

      </div>
    </main>
  );
}