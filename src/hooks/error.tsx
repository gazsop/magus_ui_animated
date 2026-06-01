import { createContext } from "preact";
import { JSX } from "preact/jsx-runtime";
import { useContext, useEffect, useState } from "preact/hooks";
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
      setError(value);
    }
  };

  useEffect(() => {
    if (error) {
      if (document.getElementById("error-container")) {
        const errorText = document.getElementById("error-text");
        if (errorText) {
          errorText.textContent = `${errorText.textContent}\n${error}`;
        }
        return;
      }
      const errorContainer = document.createElement("div");
      const errorWindow = document.createElement("div");
      const errorTextContainer = document.createElement("div");
      const errorText = document.createElement("p");
      const errorHr = document.createElement("hr");
      const label = document.createElement("label");
      const closeBtn = document.createElement("button");

      label.textContent = "Error";
      label.classList.add("text-xl", "font-bold", "mb-2");
      errorHr.classList.add("fancy");
      errorContainer.id = "error-container";
      errorContainer.classList.add(
        "fixed",
        "top-0",
        "left-0",
        "w-full",
        "h-full",
        "bg-black",
        "bg-opacity-50",
        "z-50"
      );
      errorWindow.classList.add(
        "flex",
        "flex-col",
        "fixed",
        "top-1/2",
        "left-1/2",
        "transform",
        "-translate-x-1/2",
        "-translate-y-1/2",
        "bg-white",
        "p-4",
        "rounded-md",
        "shadow-md",
        "w-[min(400px,95vw)]",
        "max-w-[95vw]",
        "max-h-[90vh]",
        "min-h-[160px]",
        "fancy-container",
        "justify-stretch",
        "items-stretch",
        "select-none"
      );
      errorWindow.style.backgroundColor = "rgba(120, 64, 0, 0.9)";
      errorTextContainer.classList.add("overflow-auto", "flex-grow");
      errorText.classList.add("text-lg", "break-words", "whitespace-pre-wrap");
      errorText.textContent = error;
      errorText.id = "error-text";
      closeBtn.textContent = "Close";
      closeBtn.addEventListener("click", () => {
        errorContainer.remove();
        setErrorWithPolicy(null);
      });

      errorWindow.appendChild(label);
      errorWindow.appendChild(errorHr);
      errorTextContainer.appendChild(errorText);
      errorWindow.appendChild(errorTextContainer);
      errorWindow.appendChild(closeBtn);
      errorContainer.appendChild(errorWindow);
      document.body.appendChild(errorContainer);
      closeBtn.focus();
    } else {
      const errorContainer = document.getElementById("error-container");
      if (errorContainer) errorContainer.remove();
    }
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
        setError(event.message || "Unhandled window error");
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
        setError(
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Unhandled promise rejection"
        );
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
    </ErrorContext.Provider>
  );
}

export default function useError() {
  return useContext(ErrorContext);
}
