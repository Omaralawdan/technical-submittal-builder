'use client';

import {
  useEffect,
  useState,
  type ChangeEvent,
} from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type Project = {
  id: string;
  project_name: string;
  client_name: string | null;
  consultant: string | null;
  contractor: string | null;
  client_logo_path: string | null;
  consultant_logo_path: string | null;
  contractor_logo_path: string | null;
};

type System = {
  id: string;
  name: string;
  description: string | null;
};

type ProjectSystem = {
  id: string;
  system_id: string | null;
  custom_system_name: string | null;
  systems: {
    id: string;
    name: string;
    description: string | null;
  }[];
};

type LogoType =
  | 'client'
  | 'consultant'
  | 'contractor';

type LogoPaths = {
  client: string | null;
  consultant: string | null;
  contractor: string | null;
};

type LogoUrls = {
  client: string | null;
  consultant: string | null;
  contractor: string | null;
};

const LOGO_BUCKET = 'project-logos';

const LOGO_CONFIG: Record<
  LogoType,
  {
    label: string;
    description: string;
    databaseField:
      | 'client_logo_path'
      | 'consultant_logo_path'
      | 'contractor_logo_path';
  }
> = {
  client: {
    label: 'Client Logo',
    description: 'Logo displayed for the client on the technical submittal cover.',
    databaseField: 'client_logo_path',
  },
  consultant: {
    label: 'Consultant Logo',
    description: 'Logo displayed for the consultant on the technical submittal cover.',
    databaseField: 'consultant_logo_path',
  },
  contractor: {
    label: 'Contractor Logo',
    description: 'Logo displayed for the contractor on the technical submittal cover.',
    databaseField: 'contractor_logo_path',
  },
};

export default function ProjectDetailsPage() {
  const supabase = createClient();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] =
    useState<Project | null>(null);

  const [systems, setSystems] =
    useState<System[]>([]);

  const [projectSystems, setProjectSystems] =
    useState<ProjectSystem[]>([]);

  const [showSystems, setShowSystems] =
    useState(false);

  const [savingSystemId, setSavingSystemId] =
    useState<string | null>(null);

  const [removingSystemId, setRemovingSystemId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [showCustomForm, setShowCustomForm] =
    useState(false);

  const [customSystemName, setCustomSystemName] =
    useState('');

  const [savingCustom, setSavingCustom] =
    useState(false);

  const [logoPaths, setLogoPaths] =
    useState<LogoPaths>({
      client: null,
      consultant: null,
      contractor: null,
    });

  const [logoUrls, setLogoUrls] =
    useState<LogoUrls>({
      client: null,
      consultant: null,
      contractor: null,
    });

  const [uploadingLogo, setUploadingLogo] =
    useState<LogoType | null>(null);

  const [logoMessage, setLogoMessage] =
    useState('');

  const [logoError, setLogoError] =
    useState('');

  useEffect(() => {
    async function loadData() {
      const [
        projectResult,
        systemsResult,
        projectSystemsResult,
      ] = await Promise.all([
        supabase
          .from('projects')
          .select(
            `
              id,
              project_name,
              client_name,
              consultant,
              contractor,
              client_logo_path,
              consultant_logo_path,
              contractor_logo_path
            `
          )
          .eq('id', projectId)
          .single(),

        supabase
          .from('systems')
          .select(
            'id, name, description'
          )
          .order('name'),

        supabase
          .from('project_systems')
          .select(`
            id,
            system_id,
            custom_system_name,
            systems (
              id,
              name,
              description
            )
          `)
          .eq('project_id', projectId),
      ]);

      if (projectResult.error) {
        console.error(
          'PROJECT ERROR:',
          projectResult.error.message
        );
      } else {
        const loadedProject =
          projectResult.data as Project;

        setProject(loadedProject);

        const loadedPaths: LogoPaths = {
          client:
            loadedProject.client_logo_path,
          consultant:
            loadedProject.consultant_logo_path,
          contractor:
            loadedProject.contractor_logo_path,
        };

        setLogoPaths(loadedPaths);

        await loadLogoUrls(loadedPaths);
      }

      if (systemsResult.error) {
        console.error(
          'SYSTEMS ERROR:',
          systemsResult.error.message
        );
      } else {
        setSystems(
          systemsResult.data || []
        );
      }

      if (projectSystemsResult.error) {
        console.error(
          'PROJECT SYSTEMS ERROR:',
          projectSystemsResult.error.message
        );
      } else {
        setProjectSystems(
          (projectSystemsResult.data || []) as ProjectSystem[]
        );
      }

      setLoading(false);
    }

    if (projectId) {
      loadData();
    }
  }, [projectId]);

  async function loadLogoUrls(
    paths: LogoPaths
  ) {
    const nextUrls: LogoUrls = {
      client: null,
      consultant: null,
      contractor: null,
    };

    const entries: [
      LogoType,
      string | null
    ][] = [
      ['client', paths.client],
      ['consultant', paths.consultant],
      ['contractor', paths.contractor],
    ];

    for (const [type, path] of entries) {
      if (!path) {
        continue;
      }

      const { data, error } =
        await supabase.storage
          .from(LOGO_BUCKET)
          .createSignedUrl(
            path,
            60 * 60
          );

      if (error) {
        console.error(
          `LOGO URL ERROR (${type}):`,
          error.message
        );
        continue;
      }

      nextUrls[type] =
        data?.signedUrl || null;
    }

    setLogoUrls(nextUrls);
  }

  async function handleLogoUpload(
    type: LogoType,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    setLogoMessage('');
    setLogoError('');

    if (!file.type.startsWith('image/')) {
      setLogoError(
        'Please select an image file.'
      );
      return;
    }

    const maxSize =
      5 * 1024 * 1024;

    if (file.size > maxSize) {
      setLogoError(
        'Logo file must be 5 MB or smaller.'
      );
      return;
    }

    setUploadingLogo(type);

    try {
      const config =
        LOGO_CONFIG[type];

      const oldPath =
        logoPaths[type];

      const extension =
        getFileExtension(file.name);

      const filePath =
        `${projectId}/${type}-${Date.now()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from(LOGO_BUCKET)
          .upload(
            filePath,
            file,
            {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type,
            }
          );

      if (uploadError) {
        throw new Error(
          uploadError.message
        );
      }

      const updatePayload: Record<
        string,
        string
      > = {
        [config.databaseField]:
          filePath,
      };

      const { error: updateError } =
        await supabase
          .from('projects')
          .update(updatePayload)
          .eq('id', projectId);

      if (updateError) {
        await supabase.storage
          .from(LOGO_BUCKET)
          .remove([filePath]);

        throw new Error(
          updateError.message
        );
      }

      if (oldPath) {
        const { error: removeOldError } =
          await supabase.storage
            .from(LOGO_BUCKET)
            .remove([oldPath]);

        if (removeOldError) {
          console.warn(
            'Could not remove old logo:',
            removeOldError.message
          );
        }
      }

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from(LOGO_BUCKET)
          .createSignedUrl(
            filePath,
            60 * 60
          );

      if (signedError) {
        throw new Error(
          signedError.message
        );
      }

      const nextPaths = {
        ...logoPaths,
        [type]: filePath,
      };

      const nextUrls = {
        ...logoUrls,
        [type]:
          signedData?.signedUrl || null,
      };

      setLogoPaths(nextPaths);
      setLogoUrls(nextUrls);

      setProject((current) =>
        current
          ? {
              ...current,
              [config.databaseField]:
                filePath,
            }
          : current
      );

      setLogoMessage(
        `${config.label} uploaded successfully.`
      );
    } catch (error) {
      console.error(
        'LOGO UPLOAD ERROR:',
        error
      );

      setLogoError(
        error instanceof Error
          ? error.message
          : 'Could not upload logo.'
      );
    } finally {
      setUploadingLogo(null);
    }
  }

  async function handleRemoveLogo(
    type: LogoType
  ) {
    const config =
      LOGO_CONFIG[type];

    const currentPath =
      logoPaths[type];

    if (!currentPath) {
      return;
    }

    const confirmed =
      window.confirm(
        `Remove ${config.label}?`
      );

    if (!confirmed) {
      return;
    }

    setUploadingLogo(type);
    setLogoMessage('');
    setLogoError('');

    try {
      const { error: removeError } =
        await supabase.storage
          .from(LOGO_BUCKET)
          .remove([currentPath]);

      if (removeError) {
        throw new Error(
          removeError.message
        );
      }

      const updatePayload: Record<
        string,
        null
      > = {
        [config.databaseField]:
          null,
      };

      const { error: updateError } =
        await supabase
          .from('projects')
          .update(updatePayload)
          .eq('id', projectId);

      if (updateError) {
        throw new Error(
          updateError.message
        );
      }

      setLogoPaths((current) => ({
        ...current,
        [type]: null,
      }));

      setLogoUrls((current) => ({
        ...current,
        [type]: null,
      }));

      setProject((current) =>
        current
          ? {
              ...current,
              [config.databaseField]:
                null,
            }
          : current
      );

      setLogoMessage(
        `${config.label} removed successfully.`
      );
    } catch (error) {
      console.error(
        'REMOVE LOGO ERROR:',
        error
      );

      setLogoError(
        error instanceof Error
          ? error.message
          : 'Could not remove logo.'
      );
    } finally {
      setUploadingLogo(null);
    }
  }

  async function handleAddSystem(
    system: System
  ) {
    setSavingSystemId(system.id);
    setMessage('');

    const { data, error } =
      await supabase
        .from('project_systems')
        .insert({
          project_id: projectId,
          system_id: system.id,
        })
        .select(`
          id,
          custom_system_name,
          systems (
            id,
            name,
            description
          )
        `)
        .single();

    if (error) {
      if (error.code === '23505') {
        setMessage(
          `${system.name} is already added to this project.`
        );
      } else {
        console.error(
          'ADD SYSTEM ERROR:',
          error.message
        );

        setMessage(
          `Could not add system: ${error.message}`
        );
      }
    } else {
      const newProjectSystem: ProjectSystem = {
        id: data.id,
        system_id: system.id,
        custom_system_name: null,
        systems: [
          {
            id: system.id,
            name: system.name,
            description:
              system.description,
          },
        ],
      };

      setProjectSystems(
        (current) => [
          ...current,
          newProjectSystem,
        ]
      );

      setMessage(
        `${system.name} added to this project successfully.`
      );
    }

    setSavingSystemId(null);
  }

  async function handleAddCustomSystem() {
    const name =
      customSystemName.trim();

    if (!name) {
      setMessage(
        'Please enter a custom system name.'
      );
      return;
    }

    setSavingCustom(true);
    setMessage('');

    const { data, error } =
      await supabase
        .from('project_systems')
        .insert({
          project_id: projectId,
          system_id: null,
          custom_system_name: name,
        })
        .select(`
          id,
          custom_system_name,
          systems (
            id,
            name,
            description
          )
        `)
        .single();

    if (error) {
      console.error(
        'ADD CUSTOM SYSTEM ERROR:',
        error.message
      );

      setMessage(
        `Could not add custom system: ${error.message}`
      );
    } else {
      setProjectSystems(
        (current) => [
          ...current,
          data as ProjectSystem,
        ]
      );

      setMessage(
        `${name} added to this project successfully.`
      );

      setCustomSystemName('');
      setShowCustomForm(false);
    }

    setSavingCustom(false);
  }

  async function handleRemoveSystem(
    projectSystem: ProjectSystem
  ) {
    const linkedSystem =
      projectSystem.systems?.[0] ||
      systems.find(
        (system) =>
          system.id === projectSystem.system_id
      );

    const systemName =
      projectSystem.custom_system_name ||
      linkedSystem?.name ||
      'this system';

    const confirmed =
      window.confirm(
        `Remove "${systemName}" from this project?\n\nThis will remove the system from this project only. It will NOT delete the system from the system catalog.`
      );

    if (!confirmed) {
      return;
    }

    setRemovingSystemId(projectSystem.id);
    setMessage('');

    try {
      const {
        count,
        error: submissionsError,
      } = await supabase
        .from('submissions')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq(
          'project_system_id',
          projectSystem.id
        );

      if (submissionsError) {
        console.error(
          'CHECK SYSTEM SUBMISSIONS ERROR:',
          submissionsError.message
        );

        setMessage(
          `Could not check submissions before removing the system: ${submissionsError.message}`
        );

        return;
      }

      if ((count || 0) > 0) {
        setMessage(
          `Cannot remove "${systemName}" because it has ${count} submission(s) linked to it.`
        );

        return;
      }

      const { error: deleteError } =
        await supabase
          .from('project_systems')
          .delete()
          .eq('id', projectSystem.id)
          .eq('project_id', projectId);

      if (deleteError) {
        console.error(
          'REMOVE SYSTEM ERROR:',
          deleteError.message
        );

        setMessage(
          `Could not remove system: ${deleteError.message}`
        );

        return;
      }

      setProjectSystems(
        (current) =>
          current.filter(
            (item) =>
              item.id !== projectSystem.id
          )
      );

      setMessage(
        `"${systemName}" was removed from this project successfully.`
      );
    } finally {
      setRemovingSystemId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">
          Loading project...
        </p>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-red-600">
          Project not found.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">

      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-8 py-5">
          <h1 className="text-2xl font-bold text-gray-900">
            {project.project_name}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Project Details
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-10">

        <div className="rounded-2xl bg-white p-8 shadow-sm">

          {/* Project Information */}

          <h2 className="text-xl font-semibold text-gray-900">
            Project Information
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-2">

            <div>
              <p className="text-sm text-gray-500">
                Project Name
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {project.project_name}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Client
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {project.client_name || '-'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Consultant
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {project.consultant || '-'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Contractor
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {project.contractor || '-'}
              </p>
            </div>

          </div>

          {/* Project Branding */}

          <div className="mt-10 border-t pt-8">

            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Project Branding
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Upload the Client, Consultant and Contractor logos
                that will appear on the Technical Submittal cover.
              </p>
            </div>

            {logoMessage && (
              <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {logoMessage}
              </div>
            )}

            {logoError && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {logoError}
              </div>
            )}

            <div className="mt-6 grid gap-6 md:grid-cols-3">

              <LogoCard
                type="client"
                label={LOGO_CONFIG.client.label}
                description={LOGO_CONFIG.client.description}
                imageUrl={logoUrls.client}
                uploading={uploadingLogo === 'client'}
                onUpload={handleLogoUpload}
                onRemove={handleRemoveLogo}
              />

              <LogoCard
                type="consultant"
                label={LOGO_CONFIG.consultant.label}
                description={LOGO_CONFIG.consultant.description}
                imageUrl={logoUrls.consultant}
                uploading={uploadingLogo === 'consultant'}
                onUpload={handleLogoUpload}
                onRemove={handleRemoveLogo}
              />

              <LogoCard
                type="contractor"
                label={LOGO_CONFIG.contractor.label}
                description={LOGO_CONFIG.contractor.description}
                imageUrl={logoUrls.contractor}
                uploading={uploadingLogo === 'contractor'}
                onUpload={handleLogoUpload}
                onRemove={handleRemoveLogo}
              />

            </div>

          </div>

          {/* Systems */}

          <div className="mt-10 border-t pt-8">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Systems
                </h2>

                <p className="mt-2 text-gray-500">
                  Select and manage systems for this project.
                </p>
              </div>

              <button
                onClick={() =>
                  setShowSystems(!showSystems)
                }
                className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white"
              >
                + Add System
              </button>

            </div>

            {/* Added Systems */}

            {projectSystems.length > 0 && (
              <div className="mt-6">

                <h3 className="text-lg font-semibold text-gray-900">
                  Added Systems
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-3">

                  {projectSystems.map(
                    (projectSystem) => {

                      const linkedSystem =
                        projectSystem.systems?.[0] ||
                        systems.find(
                          (system) =>
                            system.id ===
                            projectSystem.system_id
                        );

                      const systemName =
                        projectSystem.custom_system_name ||
                        linkedSystem?.name ||
                        'Unnamed System';

                      const description =
                        projectSystem.custom_system_name
                          ? 'Custom system'
                          : linkedSystem?.description ||
                            'No description';

                      return (
                        <div
                          key={projectSystem.id}
                          className="rounded-xl border border-green-200 bg-green-50 p-5"
                        >

                          <a
                            href={`/projects/${projectId}/systems/${projectSystem.id}`}
                            className="block"
                          >

                            <h4 className="font-semibold text-gray-900">
                              {systemName}
                            </h4>

                            <p className="mt-2 text-sm text-gray-500">
                              {description}
                            </p>

                            <p className="mt-4 text-xs font-medium text-green-700">
                              Open System →
                            </p>

                          </a>

                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveSystem(
                                projectSystem
                              )
                            }
                            disabled={
                              removingSystemId ===
                              projectSystem.id
                            }
                            className="mt-4 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {removingSystemId ===
                            projectSystem.id
                              ? 'Removing...'
                              : 'Remove System'}
                          </button>

                        </div>
                      );
                    }
                  )}

                </div>
              </div>
            )}

            {message && (
              <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                {message}
              </div>
            )}

            {/* Available Systems */}

            {showSystems && (
              <div className="mt-6">

                <h3 className="text-lg font-semibold text-gray-900">
                  Available Systems
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-3">

                  {systems.map((system) => (
                    <button
                      key={system.id}
                      onClick={() =>
                        handleAddSystem(system)
                      }
                      disabled={
                        savingSystemId !== null
                      }
                      className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
                    >

                      <h3 className="font-semibold text-gray-900">
                        {savingSystemId === system.id
                          ? 'Adding...'
                          : system.name}
                      </h3>

                      <p className="mt-2 text-sm text-gray-500">
                        {system.description ||
                          'No description'}
                      </p>

                    </button>
                  ))}

                  {/* Other / Custom System */}

                  <button
                    onClick={() => {
                      setShowCustomForm(true);
                      setMessage('');
                    }}
                    className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-5 text-left hover:border-gray-500 hover:bg-gray-50"
                  >

                    <h3 className="font-semibold text-gray-900">
                      Other / Custom System
                    </h3>

                    <p className="mt-2 text-sm text-gray-500">
                      Add a system that is not available in
                      the standard list.
                    </p>

                  </button>

                </div>
              </div>
            )}

            {/* Custom System Form */}

            {showCustomForm && (
              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6">

                <h3 className="text-lg font-semibold text-gray-900">
                  Add Custom System
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Enter the name of the system.
                </p>

                <input
                  type="text"
                  value={customSystemName}
                  onChange={(e) =>
                    setCustomSystemName(
                      e.target.value
                    )
                  }
                  placeholder="Example: Building Automation System"
                  className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                />

                <div className="mt-4 flex gap-3">

                  <button
                    onClick={handleAddCustomSystem}
                    disabled={savingCustom}
                    className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {savingCustom
                      ? 'Adding...'
                      : 'Add Custom System'}
                  </button>

                  <button
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomSystemName('');
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700"
                  >
                    Cancel
                  </button>

                </div>

              </div>
            )}

          </div>

        </div>

      </div>

    </main>
  );
}

function LogoCard({
  type,
  label,
  description,
  imageUrl,
  uploading,
  onUpload,
  onRemove,
}: {
  type: LogoType;
  label: string;
  description: string;
  imageUrl: string | null;
  uploading: boolean;
  onUpload: (
    type: LogoType,
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  onRemove: (
    type: LogoType
  ) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">

      <h3 className="font-semibold text-gray-900">
        {label}
      </h3>

      <p className="mt-2 min-h-[48px] text-xs leading-5 text-gray-500">
        {description}
      </p>

      <div className="mt-4 flex h-36 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white p-4">

        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                />
                <circle
                  cx="8.5"
                  cy="8.5"
                  r="1.5"
                />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>

            <p className="mt-2 text-xs text-gray-400">
              No logo uploaded
            </p>
          </div>
        )}

      </div>

      <div className="mt-4 flex gap-2">

        <label
          className={`flex-1 cursor-pointer rounded-lg px-3 py-2.5 text-center text-sm font-medium transition ${
            uploading
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-black text-white hover:bg-gray-800'
          }`}
        >
          {uploading
            ? 'Uploading...'
            : imageUrl
              ? 'Replace Logo'
              : 'Upload Logo'}

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            disabled={uploading}
            onChange={(event) =>
              onUpload(type, event)
            }
          />
        </label>

        {imageUrl && (
          <button
            type="button"
            onClick={() =>
              onRemove(type)
            }
            disabled={uploading}
            className="rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        )}

      </div>

      <p className="mt-2 text-center text-[11px] text-gray-400">
        PNG, JPG, WEBP or SVG · Max 5 MB
      </p>

    </div>
  );
}

function getFileExtension(
  fileName: string
) {
  const parts =
    fileName.split('.');

  if (parts.length < 2) {
    return 'png';
  }

  const extension =
    parts[parts.length - 1]
      .toLowerCase();

  const allowed =
    [
      'png',
      'jpg',
      'jpeg',
      'webp',
      'svg',
    ];

  if (!allowed.includes(extension)) {
    return 'png';
  }

  return extension;
}
