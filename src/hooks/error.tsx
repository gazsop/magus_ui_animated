import { createContext } from "preact";
import { JSX } from "preact/jsx-runtime";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import AppModal from "@components/AppModal";
import { reportClientError } from "../core/api/errorReporter";

type TErrorContext = {
  error: string | null;
  setError: (value: string | null, options?: TSetErrorOptions) => void;
};

export type TErrorSeverity = "blocking" | "quiet";
export type TSetErrorOptions = {
  severity?: TErrorSeverity;
  context?: string;
};

const ErrorContext = createContext<TErrorContext>({
  error: null,
  setError: () => {},
});

export function ErrorProvider(props: { children: JSX.Element | JSX.Element[] }) {
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const setErrorWithPolicy: TErrorContext["setError"] = (value, options = {}) => {
    if (!value) {
      setError(null);
      return;
    }
    const severity = options.severity || "blocking";
    void reportClientError({
      level: severity === "quiet" ? "warn" : "error",
      context: options.context || `ui:setError:${severity}`,
      message: value,
    });
    if (import.meta.env.DEV || severity === "blocking") {
      setError((current) => (current ? `${current}\n${value}` : value));
    }
  };

  useEffect(() => {
    if (error) closeRef.current?.focus();
  }, [error]);

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      void reportClientError({
        level: "error",
        context: "window.onerror",
        message: event.message || "Unhandled window error",
        stack: event.error?.stack,
        meta: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
      if (import.meta.env.DEV) {
        setError((current) =>
          current
            ? `${current}\n${event.message || "Unhandled window error"}`
            : event.message || "Unhandled window error"
        );
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      void reportClientError({
        level: "error",
        context: "window.unhandledrejection",
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Unhandled promise rejection",
        stack: reason instanceof Error ? reason.stack : undefined,
        meta: {
          reason: typeof reason === "string" ? reason : String(reason),
        },
      });
      if (import.meta.env.DEV) {
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Unhandled promise rejection";
        setError((current) => (current ? `${current}\n${message}` : message));
      }
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return (
    <ErrorContext.Provider value={{ error, setError: setErrorWithPolicy }}>
      {props.children}
      {error ? (
        <AppModal
          id="error-container"
          label="Error"
          widthClass="w-[min(400px,95vw)]"
          actions={
            <button
              ref={closeRef}
              type="button"
              onClick={() => setErrorWithPolicy(null)}
            >
              Close
            </button>
          }
        >
          <div className="overflow-auto flex-grow">
            <p id="error-text" className="text-lg break-words whitespace-pre-wrap">
              {error}
            </p>
          </div>
        </AppModal>
      ) : null}
    </ErrorContext.Provider>
  );
}

export default function useError() {
  return useContext(ErrorContext);
}
