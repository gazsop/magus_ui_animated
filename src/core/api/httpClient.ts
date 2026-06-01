import { Application } from "@shared/contracts";
import { API_BASE_URL } from "../config/runtime";
import { reportClientError } from "./errorReporter";

const DEFAULT_TIMEOUT_MS = 5000;

export class HttpRequestError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: unknown;

  constructor(message: string, status: number, statusText: string, body: unknown) {
    super(message);
    this.name = "HttpRequestError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export const isConflictError = (error: unknown): boolean =>
  error instanceof HttpRequestError && error.status === 409;

const normalizePath = (value: string): string => {
  if (!value) return "";
  const withoutLeading = value.startsWith("/") ? value.slice(1) : value;
  return withoutLeading.endsWith("/")
    ? withoutLeading.slice(0, withoutLeading.length - 1)
    : withoutLeading;
};

const buildControllerBaseUrl = (
  controller: Application.REQUEST_CONTROLLER
): string => {
  const normalizedController = normalizePath(controller);
  return `${API_BASE_URL}/${normalizedController}/`;
};

export const requestController = async <TResponse, TBody extends object = {}>({
  controller,
  endPoint,
  method = "POST",
  body,
  headers,
  silentStatuses,
  telemetryMode = "blocking",
}: {
  controller: Application.REQUEST_CONTROLLER;
  endPoint: string;
  method?: "GET" | "POST";
  body?: TBody;
  headers?: Record<string, string>;
  silentStatuses?: number[];
  telemetryMode?: "blocking" | "quiet";
}): Promise<
  Application.IResponseDataSuccess<TResponse> | Application.IResponseDataError<TResponse>
> => {
  const requestTimestamp = Date.now();
  const payload: Application.IRequestData<TBody> = {
    data: (body ?? {}) as TBody,
    requestTimestamp,
  };
  const url = `${buildControllerBaseUrl(controller)}${normalizePath(endPoint)}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(headers ?? {}),
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(payload) }),
      credentials: "include",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    const rawBody = await response.text();
    let result:
      | Application.IResponseDataSuccess<TResponse>
      | Application.IResponseDataError<TResponse>;
    try {
      result = JSON.parse(rawBody) as
        | Application.IResponseDataSuccess<TResponse>
        | Application.IResponseDataError<TResponse>;
    } catch {
      throw new Error(rawBody || `HTTP ${response.status}`);
    }

    if (!response.ok) {
      const isSilentStatus = silentStatuses?.includes(response.status) || false;
      const errorMessage =
        "error" in result && result.error
          ? JSON.stringify(result.data)
          : `HTTP ${response.status}`;
      if (!isSilentStatus) {
        void reportClientError({
          level: telemetryMode === "quiet" ? "warn" : "error",
          context: `requestController:http-error:${telemetryMode}`,
          message: errorMessage,
          request: { controller, endPoint, method, body, requestTimestamp, url },
          response: {
            status: response.status,
            statusText: response.statusText,
            body: result,
          },
        });
      }
      throw new HttpRequestError(
        errorMessage,
        response.status,
        response.statusText,
        result
      );
    }

    return result;
  } catch (error) {
    const err = error as Error;
    void reportClientError({
      level: telemetryMode === "quiet" ? "warn" : "error",
      context: `requestController:exception:${telemetryMode}`,
      message: err?.message || String(error),
      stack: err?.stack,
      request: { controller, endPoint, method, body, requestTimestamp, url },
    });
    throw error;
  }
};
