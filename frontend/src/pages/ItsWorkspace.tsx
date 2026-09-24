import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Button, Card, TextInput } from "../components/ui";
import {
  findItsBlock,
  itsDesignOf,
  replaceItsBlock,
  syncStringsFromTables,
} from "../lib/itsDesign";
import type { ProjectContext } from "../lib/useProject";
import type { ItsPvBlock } from "../types/project";

export type ItsOutletContext = ProjectContext & {
  block: ItsPvBlock;
  updateBlock: (updater: (block: ItsPvBlock) => ItsPvBlock) => void;
};

export type BlockModule = "layout" | "its";

function blockPath(projectId: string, module: BlockModule, blockId: string, child?: string) {
  if (module === "layout") return `/projects/${projectId}/layout-config/${blockId}`;
  return `/projects/${projectId}/its/${blockId}/${child ?? "assets"}`;
}

export function PvBlockWorkspace({ module }: { module: BlockModule }) {
  const ctx = useOutletContext<ProjectContext>();
  const { id, blockId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("PV block 1");
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);

  const design = itsDesignOf(ctx.project);
  const block = findItsBlock(design, blockId);
  const title = module === "layout" ? "Layout configuration" : "ITS Design";

  const goToBlock = (nextId: string, child?: string) => {
    if (!id) return;
    navigate(blockPath(id, module, nextId, child));
  };

  const createBlock = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const created = await api.createItsBlock(id, { name: name.trim() || "PV block", seed });
      ctx.update((p) => ({
        ...p,
        its_design: replaceItsBlock(itsDesignOf(p), created),
      }));
      goToBlock(created.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not create block");
    } finally {
      setBusy(false);
    }
  };

  if (!ctx.project) {
    return <div className="p-8 text-muted">Loading…</div>;
  }

  if (!blockId) {
    if (design.blocks[0]) {
      return <Navigate to={blockPath(id!, module, design.blocks[0].id)} replace />;
    }
    return (
      <div className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-2xl font-medium">{title}</h1>
        <p className="mt-2 text-muted">
          {module === "layout"
            ? "Create a PV block, then place tables, string boxes, and the ITS. Strings are generated from table geometry."
            : "Create a PV block, then edit asset specs and assign strings → string box → ITS."}
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
          <div className="flex justify-end">
            <Button variant="primary" disabled={busy} onClick={() => void createBlock()}>
              Create PV block
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!block) {
    return (
      <div className="p-8 text-muted">
        This PV block was not found.{" "}
        <button
          type="button"
          className="text-accent"
          onClick={() => navigate(module === "layout" ? `/projects/${id}/layout-config` : `/projects/${id}/its`)}
        >
          Back to {title}
        </button>
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

  const tabs =
    module === "its"
      ? [
          { to: "assets", label: "Assets" },
          { to: "grouping", label: "Grouping" },
        ]
      : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-panel px-4 py-2">
        <div className="text-[12px] uppercase tracking-[0.14em] text-accent">{title}</div>
        <select
          className="text-[13px]"
          value={block.id}
          onChange={(e) => goToBlock(e.target.value)}
        >
          {design.blocks.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {tabs.length ? (
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={blockPath(id!, module, block.id, tab.to)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-[13px] ${
                    isActive ? "bg-accent-dim text-accent" : "text-muted hover:bg-raised hover:text-text"
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        ) : (
          <p className="text-[12px] text-muted">
            Place equipment here. Group strings in{" "}
            <button
              type="button"
              className="text-accent"
              onClick={() => id && navigate(blockPath(id, "its", block.id, "grouping"))}
            >
              ITS Design
            </button>
            .
          </p>
        )}
        <div className="ml-auto flex gap-2">
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
                  goToBlock(created.id);
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
                navigate(module === "layout" ? `/projects/${id}/layout-config` : `/projects/${id}/its`);
              });
            }}
          >
            Delete block
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Outlet context={{ ...ctx, block, updateBlock } satisfies ItsOutletContext} />
      </div>
    </div>
  );
}

export function LayoutConfigWorkspace() {
  return <PvBlockWorkspace module="layout" />;
}

export function ItsWorkspace() {
  return <PvBlockWorkspace module="its" />;
}
