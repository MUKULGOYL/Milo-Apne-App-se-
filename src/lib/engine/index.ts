import { ENGINE_VERSION } from "../../config/models";
import { NormalizedTestValue } from "../normalize";
import { classifyReportValues } from "./classify";
import { computeOrganRiskHorizons } from "./risk";
import { buildTrajectories, runLifestyleSimulator } from "./simulator";
import { DeterministicEngineOutput, EngineProfileContext } from "./types";

export * from "./types";
export * from "./ckdEpi";
export * from "./classify";
export * from "./risk";
export * from "./simulator";
export * from "./trendAlerts";

const CANCER_MARKERS = new Set([
  "psa",
  "ca_125",
  "cea",
  "afp",
  "ca_19_9",
  "er_status",
  "pr_status",
  "her2_status",
  "ki67_index",
]);

/**
 * Code step D: Deterministic clinical engine.
 * - For cancer reports (pathology/biopsy/tumor markers), strictly returns NO engine risk or survival numbers.
 * - For cardiometabolic/kidney reports, computes classifications, CKD-EPI 2021 eGFR if missing,
 *   urgent safety banners, organ relative risk indices (2/5/10 yr), and trajectories.
 */
export function runDeterministicEngine(
  values: NormalizedTestValue[],
  profile: EngineProfileContext,
  documentType?: string
): DeterministicEngineOutput {
  const isCancerDoc =
    documentType === "pathology/biopsy" ||
    documentType === "cancer" ||
    (values.length > 0 && values.every((v) => CANCER_MARKERS.has(v.canonicalName)));

  const { findings, urgentAlerts, calculatedEgfr } = classifyReportValues(values, profile);

  if (isCancerDoc) {
    return {
      engineVersion: ENGINE_VERSION,
      calculatedAt: new Date().toISOString(),
      isCancerReport: true,
      hasUrgentValues: false,
      urgentAlerts: [],
      findings,
      horizons: null,
      trajectories: null,
      assumptionsUsed: [
        "Cancer / pathology report detected: Milo strictly provides plain-language terminology, staging/grading literacy, and oncologist questions without numerical risk scores or survival estimates.",
      ],
    };
  }

  const { horizons, assumptionsUsed } = computeOrganRiskHorizons(
    values,
    profile,
    calculatedEgfr?.value
  );

  const trajectories = buildTrajectories(
    values,
    horizons.years5,
    calculatedEgfr?.value
  );

  const hasUrgentValues = urgentAlerts.length > 0;

  return {
    engineVersion: ENGINE_VERSION,
    calculatedAt: new Date().toISOString(),
    isCancerReport: false,
    hasUrgentValues,
    urgentBannerMessage: hasUrgentValues
      ? "Please contact a doctor or urgent care today."
      : undefined,
    urgentAlerts,
    findings,
    calculatedEgfr,
    horizons,
    trajectories,
    assumptionsUsed,
  };
}
