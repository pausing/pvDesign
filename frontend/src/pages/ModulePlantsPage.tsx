import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, downloadJson, pickJsonFile } from "../api/client";
import { Button, Card, Field, TextInput } from "../components/ui";
import type { AppModule, Project, ProjectSummary } from "../types/project";

const COPY: Record<
  AppModule,
  { title: string; blurb: string; open: (id: string) => string; seedLabel: string }
> = {
  layout_config: {
    title: "Layout configuration plants",
    blurb: "Independent plants for placing tables, string boxes, and the ITS.",
    open: (id) => `/layout-config/${id}`,
    seedLabel: "Seed demo tables, boxes, and ITS",
  },
  its_design: {
    title: "ITS Design plants",
    blurb: "Independent plants for specs and electrical grouping. Not shared with layout plants.",
    open: (id) => `/its/${id}/assets`,
    seedLabel: "Seed demo specs and grouping",
  },
};

export function ModulePlantsPage({ module }: { module: AppModule }) {
  const navigate = useNavigate();
  const meta = COPY[module];
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [site, setSite] = useState("");
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    api
      .listProjects(module)
      .then(setProjects)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    reload();
  }, [module]);

  const create = async () => {
    setBusy(true);
    try {
      const project = await api.createProject({
        name: name.trim() || "Untitled plant",
        site,
        seed_catalog: seed,
        module,
      });
      navigate(meta.open(project.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this plant?")) return;
    await api.deleteProject(id);
    reload();
  };

  const rename = async (p: ProjectSummary) => {
    const next = window.prompt("Plant name", p.name);
    if (!next || next.trim() === p.name) return;
    await api.patchProject(p.id, { name: next.trim() });
    reload();
  };

  const duplicate = async (id: string) => {
    const clone = await api.duplicateProject(id);
    navigate(meta.open(clone.id));
  };

  const exportOne = async (id: string, projectName: string) => {
    const project = await api.getProject(id);
    downloadJson(`${projectName.replace(/\s+/g, "_")}.pvdes.json`, project);
  };

  const importOne = async () => {
    try {
      const data = (await pickJsonFile()) as Project;
      const imported = await api.importProject({ ...data, module });
      navigate(meta.open(imported.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <button
            type="button"
            className="text-[12px] text-muted hover:text-accent"
            onClick={() => navigate("/")}
          >
            ← Modules
          </button>
          <h1 className="mt-2 text-3xl font-medium tracking-tight">{meta.title}</h1>
          <p className="mt-2 max-w-xl text-muted">{meta.blurb}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void importOne()}>Import JSON</Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            New plant
          </Button>
        </div>
      </div>

      {error ? <p className="mb-4 text-danger">{error}</p> : null}

      {creating ? (
        <Card className="mb-6 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Name">
              <TextInput value={name} onChange={setName} placeholder="Plant name" />
            </Field>
            <Field label="Site">
              <TextInput value={site} onChange={setSite} placeholder="Location" />
            </Field>
            <label className="flex items-end gap-2 pb-1 text-[13px] text-muted">
              <input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} />
              {meta.seedLabel}
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void create()}>
              Create
            </Button>
          </div>
        </Card>
      ) : null}

      {projects.length === 0 && !creating ? (
        <Card className="p-10 text-center text-muted">
          No plants in this module yet. Create one or import a{" "}
          <code className="text-text">.pvdes.json</code> file.
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Card key={p.id} className="flex items-center gap-4 px-4 py-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => navigate(meta.open(p.id))}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-[12px] text-muted">
                  {p.site || "No site"} · {p.owner || "No owner"} · updated{" "}
                  {new Date(p.updated_at).toLocaleString()}
                </div>
              </button>
              <Button onClick={() => navigate(meta.open(p.id))}>Open</Button>
              <Button variant="ghost" onClick={() => void rename(p)}>
                Rename
              </Button>
              <Button variant="ghost" onClick={() => void exportOne(p.id, p.name)}>
                Export
              </Button>
              <Button variant="ghost" onClick={() => void duplicate(p.id)}>
                Duplicate
              </Button>
              <Button variant="danger" onClick={() => void remove(p.id)}>
                Delete
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
