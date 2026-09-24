import type {
  AssetDefinition,
  ElectricalBtConfig,
  ElectricalBtPreview,
  ElectricalMvConfig,
  ElectricalMvPreview,
  PortalUser,
  ItsDesign,
  ItsPvBlock,
  ItsValidation,
  Project,
  ProjectCreate,
  ProjectSummary,
} from "../types/project";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (!isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, {
    ...init,
    headers,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.blob()) as T;
}

export const api = {
  me: () => request<PortalUser>("/pv/api/me"),

  listProjects: () => request<ProjectSummary[]>("/pv/api/projects"),

  getProject: (id: string) => request<Project>(`/pv/api/projects/${id}`),

  createProject: (body: ProjectCreate) =>
    request<Project>("/pv/api/projects", { method: "POST", body: JSON.stringify(body) }),

  putProject: (project: Project) =>
    request<Project>(`/pv/api/projects/${project.id}`, {
      method: "PUT",
      body: JSON.stringify(project),
    }),

  patchProject: (id: string, body: Partial<Project>) =>
    request<Project>(`/pv/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteProject: (id: string) => request<void>(`/pv/api/projects/${id}`, { method: "DELETE" }),

  duplicateProject: (id: string) =>
    request<Project>(`/pv/api/projects/${id}/duplicate`, { method: "POST" }),

  importProject: (project: Project) =>
    request<Project>("/pv/api/projects/import", { method: "POST", body: JSON.stringify(project) }),

  exportCatalog: (id: string) =>
    request<{ catalog: AssetDefinition[] }>(`/pv/api/projects/${id}/catalog/export`),

  importCatalog: (id: string, catalog: AssetDefinition[]) =>
    request<{ imported: number; catalog: AssetDefinition[] }>(
      `/pv/api/projects/${id}/catalog/import`,
      { method: "POST", body: JSON.stringify({ catalog }) },
    ),

  downloadBtTemplate: (id: string) =>
    request<Blob>(`/pv/api/projects/${id}/electrical/templates/bt`),

  downloadMvTemplate: (id: string) =>
    request<Blob>(`/pv/api/projects/${id}/electrical/templates/mv`),

  parseBtElectrical: (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<{ preview: ElectricalBtPreview; config: ElectricalBtConfig }>(
      `/pv/api/projects/${id}/electrical/bt/parse`,
      { method: "POST", body },
    );
  },

  importBtElectrical: (id: string, file: File, mode: "replace" | "merge") => {
    const body = new FormData();
    body.append("file", file);
    return request<{
      mode: string;
      preview: ElectricalBtPreview;
      electrical_bt: ElectricalBtConfig;
      project: Project;
    }>(`/pv/api/projects/${id}/electrical/bt/import?mode=${mode}`, { method: "POST", body });
  },

  parseMvElectrical: (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<{ preview: ElectricalMvPreview; config: ElectricalMvConfig }>(
      `/pv/api/projects/${id}/electrical/mv/parse`,
      { method: "POST", body },
    );
  },

  getItsDesign: (id: string) => request<ItsDesign>(`/pv/api/projects/${id}/its-design`),

  putItsDesign: (id: string, design: ItsDesign) =>
    request<ItsDesign>(`/pv/api/projects/${id}/its-design`, {
      method: "PUT",
      body: JSON.stringify(design),
    }),

  createItsBlock: (id: string, body: { name?: string; notes?: string; seed?: boolean }) =>
    request<ItsPvBlock>(`/pv/api/projects/${id}/its-design/blocks`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getItsBlock: (id: string, blockId: string) =>
    request<ItsPvBlock>(`/pv/api/projects/${id}/its-design/blocks/${blockId}`),

  patchItsBlock: (id: string, blockId: string, body: Partial<ItsPvBlock>) =>
    request<ItsPvBlock>(`/pv/api/projects/${id}/its-design/blocks/${blockId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteItsBlock: (id: string, blockId: string) =>
    request<void>(`/pv/api/projects/${id}/its-design/blocks/${blockId}`, { method: "DELETE" }),

  syncItsStrings: (id: string, blockId: string) =>
    request<{ block: ItsPvBlock; validation: ItsValidation }>(
      `/pv/api/projects/${id}/its-design/blocks/${blockId}/sync-strings`,
      { method: "POST" },
    ),

  validateItsBlock: (id: string, blockId: string) =>
    request<ItsValidation>(`/pv/api/projects/${id}/its-design/blocks/${blockId}/validate`),

  importMvElectrical: (id: string, file: File, mode: "replace" | "merge") => {
    const body = new FormData();
    body.append("file", file);
    return request<{
      mode: string;
      preview: ElectricalMvPreview;
      electrical_mv: ElectricalMvConfig;
      project: Project;
    }>(`/pv/api/projects/${id}/electrical/mv/import?mode=${mode}`, { method: "POST", body });
  },
};

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
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
