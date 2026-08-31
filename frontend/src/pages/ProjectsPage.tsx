import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, downloadJson, pickJsonFile } from "../api/client";
import { Button, Card, Field, TextInput } from "../components/ui";
import type { Project, ProjectSummary } from "../types/project";

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [site, setSite] = useState("");
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    api
      .listProjects()
      .then(setProjects)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    reload();
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const project = await api.createProject({
        name: name.trim() || "Untitled project",
        site,
        seed_catalog: seed,
      });
      navigate(`/projects/${project.id}/config`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this project?")) return;
    await api.deleteProject(id);
    reload();
  };

  const duplicate = async (id: string) => {
    const clone = await api.duplicateProject(id);
    navigate(`/projects/${clone.id}/config`);
  };

  const exportOne = async (id: string, projectName: string) => {
    const project = await api.getProject(id);
    downloadJson(`${projectName.replace(/\s+/g, "_")}.pvdes.json`, project);
  };

  const importOne = async () => {
    try {
      const data = (await pickJsonFile()) as Project;
      const imported = await api.importProject(data);
      navigate(`/projects/${imported.id}/config`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-accent">PV Design</div>
          <h1 className="mt-1 text-3xl font-medium tracking-tight">Projects</h1>
          <p className="mt-2 max-w-xl text-muted">
            Utility-scale plant files. Each project holds an asset library, electrical hierarchy,
            and a block/row layout.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void importOne()}>Import JSON</Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            New project
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
              Seed catalog and demo hierarchy
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
          No projects yet. Create one or import a <code className="text-text">.pvdes.json</code> file.
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Card key={p.id} className="flex items-center gap-4 px-4 py-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => navigate(`/projects/${p.id}/config`)}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-[12px] text-muted">
                  {p.site || "No site"} · updated {new Date(p.updated_at).toLocaleString()}
                </div>
              </button>
              <Button onClick={() => navigate(`/projects/${p.id}/config`)}>Open</Button>
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
