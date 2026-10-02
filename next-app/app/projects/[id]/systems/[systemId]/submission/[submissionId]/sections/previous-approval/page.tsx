'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type Approval = {
  id: string;
  approval_reference: string | null;
  approval_date: string | null;
  description: string | null;
  file_name: string | null;
  file_path: string | null;
  is_active: boolean;
};

export default function PreviousApprovalPage() {
  const supabase = createClient();
  const params = useParams();

  const submissionId = params.submissionId as string;
  const systemId = params.systemId as string;

  const [approval, setApproval] = useState<Approval | null>(null);
  const [reference, setReference] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadData() {
    setLoading(true);

    const { data, error } = await supabase
      .from('previous_approvals')
      .select(`
        id,
        approval_reference,
        approval_date,
        description,
        file_name,
        file_path,
        is_active
      `)
      .eq('system_id', systemId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('PREVIOUS APPROVAL ERROR:', error);
      setMessage(error.message);
    } else if (data) {
      setApproval(data);
      setReference(data.approval_reference || '');
      setDate(data.approval_date || '');
      setDescription(data.description || '');
    }

    setLoading(false);
  }

  useEffect(() => {
    if (systemId) {
      loadData();
    }
  }, [systemId]);

  async function openFile(path: string | null) {
    if (!path) {
      setMessage('No file is stored.');
      return;
    }

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(path, 60 * 10);

    if (error || !data?.signedUrl) {
      setMessage(
        `Could not open file: ${error?.message || 'Unknown error'}`
      );
      return;
    }

    window.open(data.signedUrl, '_blank');
  }

  async function saveApproval(file: File) {
    if (file.type !== 'application/pdf') {
      setMessage('Please select a PDF file.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      if (approval?.file_path) {
        await supabase.storage
          .from('documents')
          .remove([approval.file_path]);
      }

      if (approval?.id) {
        await supabase
          .from('previous_approvals')
          .update({ is_active: false })
          .eq('id', approval.id);
      }

      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );

      const path =
        `${submissionId}/previous-approval/` +
        `${Date.now()}-${safeName}`;

      const { error: uploadError } =
        await supabase.storage
          .from('documents')
          .upload(path, file, {
            contentType: 'application/pdf',
            upsert: false,
          });

      if (uploadError) throw uploadError;

      const { data, error: dbError } = await supabase
        .from('previous_approvals')
        .insert({
          project_name: null,
          client_name: null,
          consultant: null,
          contractor: null,
          system_id: systemId,
          approval_reference: reference || null,
          approval_date: date || null,
          description: description || null,
          file_name: file.name,
          file_path: path,
          is_active: true,
        })
        .select(`
          id,
          approval_reference,
          approval_date,
          description,
          file_name,
          file_path,
          is_active
        `)
        .single();

      if (dbError) {
        await supabase.storage
          .from('documents')
          .remove([path]);

        throw dbError;
      }

      setApproval(data);
      setMessage('Previous Approval saved successfully.');
    } catch (error: any) {
      setMessage(
        `Save failed: ${error?.message || 'Unknown error'}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeApproval() {
    if (!approval) return;

    if (approval.file_path) {
      await supabase.storage
        .from('documents')
        .remove([approval.file_path]);
    }

    const { error } = await supabase
      .from('previous_approvals')
      .update({ is_active: false })
      .eq('id', approval.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setApproval(null);
    setMessage('Previous Approval removed successfully.');
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">
          Loading Previous Approval...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-5xl px-8 py-10">

        <h1 className="text-2xl font-bold text-gray-900">
          Previous Approval
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Previous project approval document.
        </p>

        {message && (
          <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="text-sm font-medium text-gray-700">
                Approval Reference
              </label>

              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3"
                placeholder="Example: APP-001"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Approval Date
              </label>

              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3"
              />
            </div>

          </div>

          <div className="mt-5">
            <label className="text-sm font-medium text-gray-700">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3"
              placeholder="Optional description"
            />
          </div>

          {approval ? (
            <div className="mt-6 rounded-xl border bg-gray-50 p-5">

              <p className="font-medium text-gray-900">
                {approval.file_name}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">

                <button
                  onClick={() => openFile(approval.file_path)}
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
                    disabled={saving}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) saveApproval(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>

                <button
                  onClick={removeApproval}
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
                if (file) saveApproval(file);
              }}
              className="mt-6 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center"
            >
              <p className="text-sm text-gray-500">
                Drag & Drop Previous Approval PDF
              </p>

              <label className="mt-4 inline-block cursor-pointer rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white">
                Browse
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) saveApproval(file);
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
