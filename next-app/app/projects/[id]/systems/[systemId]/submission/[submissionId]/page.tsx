'use client';

import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

type Project = {
  id: string;
  project_name: string;
  client_name: string | null;
  consultant: string | null;
  contractor: string | null;
};

type ProjectSystem = {
  id: string;
  custom_system_name: string | null;
  systems: {
    name: string;
  }[];
};

type Submission = {
  id: string;
  revision: string | null;
  submission_date: string | null;
  status: string;
};

type Structure = {
  id: string;
  structure_name: string;
};

type Section = {
  id: string;
  title: string;
  section_order: number;
  is_custom: boolean;
  is_required: boolean;
};

type SectionType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

type Readiness = {
  loading: boolean;
  ready: boolean;
  label: string;
};

function SortableSection({
  section,
  children,
}: {
  section: Section;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      <div className="flex items-stretch gap-3">
        <button
          type="button"
          {...listeners}
          className="flex w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold tracking-tighter text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
          title="Drag to reorder"
          aria-label={`Drag ${section.title} to reorder`}
        >
          ⋮⋮
        </button>

        <div className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;
  const systemId = params.systemId as string;
  const submissionId = params.submissionId as string;

  const supabase = createClient();

  const [project, setProject] =
    useState<Project | null>(null);

  const [projectSystem, setProjectSystem] =
    useState<ProjectSystem | null>(null);

  const [submission, setSubmission] =
    useState<Submission | null>(null);

  const [structure, setStructure] =
    useState<Structure | null>(null);

  const [sections, setSections] =
    useState<Section[]>([]);

  const [availableSectionTypes, setAvailableSectionTypes] =
    useState<SectionType[]>([]);

  const [readiness, setReadiness] =
    useState<Record<string, Readiness>>({});

  const [showAddSection, setShowAddSection] =
    useState(false);

  const [addingSection, setAddingSection] =
    useState(false);

  const [addSectionError, setAddSectionError] =
    useState('');

  const [customSectionTitle, setCustomSectionTitle] =
    useState('');

  const [addingCustomSection, setAddingCustomSection] =
    useState(false);

  const [editingSectionId, setEditingSectionId] =
    useState<string | null>(null);

  const [editingSectionTitle, setEditingSectionTitle] =
    useState('');

  const [savingSectionTitle, setSavingSectionTitle] =
    useState(false);

  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    async function loadSubmission() {
      try {
        setLoading(true);
        setError('');

        const {
          data: projectData,
          error: projectError,
        } = await supabase
          .from('projects')
          .select(
            'id, project_name, client_name, consultant, contractor'
          )
          .eq('id', projectId)
          .single();

        if (projectError) {
          throw projectError;
        }

        const {
          data: projectSystemData,
          error: projectSystemError,
        } = await supabase
          .from('project_systems')
          .select(
            `
              id,
              custom_system_name,
              systems (
                name
              )
            `
          )
          .eq('id', systemId)
          .single();

        if (projectSystemError) {
          throw projectSystemError;
        }

        const {
          data: submissionData,
          error: submissionError,
        } = await supabase
          .from('submissions')
          .select(
            'id, revision, submission_date, status'
          )
          .eq('id', submissionId)
          .single();

        if (submissionError) {
          throw submissionError;
        }

        const {
          data: structureData,
          error: structureError,
        } = await supabase
          .from('submission_structures')
          .select(
            'id, structure_name'
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

        const {
          data: sectionsData,
          error: sectionsError,
        } = await supabase
          .from('submission_sections')
          .select(
            'id, title, section_order, is_custom, is_required'
          )
          .eq(
            'structure_id',
            structureData.id
          )
          .order('section_order', {
            ascending: true,
          });

        if (sectionsError) {
          throw sectionsError;
        }

        const {
          data: sectionTypesData,
          error: sectionTypesError,
        } = await supabase
          .from('section_types')
          .select(
            'id, code, name, description'
          )
          .in('code', [
            'COMPANY_PROFILE',
            'QUALITY_CERTIFICATES',
            'PREVIOUS_APPROVAL',
          ])
          .order('name', {
            ascending: true,
          });

        if (sectionTypesError) {
          console.error(
            'Could not load optional section types:',
            sectionTypesError
          );
        }

        setProject(projectData);

        setProjectSystem(
          projectSystemData as unknown as ProjectSystem
        );

        setSubmission(submissionData);

        setStructure(structureData);

        setSections(
          (sectionsData || []) as Section[]
        );

        setAvailableSectionTypes(
          sectionTypesData || []
        );
      } catch (err: any) {
        console.error(err);

        setError(
          err?.message ||
            'Could not load submission.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadSubmission();
  }, [
    projectId,
    systemId,
    submissionId,
  ]);

  function getSystemName() {
    if (!projectSystem) {
      return '';
    }

    return (
      projectSystem.custom_system_name ||
      projectSystem.systems?.[0]?.name ||
      'Custom System'
    );
  }

  function getSectionUrl(
    section: Section
  ) {
    const base =
      `/projects/${projectId}` +
      `/systems/${systemId}` +
      `/submission/${submissionId}` +
      `/sections`;

    if (section.is_custom) {
      return `${base}/custom/${section.id}`;
    }

    const sectionUrls: Record<string, string> = {
      Cover: `${base}/cover`,
      'Table of Contents': `${base}/toc`,
      'Compliance Sheet': `${base}/compliance-sheet`,
      'Material List': `${base}/material-list`,
      'Country of Origin': `${base}/country-of-origin`,
      'Material Selection / Technical Selection':
        `${base}/material-selection`,
      'Data Sheets': `${base}/data-sheets`,
      'Reference List': `${base}/reference-list`,
      'Company Profile': `${base}/company-profile`,
      'Quality Certificates':
        `${base}/quality-certificates`,
      'Previous Approval':
        `${base}/previous-approval`,
    };

    return sectionUrls[section.title] || '#';
  }

  function isSectionAvailable(
    section: Section
  ) {
    return getSectionUrl(section) !== '#';
  }

  function isSectionAlreadyAdded(
    sectionType: SectionType
  ) {
    return sections.some(
      (section) =>
        section.title.trim().toLowerCase() ===
        sectionType.name.trim().toLowerCase()
    );
  }

  function getSectionKind(
    section: Section
  ) {
    if (section.is_custom) {
      return 'Custom';
    }

    if (
      section.title === 'Company Profile' ||
      section.title === 'Quality Certificates' ||
      section.title === 'Previous Approval'
    ) {
      return 'Optional';
    }

    return 'Standard';
  }

  function getReadinessForSection(
    section: Section
  ): Readiness {
    const existing = readiness[section.id];

    if (existing) {
      return existing;
    }

    /*
     * At this stage we consider a section ready
     * when its page exists.
     *
     * The actual content validation will be connected
     * to each section's data in the PDF phase.
     */
    if (isSectionAvailable(section)) {
      return {
        loading: false,
        ready: true,
        label: 'Ready',
      };
    }

    return {
      loading: false,
      ready: false,
      label: 'Needs setup',
    };
  }

  async function handleDragEnd(
    event: DragEndEvent
  ) {
    const {
      active,
      over,
    } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex =
      sections.findIndex(
        (section) =>
          section.id === active.id
      );

    const newIndex =
      sections.findIndex(
        (section) =>
          section.id === over.id
      );

    if (
      oldIndex === -1 ||
      newIndex === -1 ||
      oldIndex === newIndex
    ) {
      return;
    }

    const reordered = [...sections];

    const [movedSection] =
      reordered.splice(
        oldIndex,
        1
      );

    reordered.splice(
      newIndex,
      0,
      movedSection
    );

    const updatedSections =
      reordered.map(
        (section, index) => ({
          ...section,
          section_order: index + 1,
        })
      );

    setSections(updatedSections);

    try {
      setError('');

      const updateResults =
        await Promise.all(
          updatedSections.map(
            (section) =>
              supabase
                .from(
                  'submission_sections'
                )
                .update({
                  section_order:
                    section.section_order,
                })
                .eq(
                  'id',
                  section.id
                )
          )
        );

      const failedUpdate =
        updateResults.find(
          (result) =>
            result.error
        );

      if (failedUpdate?.error) {
        throw failedUpdate.error;
      }
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not save section order.'
      );
    }
  }

  async function addSection(
    sectionType: SectionType
  ) {
    if (!structure?.id) {
      setAddSectionError(
        'Submission structure was not found.'
      );
      return;
    }

    if (
      isSectionAlreadyAdded(
        sectionType
      )
    ) {
      setAddSectionError(
        `${sectionType.name} is already added to this Submission.`
      );
      return;
    }

    setAddingSection(true);
    setAddSectionError('');
    setError('');

    try {
      const nextOrder =
        sections.length > 0
          ? Math.max(
              ...sections.map(
                (section) =>
                  section.section_order
              )
            ) + 1
          : 1;

      const {
        data: insertedSection,
        error: insertError,
      } = await supabase
        .from('submission_sections')
        .insert({
          structure_id:
            structure.id,
          section_type_id:
            sectionType.id,
          title:
            sectionType.name,
          section_order:
            nextOrder,
          is_custom:
            false,
          is_required:
            false,
        })
        .select(
          'id, title, section_order, is_custom, is_required'
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      setSections(
        (current) =>
          [
            ...current,
            insertedSection,
          ].sort(
            (a, b) =>
              a.section_order -
              b.section_order
          )
      );

      setShowAddSection(false);
      setAddSectionError('');
    } catch (err: any) {
      console.error(err);

      setAddSectionError(
        err?.message ||
          'Could not add section.'
      );
    } finally {
      setAddingSection(false);
    }
  }

  async function addCustomSection() {
    if (!structure?.id) {
      setAddSectionError(
        'Submission structure was not found.'
      );
      return;
    }

    const title =
      customSectionTitle.trim();

    if (!title) {
      setAddSectionError(
        'Please enter a subject for the Custom Section.'
      );
      return;
    }

    setAddingCustomSection(true);
    setAddSectionError('');
    setError('');

    try {
      const nextOrder =
        sections.length > 0
          ? Math.max(
              ...sections.map(
                (section) =>
                  section.section_order
              )
            ) + 1
          : 1;

      const {
        data: insertedSection,
        error: insertError,
      } = await supabase
        .from('submission_sections')
        .insert({
          structure_id:
            structure.id,
          section_type_id:
            null,
          title,
          section_order:
            nextOrder,
          is_custom:
            true,
          is_required:
            false,
        })
        .select(
          'id, title, section_order, is_custom, is_required'
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      setSections(
        (current) =>
          [
            ...current,
            insertedSection,
          ].sort(
            (a, b) =>
              a.section_order -
              b.section_order
          )
      );

      setCustomSectionTitle('');
      setAddSectionError('');
    } catch (err: any) {
      console.error(err);

      setAddSectionError(
        err?.message ||
          'Could not add Custom Section.'
      );
    } finally {
      setAddingCustomSection(false);
    }
  }

  function startEditingSection(
    section: Section
  ) {
    if (!section.is_custom) {
      return;
    }

    setEditingSectionId(section.id);
    setEditingSectionTitle(section.title);
    setError('');
  }

  function cancelEditingSection() {
    setEditingSectionId(null);
    setEditingSectionTitle('');
  }

  async function saveSectionTitle(
    section: Section
  ) {
    if (!section.is_custom) {
      return;
    }

    const title =
      editingSectionTitle.trim();

    if (!title) {
      setError(
        'Custom Section subject cannot be empty.'
      );
      return;
    }

    setSavingSectionTitle(true);
    setError('');

    try {
      const {
        error: updateError,
      } = await supabase
        .from('submission_sections')
        .update({
          title,
        })
        .eq(
          'id',
          section.id
        );

      if (updateError) {
        throw updateError;
      }

      setSections(
        (current) =>
          current.map(
            (item) =>
              item.id === section.id
                ? {
                    ...item,
                    title,
                  }
                : item
          )
      );

      cancelEditingSection();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not rename section.'
      );
    } finally {
      setSavingSectionTitle(false);
    }
  }

  async function removeSection(
    section: Section
  ) {
    if (
      !section.is_custom &&
      section.title !==
        'Company Profile'
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Remove "${section.title}" from this Submission?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError('');

      const {
        error: deleteError,
      } = await supabase
        .from('submission_sections')
        .delete()
        .eq(
          'id',
          section.id
        );

      if (deleteError) {
        throw deleteError;
      }

      const remainingSections =
        sections
          .filter(
            (item) =>
              item.id !== section.id
          )
          .map(
            (
              item,
              index
            ) => ({
              ...item,
              section_order:
                index + 1,
            })
          );

      setSections(
        remainingSections
      );

      await Promise.all(
        remainingSections.map(
          (item) =>
            supabase
              .from(
                'submission_sections'
              )
              .update({
                section_order:
                  item.section_order,
              })
              .eq(
                'id',
                item.id
              )
        )
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not remove section.'
      );
    }
  }

  async function markSubmissionReady() {
    if (!submission) {
      return;
    }

    setUpdatingStatus(true);
    setError('');

    try {
      const {
        error: updateError,
      } = await supabase
        .from('submissions')
        .update({
          status: 'ready',
        })
        .eq(
          'id',
          submission.id
        );

      if (updateError) {
        throw updateError;
      }

      setSubmission({
        ...submission,
        status: 'ready',
      });
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not update submission status.'
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function markSubmissionDraft() {
    if (!submission) {
      return;
    }

    setUpdatingStatus(true);
    setError('');

    try {
      const {
        error: updateError,
      } = await supabase
        .from('submissions')
        .update({
          status: 'draft',
        })
        .eq(
          'id',
          submission.id
        );

      if (updateError) {
        throw updateError;
      }

      setSubmission({
        ...submission,
        status: 'draft',
      });
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Could not update submission status.'
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-slate-500">
              Loading submission...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !submission) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() =>
              router.back()
            }
            className="mb-6 text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-semibold text-red-800">
              Could not load submission
            </h1>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const readyCount =
    sections.filter(
      (section) =>
        getReadinessForSection(
          section
        ).ready
    ).length;

  const missingCount =
    sections.length -
    readyCount;

  const isReady =
    submission?.status ===
    'ready';

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">

        <button
          onClick={() =>
            router.back()
          }
          className="mb-6 text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to System
        </button>

        {/* Submission Header */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">

            <div>
              <p className="text-sm font-medium text-blue-600">
                Technical Submittal
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Submission
              </h1>

              <p className="mt-2 text-slate-500">
                Manage the complete technical submission structure.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/projects/${projectId}/systems/${systemId}/submission/${submissionId}/preview`
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Preview Submission
              </button>

              {submission?.status ===
              'ready' ? (
                <button
                  type="button"
                  onClick={
                    markSubmissionDraft
                  }
                  disabled={
                    updatingStatus
                  }
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  {updatingStatus
                    ? 'Updating...'
                    : 'Move to Draft'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={
                    markSubmissionReady
                  }
                  disabled={
                    updatingStatus
                  }
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {updatingStatus
                    ? 'Updating...'
                    : 'Mark as Ready'}
                </button>
              )}

              <div className="rounded-xl bg-slate-100 px-5 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Status
                </p>

                <p className="mt-1 font-semibold capitalize text-slate-800">
                  {submission?.status ||
                    'draft'}
                </p>
              </div>

            </div>

          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

        </div>

        {/* Project / Submission Information */}
        <div className="mb-6 grid gap-6 md:grid-cols-2">

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Project Information
            </h2>

            <div className="space-y-3 text-sm">

              <div>
                <span className="text-slate-500">
                  Project
                </span>

                <p className="font-medium text-slate-900">
                  {project?.project_name ||
                    '-'}
                </p>
              </div>

              <div>
                <span className="text-slate-500">
                  Client
                </span>

                <p className="font-medium text-slate-900">
                  {project?.client_name ||
                    '-'}
                </p>
              </div>

              <div>
                <span className="text-slate-500">
                  Consultant
                </span>

                <p className="font-medium text-slate-900">
                  {project?.consultant ||
                    '-'}
                </p>
              </div>

              <div>
                <span className="text-slate-500">
                  Contractor
                </span>

                <p className="font-medium text-slate-900">
                  {project?.contractor ||
                    '-'}
                </p>
              </div>

            </div>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Submission Information
            </h2>

            <div className="space-y-3 text-sm">

              <div>
                <span className="text-slate-500">
                  System
                </span>

                <p className="font-medium text-slate-900">
                  {getSystemName()}
                </p>
              </div>

              <div>
                <span className="text-slate-500">
                  Revision
                </span>

                <p className="font-medium text-slate-900">
                  {submission?.revision ||
                    '-'}
                </p>
              </div>

              <div>
                <span className="text-slate-500">
                  Date
                </span>

                <p className="font-medium text-slate-900">
                  {submission?.submission_date ||
                    '-'}
                </p>
              </div>

              <div>
                <span className="text-slate-500">
                  Structure
                </span>

                <p className="font-medium text-slate-900">
                  {structure?.structure_name ||
                    'Standard'}
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* Readiness Summary */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Sections
            </p>

            <p className="mt-1 text-3xl font-bold text-slate-900">
              {sections.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Ready
            </p>

            <p className="mt-1 text-3xl font-bold text-emerald-600">
              {readyCount}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Needs Setup
            </p>

            <p className="mt-1 text-3xl font-bold text-amber-600">
              {missingCount}
            </p>
          </div>

        </div>

        {/* Submission Structure */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Submission Structure
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Open each section to configure its content.
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Drag the ⋮⋮ handle to reorder sections.
              </p>
            </div>

            <div className="relative">

              <button
                type="button"
                onClick={() => {
                  setShowAddSection(
                    (current) =>
                      !current
                  );

                  setAddSectionError('');
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                + Add Section
              </button>

              {showAddSection && (
                <div className="absolute right-0 z-20 mt-2 w-96 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">

                  <div className="mb-4">
                    <p className="font-semibold text-slate-900">
                      Add Section
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Add an optional database-backed section or create your own custom section.
                    </p>
                  </div>

                  <div className="mb-4">

                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Optional Sections
                    </p>

                    {availableSectionTypes.length ===
                    0 ? (
                      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                        No optional sections are available.
                      </div>
                    ) : (
                      <div className="space-y-2">

                        {availableSectionTypes.map(
                          (sectionType) => {

                            const alreadyAdded =
                              isSectionAlreadyAdded(
                                sectionType
                              );

                            return (
                              <button
                                key={
                                  sectionType.id
                                }
                                type="button"
                                disabled={
                                  addingSection ||
                                  addingCustomSection ||
                                  alreadyAdded
                                }
                                onClick={() =>
                                  addSection(
                                    sectionType
                                  )
                                }
                                className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                                  alreadyAdded
                                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                    : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">

                                  <div>
                                    <p className="text-sm font-medium">
                                      {
                                        sectionType.name
                                      }
                                    </p>

                                    {sectionType.description && (
                                      <p className="mt-1 text-xs text-slate-500">
                                        {
                                          sectionType.description
                                        }
                                      </p>
                                    )}
                                  </div>

                                  {alreadyAdded && (
                                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-500">
                                      Added
                                    </span>
                                  )}

                                </div>
                              </button>
                            );
                          }
                        )}

                      </div>
                    )}

                  </div>

                  <div className="border-t border-slate-200 pt-4">

                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-purple-600">
                      Custom Section
                    </p>

                    <p className="mb-3 text-xs text-slate-500">
                      Enter your own section subject. You can add multiple custom sections.
                    </p>

                    <input
                      type="text"
                      value={
                        customSectionTitle
                      }
                      onChange={(event) =>
                        setCustomSectionTitle(
                          event.target.value
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key ===
                            'Enter' &&
                          !addingCustomSection
                        ) {
                          event.preventDefault();
                          addCustomSection();
                        }
                      }}
                      placeholder="e.g. Siemens Datasheets"
                      disabled={
                        addingSection ||
                        addingCustomSection
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                    />

                    <button
                      type="button"
                      onClick={
                        addCustomSection
                      }
                      disabled={
                        addingSection ||
                        addingCustomSection ||
                        !customSectionTitle.trim()
                      }
                      className="mt-2 w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {addingCustomSection
                        ? 'Adding...'
                        : '+ Add Custom Section'}
                    </button>

                  </div>

                  {addSectionError && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {addSectionError}
                    </div>
                  )}

                </div>
              )}

            </div>

          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map(
                (section) =>
                  section.id
              )}
              strategy={
                verticalListSortingStrategy
              }
            >
              <div className="space-y-3">

                {sections.map(
                  (section) => {

                    const available =
                      isSectionAvailable(
                        section
                      );

                    const url =
                      getSectionUrl(
                        section
                      );

                    const removable =
                      section.is_custom ||
                      section.title ===
                        'Company Profile';

                    const sectionReadiness =
                      getReadinessForSection(
                        section
                      );

                    const editing =
                      editingSectionId ===
                      section.id;

                    return (
                      <SortableSection
                        key={section.id}
                        section={section}
                      >
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                            <div className="flex items-center gap-4">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 font-semibold text-blue-700">
                                {String(
                                  section.section_order
                                ).padStart(
                                  2,
                                  '0'
                                )}
                              </div>

                              <div className="min-w-0">

                                {editing ? (
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

                                    <input
                                      autoFocus
                                      type="text"
                                      value={
                                        editingSectionTitle
                                      }
                                      onChange={(event) =>
                                        setEditingSectionTitle(
                                          event.target.value
                                        )
                                      }
                                      onKeyDown={(event) => {
                                        if (
                                          event.key ===
                                          'Enter'
                                        ) {
                                          saveSectionTitle(
                                            section
                                          );
                                        }

                                        if (
                                          event.key ===
                                          'Escape'
                                        ) {
                                          cancelEditingSection();
                                        }
                                      }}
                                      className="rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-purple-100"
                                    />

                                    <button
                                      type="button"
                                      disabled={
                                        savingSectionTitle
                                      }
                                      onClick={() =>
                                        saveSectionTitle(
                                          section
                                        )
                                      }
                                      className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                                    >
                                      {savingSectionTitle
                                        ? 'Saving...'
                                        : 'Save'}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        savingSectionTitle
                                      }
                                      onClick={
                                        cancelEditingSection
                                      }
                                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                    >
                                      Cancel
                                    </button>

                                  </div>
                                ) : (
                                  <>
                                    <h3 className="font-semibold text-slate-900">
                                      {
                                        section.title
                                      }
                                    </h3>

                                    <div className="mt-1 flex flex-wrap items-center gap-2">

                                      <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600">
                                        {
                                          getSectionKind(
                                            section
                                          )
                                        }
                                      </span>

                                      {section.is_custom && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            startEditingSection(
                                              section
                                            )
                                          }
                                          className="text-xs font-medium text-purple-600 hover:underline"
                                        >
                                          Edit Subject
                                        </button>
                                      )}

                                    </div>
                                  </>
                                )}

                              </div>

                            </div>

                            <div className="flex flex-wrap items-center gap-2">

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  sectionReadiness.ready
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {sectionReadiness.label}
                              </span>

                              {removable && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeSection(
                                      section
                                    )
                                  }
                                  className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                                >
                                  Remove
                                </button>
                              )}

                              {available ? (
                                <a
                                  href={url}
                                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                                >
                                  Open
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
                                >
                                  Coming Soon
                                </button>
                              )}

                            </div>

                          </div>

                        </div>
                      </SortableSection>
                    );
                  }
                )}

              </div>
            </SortableContext>
          </DndContext>

        </div>

        {/* Bottom Actions */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="font-semibold text-slate-900">
              Submission workflow
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Arrange your sections, complete the content, preview the submission, then mark it ready for generation.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/projects/${projectId}/systems/${systemId}/submission/${submissionId}/preview`
              )
            }
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Preview Submission →
          </button>

        </div>

      </div>
    </main>
  );
}