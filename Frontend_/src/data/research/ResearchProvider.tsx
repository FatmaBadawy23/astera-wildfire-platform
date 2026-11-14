import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCatalogRepository } from "@/data/catalog/CatalogProvider";
import { createLocalProjectRepository } from "./localProjectRepository";
import type { ProjectInput, ResearchProjectRepository } from "./projectRepository";

const ProjectRepositoryContext = createContext<ResearchProjectRepository | null>(null);

/**
 * Provides the research-project repository: browser storage today. A backend adapter can be passed here later
 * (or selected by data mode) without changing any page. Tests may pass their own repository.
 */
export function ResearchProvider({ repository, children }: { repository?: ResearchProjectRepository; children: ReactNode }) {
  const [repo] = useState(() => repository ?? createLocalProjectRepository());
  return <ProjectRepositoryContext.Provider value={repo}>{children}</ProjectRepositoryContext.Provider>;
}

export function useProjectRepository(): ResearchProjectRepository {
  const repo = useContext(ProjectRepositoryContext);
  if (!repo) throw new Error("useProjectRepository must be used inside <ResearchProvider>");
  return repo;
}

export const projectKeys = {
  all: ["research", "projects"] as const,
  one: (id: string) => ["research", "projects", id] as const,
};

/** Refreshes the project queries when another tab changes the stored projects. */
function useCrossTabRefresh() {
  const repo = useProjectRepository();
  const client = useQueryClient();
  useEffect(() => repo.subscribe(() => void client.invalidateQueries({ queryKey: projectKeys.all })), [repo, client]);
}

export function useProjects() {
  const repo = useProjectRepository();
  useCrossTabRefresh();
  return useQuery({ queryKey: projectKeys.all, queryFn: () => repo.listProjects(), staleTime: 0, retry: false });
}

export function useProject(id: string) {
  const repo = useProjectRepository();
  useCrossTabRefresh();
  return useQuery({ queryKey: projectKeys.one(id), queryFn: () => repo.getProject(id), staleTime: 0, retry: false });
}

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: projectKeys.all });
}

export function useCreateProject() {
  const repo = useProjectRepository();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: ProjectInput) => repo.createProject(input), onSuccess: invalidate });
}

export function useUpdateProject(id: string) {
  const repo = useProjectRepository();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: ProjectInput) => repo.updateProject(id, input), onSuccess: invalidate });
}

export function useDeleteProject() {
  const repo = useProjectRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteProject(id),
    onSuccess: (_d, id) => {
      client.removeQueries({ queryKey: projectKeys.one(id) });
      return client.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

/**
 * Links a dataset to a project, but only if it is an accessible dataset in the current catalog: unconnected sources
 * and unknown IDs are refused (the catalog throws "not-found"), so they can never be stored as usable datasets.
 */
export function useLinkDataset() {
  const projects = useProjectRepository();
  const catalog = useCatalogRepository();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ projectId, datasetId }: { projectId: string; datasetId: string }) => {
      const dataset = await catalog.getDataset(datasetId);
      return projects.linkDataset(projectId, dataset.id);
    },
    onSuccess: invalidate,
  });
}

/** Removes a dataset from a project. Allowed for any stored ID, including ones no longer in the catalog. */
export function useUnlinkDataset() {
  const projects = useProjectRepository();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ projectId, datasetId }: { projectId: string; datasetId: string }) => projects.unlinkDataset(projectId, datasetId),
    onSuccess: invalidate,
  });
}
