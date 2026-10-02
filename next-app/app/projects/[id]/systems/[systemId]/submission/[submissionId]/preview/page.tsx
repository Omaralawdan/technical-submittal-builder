'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type Project = {
  project_name: string;
  client_name: string | null;
  consultant: string | null;
  contractor: string | null;
};

type ProjectSystem = {
  custom_system_name: string | null;
  systems: {
    name: string;
  }[] | null;
};

type Submission = {
  id: string;
  revision: string;
  submission_date: string | null;
  status: string | null;
};

type Structure = {
  id: string;
  submission_id: string;
  structure_name: string;
};

type Section = {
  id: string;
  structure_id: string;
  section_type_id: string | null;
  title: string;
  section_order: number;
  is_custom: boolean;
  is_required: boolean;
};

type SubmissionContent = {
  id: string;
  submission_id: string;
  section_id: string;
  title: string;
  source_type: string;
  file_name: string | null;
  file_path: string | null;
  content_order: number;
};

type PreviewContent = SubmissionContent & {
  signed_url?: string | null;
};

export default function SubmissionPreviewPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;
  const systemId = params.systemId as string;
  const submissionId = params.submissionId as string;

  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [projectSystem, setProjectSystem] =
    useState<ProjectSystem | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [structure, setStructure] = useState<Structure | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [contents, setContents] = useState<PreviewContent[]>([]);

  useEffect(() => {
    loadPreview();
  }, [projectId, systemId, submissionId]);

  async function loadPreview() {
    try {
      setLoading(true);
      setError(null);

      /*
       * ---------------------------------------------------------
       * PROJECT
       * ---------------------------------------------------------
       */
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(
          `
          project_name,
          client_name,
          consultant,
          contractor
        `
        )
        .eq('id', projectId)
        .single();

      if (projectError) {
        throw new Error(projectError.message);
      }

      setProject(projectData);

      /*
       * ---------------------------------------------------------
       * PROJECT SYSTEM
       * ---------------------------------------------------------
       */
      const { data: projectSystemData, error: projectSystemError } =
        await supabase
          .from('project_systems')
          .select(
            `
            custom_system_name,
            systems (
              name
            )
          `
          )
          .eq('id', systemId)
          .single();

      if (projectSystemError) {
        throw new Error(projectSystemError.message);
      }

      setProjectSystem(projectSystemData);

      /*
       * ---------------------------------------------------------
       * SUBMISSION
       * ---------------------------------------------------------
       */
      const { data: submissionData, error: submissionError } =
        await supabase
          .from('submissions')
          .select(
            `
            id,
            revision,
            submission_date,
            status
          `
          )
          .eq('id', submissionId)
          .single();

      if (submissionError) {
        throw new Error(submissionError.message);
      }

      setSubmission(submissionData);

      /*
       * ---------------------------------------------------------
       * STRUCTURE
       * ---------------------------------------------------------
       */
      const { data: structureData, error: structureError } =
        await supabase
          .from('submission_structures')
          .select(
            `
            id,
            submission_id,
            structure_name
          `
          )
          .eq('submission_id', submissionId)
          .order('id')
          .limit(1)
          .single();

      if (structureError) {
        throw new Error(structureError.message);
      }

      setStructure(structureData);

      /*
       * ---------------------------------------------------------
       * SECTIONS
       * ---------------------------------------------------------
       */
      const { data: sectionsData, error: sectionsError } =
        await supabase
          .from('submission_sections')
          .select(
            `
            id,
            structure_id,
            section_type_id,
            title,
            section_order,
            is_custom,
            is_required
          `
          )
          .eq('structure_id', structureData.id)
          .order('section_order', { ascending: true });

      if (sectionsError) {
        throw new Error(sectionsError.message);
      }

      setSections(sectionsData || []);

      /*
       * ---------------------------------------------------------
       * CONTENT
       * ---------------------------------------------------------
       */
      const { data: contentsData, error: contentsError } =
        await supabase
          .from('submission_content')
          .select(
            `
            id,
            submission_id,
            section_id,
            title,
            source_type,
            file_name,
            file_path,
            content_order
          `
          )
          .eq('submission_id', submissionId)
          .order('content_order', { ascending: true });

      if (contentsError) {
        throw new Error(contentsError.message);
      }

      /*
       * ---------------------------------------------------------
       * SIGNED URLS
       * ---------------------------------------------------------
       */
      const contentWithUrls: PreviewContent[] = await Promise.all(
        (contentsData || []).map(async (content) => {
          if (!content.file_path) {
            return {
              ...content,
              signed_url: null,
            };
          }

          const { data: signedData } = await supabase.storage
            .from('documents')
            .createSignedUrl(content.file_path, 60 * 60);

          return {
            ...content,
            signed_url: signedData?.signedUrl || null,
          };
        })
      );

      setContents(contentWithUrls);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load submission preview.'
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * -----------------------------------------------------------
   * SYSTEM NAME
   * -----------------------------------------------------------
   */
  const systemName = useMemo(() => {
    if (projectSystem?.custom_system_name) {
      return projectSystem.custom_system_name;
    }

    if (
      projectSystem?.systems &&
      projectSystem.systems.length > 0 &&
      projectSystem.systems[0]?.name
    ) {
      return projectSystem.systems[0].name;
    }

    return 'System';
  }, [projectSystem]);

  /*
   * -----------------------------------------------------------
   * NAVIGATION SECTIONS
   *
   * The database TOC section is a navigation template only.
   * It must NOT appear as a normal section in the final TOC.
   * -----------------------------------------------------------
   */
  const navigationSections = useMemo(() => {
    return sections.filter(
      (section) =>
        section.title.trim().toLowerCase() !== 'table of contents'
    );
  }, [sections]);

  /*
   * -----------------------------------------------------------
   * CONTENT HELPERS
   * -----------------------------------------------------------
   */
  function getSectionContents(sectionId: string) {
    return contents
      .filter((content) => content.section_id === sectionId)
      .sort((a, b) => a.content_order - b.content_order);
  }

  function isPdf(content: PreviewContent) {
    const fileName = content.file_name?.toLowerCase() || '';

    return (
      fileName.endsWith('.pdf') ||
      content.file_path?.toLowerCase().endsWith('.pdf')
    );
  }

  function isImage(content: PreviewContent) {
    const fileName = content.file_name?.toLowerCase() || '';

    return (
      fileName.endsWith('.png') ||
      fileName.endsWith('.jpg') ||
      fileName.endsWith('.jpeg') ||
      fileName.endsWith('.webp')
    );
  }

  /*
   * -----------------------------------------------------------
   * PDF GENERATION
   *
   * Calls the server-side PDF engine.
   * The server route builds the real PDF with:
   * - TOC pages
   * - section pages
   * - uploaded PDF pages
   * - uploaded images
   * - real page numbers
   * - internal PDF hyperlinks
   * -----------------------------------------------------------
   */
  async function handleGeneratePdf() {
    if (generatingPdf) {
      return;
    }

    try {
      setGeneratingPdf(true);
      setPdfError(null);

      const response = await fetch(
        `/api/submissions/${submissionId}/pdf`,
        {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        let message = 'Failed to generate PDF.';

        try {
          const errorData = JSON.parse(errorText);

          if (errorData?.error) {
            message = errorData.error;
          }
        } catch {
          if (errorText.trim()) {
            message = errorText;
          }
        }

        throw new Error(message);
      }

      const pdfBlob = await response.blob();

      if (!pdfBlob || pdfBlob.size === 0) {
        throw new Error('The generated PDF is empty.');
      }

      const downloadUrl = window.URL.createObjectURL(pdfBlob);

      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `Technical-Submittal-${submissionId}.pdf`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
      }, 1000);
    } catch (err) {
      console.error('PDF generation error:', err);

      setPdfError(
        err instanceof Error
          ? err.message
          : 'Failed to generate PDF.'
      );
    } finally {
      setGeneratingPdf(false);
    }
  }

  /*
   * -----------------------------------------------------------
   * SECTION CONTENT RENDERER
   * -----------------------------------------------------------
   */
  function renderSectionContent(section: Section) {
    const sectionContents = getSectionContents(section.id);

    if (sectionContents.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            No content has been added to this section yet.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {sectionContents.map((content, index) => (
          <div
            key={content.id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Document {index + 1}
                </div>

                <div className="mt-1 text-sm font-semibold text-gray-900">
                  {content.title || content.file_name || 'Untitled'}
                </div>
              </div>

              {content.file_name && (
                <div className="max-w-[45%] truncate text-xs text-gray-500">
                  {content.file_name}
                </div>
              )}
            </div>

            <div className="bg-white p-5">
              {!content.signed_url && content.file_path && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                  Unable to generate a secure preview link for this file.
                </div>
              )}

              {!content.file_path && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
                  This content does not have an uploaded file.
                </div>
              )}

              {content.signed_url && isPdf(content) && (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <iframe
                    src={content.signed_url}
                    title={content.title || content.file_name || 'PDF'}
                    className="h-[900px] w-full"
                  />
                </div>
              )}

              {content.signed_url && isImage(content) && (
                <div className="flex justify-center rounded-lg bg-gray-100 p-4">
                  <img
                    src={content.signed_url}
                    alt={content.title || content.file_name || 'Document'}
                    className="max-h-[1000px] max-w-full object-contain"
                  />
                </div>
              )}

              {content.signed_url &&
                !isPdf(content) &&
                !isImage(content) && (
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-5">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {content.file_name || 'Uploaded file'}
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        Preview is not available for this file type.
                      </div>
                    </div>

                    <a
                      href={content.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      Open File
                    </a>
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  /*
   * -----------------------------------------------------------
   * TOC PAGE
   *
   * Every TOC entry links directly to the corresponding section.
   * There is NO "Back to Table of Contents" link inside sections.
   * -----------------------------------------------------------
   */
  function renderNavigationPage(
    activeSectionId: string | null,
    title: string
  ) {
    return (
      <section
        id={`toc-${activeSectionId || 'cover'}`}
        className="preview-page flex min-h-[1123px] flex-col bg-white px-[70px] py-[65px]"
      >
        <div className="mb-10 border-b-2 border-gray-900 pb-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
            Technical Submittal
          </div>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Table of Contents
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {title}
          </p>
        </div>

        <div className="space-y-2">
          {navigationSections.map((section, index) => {
            const isActive = section.id === activeSectionId;

            return (
              <a
                key={section.id}
                href={`#section-${section.id}`}
                className={`group flex items-center justify-between border-b px-4 py-4 text-sm transition ${
                  isActive
                    ? 'border-gray-900 bg-gray-100 font-bold text-gray-900'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 font-mono text-xs text-gray-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <span>{section.title}</span>
                </div>

                <span
                  className={`text-xs ${
                    isActive
                      ? 'text-gray-900'
                      : 'text-gray-400 group-hover:text-gray-700'
                  }`}
                >
                  →
                </span>
              </a>
            );
          })}
        </div>

        <div className="mt-auto border-t border-gray-200 pt-5 text-xs text-gray-400">
          {project?.project_name || 'Project'} · {systemName}
        </div>
      </section>
    );
  }

  /*
   * -----------------------------------------------------------
   * SECTION PAGE
   *
   * IMPORTANT:
   * No Back to Table of Contents link here.
   * The section only has its own stable anchor ID.
   * -----------------------------------------------------------
   */
  function renderSectionPage(section: Section, sectionNumber: number) {
    return (
      <section
        id={`section-${section.id}`}
        className="preview-page min-h-[1123px] bg-white px-[70px] py-[65px]"
      >
        <div className="mb-10 border-b-2 border-gray-900 pb-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
            Section {String(sectionNumber).padStart(2, '0')}
          </div>

          <h2 className="mt-2 text-3xl font-bold text-gray-900">
            {section.title}
          </h2>

          <div className="mt-3 text-sm text-gray-500">
            {project?.project_name || 'Project'} · {systemName}
          </div>
        </div>

        {renderSectionContent(section)}
      </section>
    );
  }

  /*
   * -----------------------------------------------------------
   * LOADING
   * -----------------------------------------------------------
   */
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-[1100px] rounded-xl border border-gray-200 bg-white p-10">
          <div className="text-sm text-gray-500">
            Loading submission preview...
          </div>
        </div>
      </main>
    );
  }

  /*
   * -----------------------------------------------------------
   * ERROR
   * -----------------------------------------------------------
   */
  if (error) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-[1100px] rounded-xl border border-red-200 bg-white p-10">
          <h1 className="text-xl font-bold text-red-700">
            Failed to load preview
          </h1>

          <p className="mt-3 text-sm text-gray-600">{error}</p>

          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  /*
   * -----------------------------------------------------------
   * EMPTY STATE
   * -----------------------------------------------------------
   */
  if (!project || !submission || !structure) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-[1100px] rounded-xl border border-gray-200 bg-white p-10">
          <div className="text-sm text-gray-500">
            Submission information is incomplete.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-200">
      {/* =======================================================
          TOOLBAR
          ======================================================= */}
      <div className="print:hidden sticky top-0 z-50 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-gray-900">
              Submission Preview
            </div>

            <div className="mt-1 text-xs text-gray-500">
              {project.project_name} · {systemName} · Revision{' '}
              {submission.revision}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>

            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingPdf ? 'Generating PDF...' : 'Generate PDF'}
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="mx-auto mt-3 max-w-[1200px] rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pdfError}
          </div>
        )}
      </div>

      {/* =======================================================
          DOCUMENT
          ======================================================= */}
      <div className="mx-auto max-w-[1100px] space-y-8 px-4 py-8 print:max-w-none print:space-y-0 print:p-0">
        {/* =====================================================
            FIRST TOC
            Highlights first real section.
            ===================================================== */}
        {navigationSections.length > 0 &&
          renderNavigationPage(
            navigationSections[0].id,
            'Document Navigation'
          )}

        {/* =====================================================
            SECTIONS
            Each section is preceded by its own TOC page.
            ===================================================== */}
        {navigationSections.map((section, index) => (
          <div key={section.id} className="space-y-8 print:space-y-0">
            {index > 0 &&
              renderNavigationPage(
                section.id,
                `Navigation for ${section.title}`
              )}

            {renderSectionPage(section, index + 1)}
          </div>
        ))}
      </div>

      {/* =======================================================
          PRINT CSS
          ======================================================= */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          html,
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .preview-page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 !important;
            padding: 18mm 18mm 18mm 18mm !important;
            break-after: page;
            page-break-after: always;
          }

          .preview-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          a {
            color: inherit !important;
            text-decoration: none !important;
          }

          iframe {
            border: none !important;
          }
        }
      `}</style>
    </main>
  );
}