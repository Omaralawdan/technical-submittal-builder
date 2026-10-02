'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

type Branding = {
  id: number;
  petrokima_logo_path: string | null;
  siemens_logo_path: string | null;
};

type LogoKey = 'petrokima' | 'siemens';

const BUCKET = 'company-branding';

export default function CompanyBrandingPage() {
  const supabase = createClient();

  const [branding, setBranding] = useState<Branding | null>(null);

  const [petrokimaUrl, setPetrokimaUrl] =
    useState<string | null>(null);

  const [siemensUrl, setSiemensUrl] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] =
    useState<LogoKey | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    loadBranding();
  }, []);

  async function loadBranding() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('company_branding')
        .select(
          'id, petrokima_logo_path, siemens_logo_path'
        )
        .eq('id', 1)
        .single();

      if (error) {
        throw error;
      }

      setBranding(data);

      await refreshLogoUrls(data);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load company branding.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshLogoUrls(data: Branding) {
    setPetrokimaUrl(null);
    setSiemensUrl(null);

    if (data.petrokima_logo_path) {
      const { data: signedData } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrl(
            data.petrokima_logo_path,
            60 * 60
          );

      if (signedData?.signedUrl) {
        setPetrokimaUrl(signedData.signedUrl);
      }
    }

    if (data.siemens_logo_path) {
      const { data: signedData } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrl(
            data.siemens_logo_path,
            60 * 60
          );

      if (signedData?.signedUrl) {
        setSiemensUrl(signedData.signedUrl);
      }
    }
  }

  async function handleUpload(
    logoKey: LogoKey,
    file: File
  ) {
    try {
      setUploading(logoKey);
      setMessage(null);
      setError(null);

      if (!file.type.startsWith('image/')) {
        throw new Error(
          'Please select an image file.'
        );
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error(
          'Maximum logo size is 5 MB.'
        );
      }

      const extension =
        file.name.split('.').pop()?.toLowerCase() ||
        'png';

      const filePath =
        `${logoKey}/logo-${Date.now()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from(BUCKET)
          .upload(filePath, file, {
            upsert: false,
            contentType: file.type,
          });

      if (uploadError) {
        throw uploadError;
      }

      const column =
        logoKey === 'petrokima'
          ? 'petrokima_logo_path'
          : 'siemens_logo_path';

      const previousPath =
        logoKey === 'petrokima'
          ? branding?.petrokima_logo_path
          : branding?.siemens_logo_path;

      const { error: updateError } =
        await supabase
          .from('company_branding')
          .update({
            [column]: filePath,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 1);

      if (updateError) {
        await supabase.storage
          .from(BUCKET)
          .remove([filePath]);

        throw updateError;
      }

      if (previousPath) {
        await supabase.storage
          .from(BUCKET)
          .remove([previousPath]);
      }

      const updatedBranding: Branding = {
        id: 1,
        petrokima_logo_path:
          logoKey === 'petrokima'
            ? filePath
            : branding?.petrokima_logo_path ?? null,
        siemens_logo_path:
          logoKey === 'siemens'
            ? filePath
            : branding?.siemens_logo_path ?? null,
      };

      setBranding(updatedBranding);

      await refreshLogoUrls(updatedBranding);

      setMessage(
        `${logoKey === 'petrokima' ? 'PETROKIMA' : 'Siemens'} logo uploaded successfully.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to upload logo.'
      );
    } finally {
      setUploading(null);
    }
  }

  async function handleRemove(
    logoKey: LogoKey
  ) {
    try {
      setUploading(logoKey);
      setMessage(null);
      setError(null);

      const path =
        logoKey === 'petrokima'
          ? branding?.petrokima_logo_path
          : branding?.siemens_logo_path;

      if (!path) {
        return;
      }

      const { error: storageError } =
        await supabase.storage
          .from(BUCKET)
          .remove([path]);

      if (storageError) {
        throw storageError;
      }

      const column =
        logoKey === 'petrokima'
          ? 'petrokima_logo_path'
          : 'siemens_logo_path';

      const { error: updateError } =
        await supabase
          .from('company_branding')
          .update({
            [column]: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 1);

      if (updateError) {
        throw updateError;
      }

      const updatedBranding: Branding = {
        id: 1,
        petrokima_logo_path:
          logoKey === 'petrokima'
            ? null
            : branding?.petrokima_logo_path ?? null,
        siemens_logo_path:
          logoKey === 'siemens'
            ? null
            : branding?.siemens_logo_path ?? null,
      };

      setBranding(updatedBranding);

      await refreshLogoUrls(updatedBranding);

      setMessage(
        `${logoKey === 'petrokima' ? 'PETROKIMA' : 'Siemens'} logo removed.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to remove logo.'
      );
    } finally {
      setUploading(null);
    }
  }

  function handleFileChange(
    logoKey: LogoKey,
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    handleUpload(logoKey, file);

    event.target.value = '';
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-gray-500">
            Loading company branding...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-red-700">
            Settings
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Company Branding
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Upload the company logos that will be used
            automatically across Technical Submittals.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <LogoCard
            title="PETROKIMA LOGO"
            description="Global company logo used on Technical Submittal covers and document headers."
            imageUrl={petrokimaUrl}
            uploading={uploading === 'petrokima'}
            onFileChange={(event) =>
              handleFileChange(
                'petrokima',
                event
              )
            }
            onRemove={() =>
              handleRemove('petrokima')
            }
          />

          <LogoCard
            title="SIEMENS LOGO"
            description="Global Siemens logo used on Technical Submittal covers and document headers."
            imageUrl={siemensUrl}
            uploading={uploading === 'siemens'}
            onFileChange={(event) =>
              handleFileChange(
                'siemens',
                event
              )
            }
            onRemove={() =>
              handleRemove('siemens')
            }
          />
        </div>

        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900">
            How this works
          </h2>

          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>
              • These logos are saved once at company level.
            </li>
            <li>
              • All Technical Submittals can use the same
              branding automatically.
            </li>
            <li>
              • Client, Consultant, and Contractor logos
              remain project-specific.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

function LogoCard({
  title,
  description,
  imageUrl,
  uploading,
  onFileChange,
  onRemove,
}: {
  title: string;
  description: string;
  imageUrl: string | null;
  uploading: boolean;
  onFileChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  onRemove: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gradient-to-r from-red-950 via-red-800 to-red-600 px-6 py-5">
        <h2 className="text-lg font-bold tracking-wide text-white">
          {title}
        </h2>

        <p className="mt-1 text-xs leading-5 text-red-100">
          {description}
        </p>
      </div>

      <div className="p-6">
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="max-h-36 max-w-[80%] object-contain"
            />
          ) : (
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-500">
                No logo uploaded
              </div>

              <div className="mt-1 text-xs text-gray-400">
                PNG, JPG, JPEG, SVG
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-red-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-900">
            {uploading
              ? 'Uploading...'
              : imageUrl
                ? 'Replace Logo'
                : 'Upload Logo'}

            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
              className="hidden"
              disabled={uploading}
              onChange={onFileChange}
            />
          </label>

          {imageUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Maximum file size: 5 MB
        </p>
      </div>
    </section>
  );
}