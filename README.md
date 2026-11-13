# Milo — Apne app se ("Aware, not afraid")

Milo is a clinical health-literacy and preventive care web application built for people and families in India to understand **diabetes**, **high blood pressure**, **lipid & kidney reports**, and **cancer/pathology reports**, and to take calm, evidence-informed action alongside their doctors.

---

## Core Architecture & Principles

1. **Deterministic Clinical Engine (`src/lib/engine/`) — Zero Hallucinated Numbers**
   - The AI **never** invents medical numbers, classifications, eGFR values, or risk trajectories.
   - All numerical classifications (`src/config/thresholds.ts`), **CKD-EPI 2021 race-free eGFR** calculations (`src/lib/engine/ckdEpi.ts`), composite relative risk indices over **2, 5, and 10 years** (`src/lib/engine/risk.ts`), and interactive lifestyle simulations (`src/lib/engine/simulator.ts` + `src/config/effects.ts`) run in 100% deterministic TypeScript code with citation metadata.
   - **Cancer & Pathology Boundary**: For `pathology/biopsy` reports, Milo never computes numerical risk scores or survival predictions—it produces plain-language explanations of printed pathology terms and a checklist of questions for the oncologist.

2. **Multi-Pass AI Orchestration (`src/lib/gemini.ts` & `server.ts`)**
   - **Call A — Extract (`MODELS.PRO`, vision + PDF text layer, structured output)**: Reads uploaded images or multi-page PDFs (up to 12 pages) and extracts test names, values, units, reference ranges, flags, confidence scores, and pathology terms while omitting patient identifiers (names, phone numbers, IDs).
   - **Call B — Verify (`MODELS.PRO`, structured output)**: Independently re-inspects the image to flag any discrepancies or implausible readings, marking uncertain items as `"Needs your check"` in the mandatory review table.
   - **Code Step C — Normalize (`src/lib/normalize.ts`)**: Maps 60+ Indian lab synonyms (Dr. Lal PathLabs, SRL, Thyrocare, Metropolis, Apollo formats) to canonical biomarkers, converts `mmol/L` to `mg/dL`, parses `DD/MM/YYYY` dates, deduplicates across pages, and checks physiological plausibility ranges.
   - **Code Step D — Deterministic Engine (`src/lib/engine/index.ts`)**: Computes classifications, urgent safety flags (`urgent` banner for FBS ≥ 250, Random Glucose ≥ 300, Glucose < 70,HbA1c ≥ 10%, BP ≥ 180/120, eGFR < 30), organ strain indices (Eyes, Kidneys, Nerves, Heart & Vessels), and trajectories.
   - **Call E — Explain (`MODELS.PRO`, structured output, cached)**: Generates plain-language explanations in English or Hindi (`summary`, `whyItHappens`, `organNotes`, `roadmap`, `doctorQuestions`, `glossaryTerms`, `sevenDayPlan`, `cancerExplainer`) strictly from confirmed numbers. Forbids diagnosis, drug names, doses, or stopping medicine.
   - **Call F — Ask Milo Chat (`MODELS.FLASH` + Google Search Grounding)**: Streaming SSE health-literacy assistant with clickable web source citations and voice input (`en-IN` / `hi-IN`).
   - **Gemini Omni Flash Video Studio (`MODELS.OMNI_FLASH` / `gemini-omni-1.2-flash`)**: Animates product photos, healthy Indian thali photos, or character illustrations into dynamic videos via the Interactions API, with an automatic client-side HTML5 Canvas + `MediaRecorder` `.webm` motion synthesizer fallback when a paid API key is not configured.
   - **Real-Time Google Maps Platform & Grounded Places Agent**: Interactive `@vis.gl/react-google-maps` map with `Places API (New)` search, `Routes API` turn-by-turn directions, and a Gemini `googleMaps` grounded agent for nearby NABL labs, hospitals, pharmacies, and parks.

3. **Real-Time Wearable Integration (`src/components/WearableHub.tsx` & `/api/wearables/stream`)**
   - Live Server-Sent Events (SSE) telemetry stream for heart rate, step count, post-meal walking minutes, and sleep duration.
   - Web Bluetooth API (`heart_rate` service `0x180D`) pairing with a seamless simulated BLE fallback for iframe environments.
   - Apple Health / Google Fit / Noise / boAt JSON & CSV file import and real-time threshold alerts.

---

## Running Tests & Building

```bash
# Run deterministic unit tests (Vitest)
npx vitest run

# Build production bundle
npm run build

# Start full-stack Express + Vite server on port 3000
npm run dev
```
