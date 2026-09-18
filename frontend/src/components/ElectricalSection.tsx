import { useRef, useState } from "react";
import { api, downloadBlob } from "../api/client";
import { Button, Card } from "./ui";
import type {
  ElectricalBtConfig,
  ElectricalBtPreview,
  ElectricalMvConfig,
  ElectricalMvPreview,
  Project,
} from "../types/project";

function fmt(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function pickXlsx(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      resolve(file);
    };
    input.click();
  });
}

export function ElectricalSection({
  project,
  onImported,
}: {
  project: Project;
  onImported: (next: Project) => void;
}) {
  return (
    <section className="shrink-0 border-b border-line px-4 py-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-medium">Electrical configuration</h2>
          <p className="text-[12px] text-muted">
            Import Pablo-format BT / LV inverter tables and MV feeders. Stored on the project; layout
            stations are left unchanged.
          </p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <BtPanel project={project} onImported={onImported} />
        <MvPanel project={project} onImported={onImported} />
      </div>
    </section>
  );
}

function BtPanel({
  project,
  onImported,
}: {
  project: Project;
  onImported: (next: Project) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ElectricalBtPreview | null>(null);
  const pending = useRef<File | null>(null);
  const stored = project.electrical_bt ?? null;

  const download = async () => {
    try {
      const blob = await api.downloadBtTemplate(project.id);
      downloadBlob("bt_electrical_configuration.xlsx", blob);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Template download failed");
    }
  };

  const choose = async () => {
    try {
      const file = await pickXlsx();
      pending.current = file;
      setBusy(true);
      const result = await api.parseBtElectrical(project.id, file);
      setPreview(result.preview);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "BT parse failed");
    } finally {
      setBusy(false);
    }
  };

  const commit = async (mode: "replace" | "merge") => {
    const file = pending.current;
    if (!file) return;
    if (stored && stored.rows.length > 0) {
      const ok = window.confirm(
        mode === "merge"
          ? `Merge ${preview?.inverter_count ?? ""} inverter rows into the existing BT table? Matching inverter ids are replaced.`
          : `Replace the existing BT table (${stored.totals.inverter_count} inverters) with this workbook?`,
      );
      if (!ok) return;
    }
    try {
      setBusy(true);
      const result = await api.importBtElectrical(project.id, file, mode);
      onImported(result.project);
      setPreview(null);
      pending.current = null;
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "BT import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-medium text-accent">BT / LV</h3>
          <p className="text-[12px] text-muted">One row per inverter under an ITS</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => void download()}>
            Download template
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void choose()}>
            {busy ? "Working…" : "Upload BT xlsx"}
          </Button>
        </div>
      </div>
      {preview ? (
        <PreviewCounts
          items={[
            ["ITS", preview.its_count],
            ["Inverters", preview.inverter_count],
            ["kWp", preview.pot_dc_kwp],
            ["kVA", preview.pot_ac_kva],
          ]}
          warnings={preview.warnings}
          extra={`${preview.modules_per_tracker} mod/tracker · ${preview.strings_per_tracker} str/tracker`}
          onCancel={() => {
            setPreview(null);
            pending.current = null;
          }}
          onReplace={() => void commit("replace")}
          onMerge={stored && stored.rows.length > 0 ? () => void commit("merge") : undefined}
        />
      ) : stored ? (
        <BtStored config={stored} />
      ) : (
        <p className="text-[12px] text-muted">No BT table yet. Download the template or upload Pablo’s workbook.</p>
      )}
    </Card>
  );
}

function MvPanel({
  project,
  onImported,
}: {
  project: Project;
  onImported: (next: Project) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ElectricalMvPreview | null>(null);
  const pending = useRef<File | null>(null);
  const stored = project.electrical_mv ?? null;

  const download = async () => {
    try {
      const blob = await api.downloadMvTemplate(project.id);
      downloadBlob("mv_electrical_configuration.xlsx", blob);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Template download failed");
    }
  };

  const choose = async () => {
    try {
      const file = await pickXlsx();
      pending.current = file;
      setBusy(true);
      const result = await api.parseMvElectrical(project.id, file);
      setPreview(result.preview);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "MV parse failed");
    } finally {
      setBusy(false);
    }
  };

  const commit = async (mode: "replace" | "merge") => {
    const file = pending.current;
    if (!file) return;
    if (stored && stored.rows.length > 0) {
      const ok = window.confirm(
        mode === "merge"
          ? "Merge these MV feeders with the existing table?"
          : `Replace the existing MV table (${stored.rows.length} feeders)?`,
      );
      if (!ok) return;
    }
    try {
      setBusy(true);
      const result = await api.importMvElectrical(project.id, file, mode);
      onImported(result.project);
      setPreview(null);
      pending.current = null;
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "MV import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-medium text-accent">MV</h3>
          <p className="text-[12px] text-muted">Join on Subpark + ITS / ITS id</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => void download()}>
            Download template
          </Button>
          <Button disabled={busy} onClick={() => void choose()}>
            {busy ? "Working…" : "Upload MV xlsx"}
          </Button>
        </div>
      </div>
      {preview ? (
        <PreviewCounts
          items={[
            ["ITS", preview.its_count],
            ["Feeders", preview.feeder_count],
            ["kVA load", preview.load_kva],
            ["m cable", preview.length_m],
          ]}
          warnings={preview.warnings}
          onCancel={() => {
            setPreview(null);
            pending.current = null;
          }}
          onReplace={() => void commit("replace")}
          onMerge={stored && stored.rows.length > 0 ? () => void commit("merge") : undefined}
        />
      ) : stored ? (
        <MvStored config={stored} />
      ) : (
        <p className="text-[12px] text-muted">No MV table yet. Download the blank MV template to fill feeders.</p>
      )}
    </Card>
  );
}

function PreviewCounts({
  items,
  warnings,
  extra,
  onCancel,
  onReplace,
  onMerge,
}: {
  items: [string, number | null][];
  warnings: string[];
  extra?: string;
  onCancel: () => void;
  onReplace: () => void;
  onMerge?: () => void;
}) {
  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md bg-ink px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
            <div className="font-mono text-[13px]">{fmt(value, value != null && value > 100 ? 0 : 1)}</div>
          </div>
        ))}
      </div>
      {extra ? <p className="mb-2 text-[11px] text-muted">{extra}</p> : null}
      {warnings.length > 0 ? (
        <ul className="mb-2 max-h-24 overflow-auto text-[11px] text-amber">
          {warnings.slice(0, 8).map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={onReplace}>
          Replace
        </Button>
        {onMerge ? (
          <Button onClick={onMerge}>Merge</Button>
        ) : null}
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function BtStored({ config }: { config: ElectricalBtConfig }) {
  const t = config.totals;
  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="ITS" value={fmt(t.its_count, 0)} />
        <Stat label="Inverters" value={fmt(t.inverter_count, 0)} />
        <Stat label="DC kWp" value={fmt(t.pot_dc_kwp, 0)} />
        <Stat label="AC kVA" value={fmt(t.pot_ac_kva, 0)} />
      </div>
      <p className="mb-2 text-[11px] text-muted">
        {config.source_filename || "Imported"} · {config.modules_per_tracker} modules/tracker
        {config.trackers_header ? ` · ${config.trackers_header}` : ""}
      </p>
      <div className="max-h-48 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-2">ITS id</th>
              <th className="py-1 pr-2">Inv</th>
              <th className="py-1 pr-2">kWp</th>
              <th className="py-1 pr-2">kVA</th>
            </tr>
          </thead>
          <tbody>
            {config.by_its.map((row) => (
              <tr key={row.its_id} className="border-t border-line">
                <td className="py-1 pr-2 font-mono">{row.its_id}</td>
                <td className="py-1 pr-2">{row.inverter_count}</td>
                <td className="py-1 pr-2 font-mono">{fmt(row.pot_dc_kwp, 0)}</td>
                <td className="py-1 pr-2 font-mono">{fmt(row.pot_ac_kva, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MvStored({ config }: { config: ElectricalMvConfig }) {
  return (
    <div>
      <p className="mb-2 text-[11px] text-muted">
        {config.rows.length} feeders{config.source_filename ? ` · ${config.source_filename}` : ""}
      </p>
      {config.warnings.length > 0 ? (
        <p className="mb-2 text-[11px] text-amber">{config.warnings.length} validation notes</p>
      ) : null}
      <div className="max-h-48 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-2">ITS id</th>
              <th className="py-1 pr-2">Feeder</th>
              <th className="py-1 pr-2">To</th>
              <th className="py-1 pr-2">kV</th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, idx) => (
              <tr key={`${row.feeder_id}-${idx}`} className="border-t border-line">
                <td className="py-1 pr-2 font-mono">{row.its_id}</td>
                <td className="py-1 pr-2">{row.feeder_id}</td>
                <td className="py-1 pr-2">{row.destination}</td>
                <td className="py-1 pr-2 font-mono">{fmt(row.voltage_kv, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-ink px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-mono text-[13px]">{value}</div>
    </div>
  );
}
