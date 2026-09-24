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

export function ItsWorkspace() {
  const ctx = useOutletContext<ProjectContext>();
  const { id, blockId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("PV block 1");
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);

  const design = itsDesignOf(ctx.project);
  const block = findItsBlock(design, blockId);

  const createBlock = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const created = await api.createItsBlock(id, { name: name.trim() || "PV block", seed });
      ctx.update((p) => ({
        ...p,
        its_design: replaceItsBlock(itsDesignOf(p), created),
      }));
      navigate(`/projects/${id}/its/${created.id}/assets`);
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
      return <Navigate to={`/projects/${id}/its/${design.blocks[0].id}/assets`} replace />;
    }
    return (
      <div className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-2xl font-medium">ITS Design</h1>
        <p className="mt-2 text-muted">
          Create a PV block to define module/string/string-box/ITS specs, place the layout,
          and assign strings to boxes and boxes to the skid.
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
        <button type="button" className="text-accent" onClick={() => navigate(`/projects/${id}/its`)}>
          Back to ITS Design
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

  const tabs = [
    { to: "assets", label: "Assets" },
    { to: "layout", label: "Layout & grouping" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-panel px-4 py-2">
        <div className="text-[12px] uppercase tracking-[0.14em] text-accent">ITS Design</div>
        <select
          className="text-[13px]"
          value={block.id}
          onChange={(e) => navigate(`/projects/${id}/its/${e.target.value}/assets`)}
        >
          {design.blocks.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={`/projects/${id}/its/${block.id}/${tab.to}`}
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
                  navigate(`/projects/${id}/its/${created.id}/assets`);
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
                navigate(`/projects/${id}/its`);
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
