/** Addresses of the research-project pages (stage R2). */
export const PROJECTS_PATH = "/research/projects";
export const NEW_PROJECT_PATH = `${PROJECTS_PATH}/new`;
export const projectPath = (id: string) => `${PROJECTS_PATH}/${encodeURIComponent(id)}`;
export const editProjectPath = (id: string) => `${projectPath(id)}/edit`;
