import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

// Ensure window.fetch has both a getter and setter so browser extensions or
// instrumentation scripts that assign `window.fetch = ...` do not throw
// `TypeError: Cannot set property fetch of #<Window> which has only a getter`.
try {
  let activeFetch =
    typeof window.fetch === "function" ? window.fetch.bind(window) : undefined;
  const desc =
    Object.getOwnPropertyDescriptor(window, "fetch") ||
    Object.getOwnPropertyDescriptor(Window.prototype, "fetch");
  if (desc && desc.configurable && !desc.writable && !desc.set) {
    Object.defineProperty(window, "fetch", {
      configurable: true,
      enumerable: true,
      get() {
        return activeFetch;
      },
      set(fn) {
        if (typeof fn === "function") {
          activeFetch = fn;
        }
      },
    });
  }
} catch {
  // Ignore if descriptor is locked by the host environment
}

window.gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (
    args.some(
      (a) =>
        typeof a === "string" &&
        (a.includes("OverQuotaMapError") || a.includes("QuotaExceededError"))
    )
  ) {
    window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
  }
  origConsoleError.apply(console, args);
};

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || "An unexpected UI error occurred.",
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] p-6">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 space-y-4 text-center shadow-xs">
            <h1 className="text-lg font-bold text-slate-900">
              Milo — Refresh View
            </h1>
            <p className="text-xs text-slate-600">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800"
            >
              Continue to Milo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
