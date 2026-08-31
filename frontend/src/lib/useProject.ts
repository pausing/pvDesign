import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { reconcileProject } from "./reconcile";
import { asForest } from "./topology";
import { projectParameters } from "./parameters";
import type { Project } from "../types/project";

export type SaveStatus = "loading" | "ready" | "saving" | "saved" | "error";

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number>(0);
  const latest = useRef<Project | null>(null);

  const persist = useCallback((next: Project) => {
    latest.current = next;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setStatus("saving");
      api
        .patchProject(next.id, {
          name: next.name,
          site: next.site,
          notes: next.notes,
          catalog: next.catalog,
          topology: next.topology,
          layout: next.layout,
          parameters: next.parameters,
        })
        .then((saved) => {
          if (latest.current && latest.current.id === saved.id) {
            latest.current = { ...latest.current, updated_at: saved.updated_at };
          }
          setStatus("saved");
        })
        .catch((err: Error) => {
          setError(err.message);
          setStatus("error");
        });
    }, 450);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    api
      .getProject(id)
      .then((p) => {
        if (cancelled) return;
        const normalized = {
          ...p,
          topology: asForest(p.topology),
          parameters: projectParameters(p),
        };
        const reconciled = reconcileProject(normalized);
        latest.current = reconciled;
        setProject(reconciled);
        setStatus("ready");
        if (reconciled !== p) persist(reconciled);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, [id, persist]);

  const update = useCallback(
    (updater: (p: Project) => Project) => {
      setProject((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        const configChanged =
          next.catalog !== prev.catalog ||
          next.topology !== prev.topology ||
          next.parameters !== prev.parameters;
        const reconciled = configChanged ? reconcileProject(next) : next;
        persist(reconciled);
        return reconciled;
      });
    },
    [persist],
  );

  return { project, status, error, update, setProject };
}

export type ProjectContext = ReturnType<typeof useProject>;
