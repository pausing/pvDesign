import { useState } from "react";
import { Navigate, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Button, Card, TextInput } from "../components/ui";
import {
  findItsBlock,
  itsDesignOf,
  replaceItsBlock,
  syncStringsFromTables,
} from "../lib/itsDesign";
import type { ProjectContext } from "../lib/useProject";
import type { AppModule, ItsPvBlock } from "../types/project";

export type ItsOutletContext = ProjectContext & {
  block: ItsPvBlock;
  updateBlock: (updater: (block: ItsPvBlock) => ItsPvBlock) => void;
};

export function PvBlockWorkspace({ module }: { module: AppModule }) {
  const ctx = useOutletContext<ProjectContext>();
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("PV block 1");
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blockId, setBlockId] = useState<string | null>(null);

  const design = itsDesignOf(ctx.project);
  const activeId = blockId && design.blocks.some((b) => b.id === blockId) ? blockId : design.blocks[0]?.id;
  const block = findItsBlock(design, activeId);
  const title = module === "layout_config" ? "Layout configuration" : "ITS Design";
  const plantsHref = module === "layout_config" ? "/layout-config" : "/its";

  const createBlock = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const created = await api.createItsBlock(id, { name: name.trim() || "PV block", seed });
      ctx.update((p) => ({
        ...p,
        its_design: replaceItsBlock(itsDesignOf(p), created),
      }));
      setBlockId(created.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not create block");
    } finally {
      setBusy(false);
    }
  };

  if (!ctx.project) {
    return <div className="p-8 text-muted">Loading…</div>;
  }

  if (!block) {
    return (
      <div className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-2xl font-medium">{title}</h1>
        <p className="mt-2 text-muted">
          This plant has no PV block yet. Create one to{" "}
          {module === "layout_config" ? "place equipment" : "edit specs and grouping"}.
        </p>
        <Card className="mt-6 space-y-3 p-4">
          <label className="flex flex-col gap-1 text-[12px] text-muted">
            <span>Block name</span>
            <TextInput value={name} onChange={setName} placeholder="PV block 1" />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} />
            Seed typical specs, tables, boxes, and grouping
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => navigate(plantsHref)}>
              Back to plants
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void createBlock()}>
              Create PV block
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const updateBlock = (updater: (current: ItsPvBlock) => ItsPvBlock) => {
    ctx.update((p) => {
      const current = findItsBlock(itsDesignOf(p), block.id);
      if (!current) return p;
      const next = syncStringsFromTables(updater(current));
      return { ...p, its_design: replaceItsBlock(itsDesignOf(p), next) };
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {design.blocks.length > 1 || module === "layout_config" ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-line bg-panel px-4 py-2">
          <span className="text-[12px] text-muted">PV block</span>
          <select
            className="text-[13px]"
            value={block.id}
            onChange={(e) => setBlockId(e.target.value)}
          >
            {design.blocks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            onClick={() => {
              const nextName = window.prompt("New PV block name", `PV block ${design.blocks.length + 1}`);
              if (!nextName || !id) return;
              void api
                .createItsBlock(id, { name: nextName, seed: true })
                .then((created) => {
                  ctx.update((p) => ({
                    ...p,
                    its_design: replaceItsBlock(itsDesignOf(p), created),
                  }));
                  setBlockId(created.id);
                })
                .catch((err: Error) => window.alert(err.message));
            }}
          >
            Add block
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!id || !window.confirm("Delete this PV block?")) return;
              void api.deleteItsBlock(id, block.id).then(() => {
                ctx.update((p) => ({
                  ...p,
                  its_design: {
                    blocks: itsDesignOf(p).blocks.filter((b) => b.id !== block.id),
                  },
                }));
                setBlockId(null);
              });
            }}
          >
            Delete block
          </Button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <Outlet context={{ ...ctx, block, updateBlock } satisfies ItsOutletContext} />
      </div>
    </div>
  );
}

export function LayoutConfigWorkspace() {
  return <PvBlockWorkspace module="layout_config" />;
}

export function ItsWorkspace() {
  return <PvBlockWorkspace module="its_design" />;
}

export function RedirectLegacyProject() {
  const { id } = useParams();
  const ctx = useOutletContext<ProjectContext>();
  if (!ctx.project || !id) return <div className="p-8 text-muted">Loading…</div>;
  if (ctx.project.module === "its_design") {
    return <Navigate to={`/its/${id}/assets`} replace />;
  }
  return <Navigate to={`/layout-config/${id}`} replace />;
}
