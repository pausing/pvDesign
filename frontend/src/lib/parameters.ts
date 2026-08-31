import type { Project, ProjectParameters } from "../types/project";

export const DEFAULT_PARAMETERS: ProjectParameters = {
  tracker_pitch_m: 12,
  tracker_ns_gap_m: 10,
};

export function projectParameters(project: Pick<Project, "parameters">): ProjectParameters {
  const pitch = project.parameters?.tracker_pitch_m;
  const nsGap = project.parameters?.tracker_ns_gap_m;
  return {
    tracker_pitch_m: pitch != null && pitch > 0 ? pitch : DEFAULT_PARAMETERS.tracker_pitch_m,
    tracker_ns_gap_m:
      nsGap != null && Number.isFinite(nsGap) && nsGap >= 0
        ? nsGap
        : DEFAULT_PARAMETERS.tracker_ns_gap_m,
  };
}
