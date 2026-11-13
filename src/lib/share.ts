import { Profile, Report } from "./storage";

/**
 * Generates a clean, plain-language shareable text summary for doctors or family members
 * (with Web Share API + clipboard fallback + printable view).
 */
export function buildDoctorShareSummary(report: Report, profile: Profile): string {
  const lines: string[] = [
    `MILO HEALTH SUMMARY — ${profile.customName} (${profile.age}y, ${profile.sex})`,
    `Report Date: ${report.date} | Lab: ${report.labName}`,
    `------------------------------------------------------------`,
  ];

  if (report.engineOutput.hasUrgentValues) {
    lines.push(`URGENT NOTE: ${report.engineOutput.urgentBannerMessage}`);
    for (const u of report.engineOutput.urgentAlerts) {
      lines.push(`- ${u.testName}: ${u.value} (${u.reason})`);
    }
    lines.push("");
  }

  lines.push("CONFIRMED LAB VALUES & CLASSIFICATION:");
  for (const f of report.engineOutput.findings) {
    lines.push(
      `• ${f.displayName}: ${f.value} ${f.unit} — ${f.categoryLabel}${f.isCalculated ? " [Calculated CKD-EPI 2021]" : ""}`
    );
  }

  if (report.narrative) {
    lines.push("");
    lines.push("PLAIN-LANGUAGE SUMMARY:");
    lines.push(report.narrative.summary);

    if (report.narrative.doctorQuestions.length > 0) {
      lines.push("");
      lines.push("QUESTIONS FOR MY DOCTOR:");
      report.narrative.doctorQuestions.forEach((q, i) => {
        lines.push(`${i + 1}. ${q}`);
      });
    }
  }

  lines.push("");
  lines.push(
    "Generated via Milo (Apne app se) — Educational health-literacy summary, not a clinical diagnosis."
  );

  return lines.join("\n");
}

export async function shareOrCopySummary(
  title: string,
  text: string
): Promise<{ method: "web_share" | "clipboard"; success: boolean }> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return { method: "web_share", success: true };
    } catch {
      // Fall through to clipboard
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return { method: "clipboard", success: true };
  }

  return { method: "clipboard", success: false };
}

/**
 * Deterministic comparison between two reports for the "History & Compare" screen.
 */
export interface ReportComparisonItem {
  canonicalName: string;
  displayName: string;
  unit: string;
  earlierValue: number;
  laterValue: number;
  delta: number;
  direction: "improved" | "worsened" | "unchanged";
  plainInsight: string;
}

export function compareTwoReports(earlier: Report, later: Report): {
  items: ReportComparisonItem[];
  overallHeadline: string;
  actionableInsights: string[];
} {
  const earlierMap: Record<string, { value: number; displayName: string; unit: string }> = {};
  for (const v of earlier.values) {
    earlierMap[v.canonicalName] = {
      value: v.value,
      displayName: v.displayName,
      unit: v.unit,
    };
  }

  // Also include calculated eGFR if present
  if (!earlierMap["egfr"] && earlier.engineOutput.calculatedEgfr) {
    earlierMap["egfr"] = {
      value: earlier.engineOutput.calculatedEgfr.value,
      displayName: "eGFR (Calculated)",
      unit: "mL/min/1.73m²",
    };
  }

  const laterMap: Record<string, { value: number; displayName: string; unit: string }> = {};
  for (const v of later.values) {
    laterMap[v.canonicalName] = {
      value: v.value,
      displayName: v.displayName,
      unit: v.unit,
    };
  }
  if (!laterMap["egfr"] && later.engineOutput.calculatedEgfr) {
    laterMap["egfr"] = {
      value: later.engineOutput.calculatedEgfr.value,
      displayName: "eGFR (Calculated)",
      unit: "mL/min/1.73m²",
    };
  }

  const higherIsBetter = new Set(["egfr", "hdl_cholesterol", "vitamin_b12", "vitamin_d", "hemoglobin"]);
  const items: ReportComparisonItem[] = [];
  const actionableInsights: string[] = [];

  for (const [key, lat] of Object.entries(laterMap)) {
    const ear = earlierMap[key];
    if (!ear) continue;

    const delta = Math.round((lat.value - ear.value) * 100) / 100;
    const absPct = ear.value !== 0 ? Math.abs(delta / ear.value) : 0;

    let direction: "improved" | "worsened" | "unchanged" = "unchanged";
    if (absPct >= 0.02) {
      if (higherIsBetter.has(key)) {
        direction = delta > 0 ? "improved" : "worsened";
      } else {
        direction = delta < 0 ? "improved" : "worsened";
      }
    }

    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    let plainInsight = `${lat.displayName} moved from ${ear.value} to ${lat.value} ${lat.unit} (${sign} ${lat.unit}).`;

    if (key === "hba1c") {
      if (delta < 0) {
        plainInsight += " Lower 3-month average sugar reduces strain on small eye, kidney, and nerve vessels.";
        actionableInsights.push(
          `Keep up the meal timing and post-meal walking habits that helped bring HbA1c down by ${Math.abs(delta).toFixed(1)}%.`
        );
      } else if (delta > 0) {
        plainInsight += " Average blood sugar has crept up; reviewing evening carbohydrate portions and walking 15 minutes after meals can help.";
        actionableInsights.push(
          "Focus on a 15-minute brisk walk after lunch and dinner and pair rotis/rice with extra sabzi and dal."
        );
      }
    } else if (key === "systolic_bp") {
      if (delta < 0) {
        plainInsight += " Lower systolic blood pressure directly eases workload on the heart and kidneys.";
      } else if (delta > 0) {
        plainInsight += " Systolic blood pressure increased; check hidden salt intake (pickles, papad, namkeen) and evening sleep quality.";
        actionableInsights.push(
          "Reduce added salt below 5g/day and take 2 seated morning BP readings after 5 minutes of quiet rest."
        );
      }
    } else if (key === "ldl_cholesterol" && delta > 0) {
      actionableInsights.push(
        "Replace deep-fried snacks and bakery fats with soaked almonds, walnuts, oats, and soluble fibre from dal and vegetables."
      );
    }

    items.push({
      canonicalName: key,
      displayName: lat.displayName,
      unit: lat.unit,
      earlierValue: ear.value,
      laterValue: lat.value,
      delta,
      direction,
      plainInsight,
    });
  }

  const improvedCount = items.filter((i) => i.direction === "improved").length;
  const worsenedCount = items.filter((i) => i.direction === "worsened").length;

  const overallHeadline =
    improvedCount > worsenedCount
      ? `${improvedCount} of ${items.length} compared markers improved between ${earlier.date} and ${later.date}.`
      : worsenedCount > improvedCount
        ? `${worsenedCount} of ${items.length} markers need closer attention since ${earlier.date}.`
        : `Markers remained largely stable between ${earlier.date} and ${later.date}.`;

  if (actionableInsights.length === 0) {
    actionableInsights.push(
      "Bring this side-by-side comparison to your next doctor visit to review long-term targets."
    );
  }

  return { items, overallHeadline, actionableInsights };
}
