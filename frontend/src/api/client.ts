import type { AssetDefinition, Project, ProjectCreate, ProjectSummary } from "../types/project";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  listProjects: () => request<ProjectSummary[]>("/api/projects"),

  getProject: (id: string) => request<Project>(`/api/projects/${id}`),

  createProject: (body: ProjectCreate) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(body) }),

  putProject: (project: Project) =>
    request<Project>(`/api/projects/${project.id}`, {
      method: "PUT",
      body: JSON.stringify(project),
    }),

  patchProject: (id: string, body: Partial<Project>) =>
    request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),

  duplicateProject: (id: string) =>
    request<Project>(`/api/projects/${id}/duplicate`, { method: "POST" }),

  importProject: (project: Project) =>
    request<Project>("/api/projects/import", { method: "POST", body: JSON.stringify(project) }),

  exportCatalog: (id: string) =>
    request<{ catalog: AssetDefinition[] }>(`/api/projects/${id}/catalog/export`),

  importCatalog: (id: string, catalog: AssetDefinition[]) =>
    request<{ imported: number; catalog: AssetDefinition[] }>(
      `/api/projects/${id}/catalog/import`,
      { method: "POST", body: JSON.stringify({ catalog }) },
    ),
};

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json,.pvdes.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      file
        .text()
        .then((text) => resolve(JSON.parse(text) as unknown))
        .catch(reject);
    };
    input.click();
  });
}
