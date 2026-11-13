import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquareHeart,
  Send,
  Mic,
  MicOff,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { Card, StatusBadge, SectionHeader } from "../components/ui/DesignSystem";
import { Report } from "../lib/storage";
import { streamAskMiloChat } from "../lib/gemini";
import { SupportedLanguage } from "../lib/i18n";

interface AskMiloPageProps {
  latestReport: Report | null;
  language: SupportedLanguage;
  profileName: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: { title: string; uri: string }[];
}

export const AskMiloPage: React.FC<AskMiloPageProps> = ({
  latestReport,
  language,
  profileName,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        language === "hi"
          ? `नमस्ते ${profileName}! मैं मिलो (Milo) हूँ। आप मुझसे अपनी लैब रिपोर्ट के नंबरों, HbA1c, ब्लड प्रेशर, किडनी ईजीएफआर (eGFR), या भारतीय खान-पान के बारे में सरल भाषा में सवाल पूछ सकते हैं। मैं दवाई का नाम या डोज़ नहीं बताता, लेकिन डॉक्टर से सही सवाल पूछने में आपकी पूरी मदद करूँगा।`
          : `Namaste ${profileName}! I am Milo. You can ask me plain-language questions about your lab report numbers, HbA1c, blood pressure, kidney filtration (eGFR), pathology terms, or Indian food swaps. I never prescribe medicines or doses, and I always cite trusted medical sources.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = language === "hi" ? "hi-IN" : "en-IN";
      rec.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, [language]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang = language === "hi" ? "hi-IN" : "en-IN";
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const buildConfirmedContext = () => {
    if (!latestReport) {
      return "No confirmed lab report uploaded yet. Provide general health-literacy education for Indian adults.";
    }
    const vals = latestReport.engineOutput.findings
      .map(
        (v) =>
          `${v.displayName}: ${v.value} ${v.unit} (${v.categoryLabel}, source: ${v.guidelineSource})`
      )
      .join("; ");
    return `Report Date: ${latestReport.date}, Lab: ${latestReport.labName}, Type: ${latestReport.type}. Confirmed Biomarkers: ${vals}. Summary: ${latestReport.narrative?.summary || ""}`;
  };

  const handleSend = async (questionText?: string) => {
    const query = (questionText ?? input).trim();
    if (!query || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: query,
    };
    const assistantId = `assistant-${Date.now() + 1}`;
    const historyPayload = messages.map((m) => ({
      role: (m.role === "user" ? "user" : "model") as "user" | "model",
      text: m.text,
    }));

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", text: "", sources: [] },
    ]);
    setInput("");
    setIsStreaming(true);

    try {
      await streamAskMiloChat({
        question: query,
        language,
        confirmedSummaryContext: buildConfirmedContext(),
        history: historyPayload,
        onChunk: (textSoFar) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: textSoFar } : m
            )
          );
        },
        onSources: (sources) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, sources } : m
            )
          );
        },
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text:
                  m.text ||
                  "I had trouble reaching the grounded search service just now. Please tap Send or ask again in a moment.",
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const suggestedQuestions =
    language === "hi"
      ? [
          "मेरा HbA1c और फास्टिंग शुगर मुझे सरल भाषा में क्या बता रहे हैं?",
          "खाने के बाद 15 मिनट टहलने से शुगर कैसे कम होती है?",
          "हाई ब्लड प्रेशर में अचार और पापड़ की जगह क्या खाएं?",
          "क्या मैं अपनी बीपी या शुगर की दवाई खुद बंद कर सकता हूँ?",
        ]
      : [
          "What do my latest HbA1c and fasting blood sugar numbers mean together?",
          "Why does a 15-minute walk after lunch and dinner lower post-meal glucose?",
          "How do blood pressure and blood sugar affect kidney eGFR filtration over time?",
          "Can I stop my blood pressure or diabetes tablet once my numbers look normal?",
        ];

  const teleconsultDraft = latestReport
    ? `Hello Doctor,\nSharing my latest ${latestReport.labName} report (${latestReport.date}) summarized via Milo:\n• Key readings: ${latestReport.engineOutput.findings
        .slice(0, 6)
        .map((v) => `${v.displayName}: ${v.value} ${v.unit} (${v.categoryLabel})`)
        .join(", ")}\n• Questions for our consultation:\n${(
        latestReport.narrative?.doctorQuestions || [
          "What target range should we aim for over the next 12 weeks?",
          "When should I repeat this lab panel?",
        ]
      )
        .slice(0, 3)
        .map((q, i) => `  ${i + 1}. ${q}`)
        .join("\n")}`
    : `Hello Doctor,\nI would like to schedule a preventive checkup for blood sugar (HbA1c, FBS), lipid profile, kidney creatinine/eGFR, and blood pressure review. Could you advise if I should fast for 10-12 hours before the blood draw?`;

  const copyTeleconsultNote = async () => {
    try {
      await navigator.clipboard.writeText(teleconsultDraft);
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2500);
    } catch {
      setCopiedNote(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
          Grounded Health Literacy & Doctor Prep
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-0.5">
          Ask Milo (Search-Grounded) & Teleconsult Brief
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Powered by Gemini Flash with Google Search grounding. Answers use your confirmed numbers, cite clinical sources, and safely redirect prescription or dose changes to your doctor.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Grounded Streaming Chat */}
        <div className="lg:col-span-8">
          <Card className="flex flex-col h-[620px] p-0 overflow-hidden">
            {/* Chat Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                  <MessageSquareHeart className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Ask Milo Health-Literacy Assistant
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {latestReport
                      ? `Grounded in your ${latestReport.date} report (${latestReport.labName})`
                      : "General Indian preventive health mode"}
                  </div>
                </div>
              </div>
              <StatusBadge tone="normal">
                <ShieldCheck className="w-3 h-3 mr-1" />
                No Dose / Rx Advice
              </StatusBadge>
            </div>

            {/* Suggested Prompts Strip */}
            <div className="px-4 py-2.5 bg-slate-50/40 dark:bg-slate-900/40 border-b border-slate-200/70 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => handleSend(q)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:border-teal-500 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-teal-700 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">
                      {msg.text ||
                        (isStreaming
                          ? "Thinking & checking clinical sources…"
                          : "")}
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                          Verified Web & Clinical Sources
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src, i) => (
                            <a
                              key={`${src.uri}-${i}`}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {src.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
            >
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  title={
                    isListening
                      ? "Stop voice input"
                      : "Speak in English or Hindi"
                  }
                  className={`p-2.5 rounded-xl border transition-colors ${
                    isListening
                      ? "bg-rose-600 text-white border-rose-600 animate-pulse"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  language === "hi"
                    ? "अपनी रिपोर्ट या खान-पान के बारे में सवाल पूछें..."
                    : "Ask about your lab numbers, food swaps, or questions for your doctor..."
                }
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {isStreaming ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send
              </button>
            </form>
          </Card>
        </div>

        {/* Right 4 Cols: Doctor Teleconsult Note & Safety Guardrails */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <SectionHeader
              title="Ready-to-Send Doctor Note"
              subtitle="Copy this concise summary into WhatsApp, Practo, Apollo 24/7, or your hospital portal before a teleconsultation."
              icon={<Stethoscope className="w-5 h-5" />}
            />
            <pre className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
              {teleconsultDraft}
            </pre>
            <button
              type="button"
              onClick={copyTeleconsultNote}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              {copiedNote ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                  Copied Consultation Note!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Note for Doctor / Teleconsult
                </>
              )}
            </button>
          </Card>

          <Card className="bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="font-bold text-slate-900 dark:text-white">
                  How Milo Protects Your Safety
                </div>
                <p>
                  1. <strong>Zero Hallucinated Numbers:</strong> Milo only references your confirmed report table and deterministic CKD-EPI / ICMR thresholds.
                </p>
                <p>
                  2. <strong>Medicine Guardrail:</strong> If you ask whether to stop a BP or diabetes tablet or change a dose, Milo will kindly explain why abrupt changes can cause rebound spikes and help you phrase the question for your physician.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
