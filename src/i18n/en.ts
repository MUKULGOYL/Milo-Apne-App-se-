export const en = {
  appName: "Milo",
  tagline: "Apne app se",
  heroSubtitle: "Aware, not afraid.",
  heroTitle: "Understand your lab reports and protect your long-term health in plain language.",
  heroLead:
    "Milo reads Indian blood sugar, blood pressure, lipid, kidney, and cancer reports—translating clinical numbers into calm, clear steps for you and your family.",
  valuePoints: [
    {
      title: "Numbers verified, never invented",
      body: "You review every extracted test value before analysis. Risk bands and kidney filtration are computed by transparent clinical equations, never guessed by AI.",
    },
    {
      title: "Built for Indian labs & households",
      body: "Understands Indian lab formats (FBS, PPBS, HbA1c, S. Creatinine, ACR), Indian food swaps (roti, dal, rice, sabzi), and manages profiles for parents and family.",
    },
    {
      title: "Private on your device",
      body: "Your health history stays in your browser storage. Names and phone numbers are stripped before AI explanation, and you can export or erase your data anytime.",
    },
  ],
  ctas: {
    uploadReport: "Upload a report",
    checkRisk: "Check my risk",
    trySample: "Try a sample report",
    scanReading: "Scan a monitor",
    manualEntry: "Enter manually",
  },
  nav: {
    home: "Overview",
    addReport: "Add Report",
    results: "Results & Simulator",
    prevention: "Prevention Check",
    dailyLog: "Daily Log & Wearables",
    medicines: "Medicines",
    foodGuide: "Food & 7-Day Plan",
    history: "History & Compare",
    askMilo: "Ask Milo",
  },
  safetyBanner: {
    urgentTitle: "Please contact a doctor or urgent care today.",
    urgentSubtitle:
      "One or more readings are in a range that needs prompt medical attention rather than self-management alone.",
  },
  consent: {
    title: "Before you upload: Privacy & Clinical Safety",
    point1: "Milo is a health-literacy and prevention companion, not a doctor or diagnostic device.",
    point2: "All data stays on your device in local storage. When AI reads a report image, we instruct it to ignore and omit patient names, phone numbers, and IDs.",
    point3: "You will review and confirm every extracted number before any explanation is generated.",
    redactionNote: "Tip: You can crop or mask your name and phone number on the top of the lab page before uploading.",
    acceptButton: "I understand and agree",
    cancelButton: "Go back",
  },
  common: {
    language: "Language",
    english: "English",
    hindi: "हिन्दी",
    largeText: "Large text",
    darkMode: "Dark theme",
    profile: "Active profile",
    illustrativeDisclaimer: "Illustrative estimate, not a prediction for you.",
    clinicalReviewNote: "Needs clinical review",
    needsYourCheck: "Needs your check",
    confirmed: "Confirmed",
    confirmRow: "Confirm value",
    analyseButton: "Analyse confirmed report",
    retry: "Retry",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    printOrPdf: "Download Report PDF",
    shareSummary: "Share doctor summary",
  },
};

export type TranslationDict = typeof en;
