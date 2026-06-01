import { Application } from "@shared/contracts";
import useError from "./error";
import { isConflictError, requestController } from "../core/api/httpClient";

function useRequest(controller: Application.REQUEST_CONTROLLER) {
  const { setError } = useError();

  const request = async <T, K extends Object = {}>({
    endPoint,
    method = "POST",
    body,
    headers,
    silentStatuses,
    errorMode = "blocking",
  }: {
    endPoint: string;
    method?: "GET" | "POST";
    body?: K;
    headers?: Record<string, string>;
    silentStatuses?: number[];
    errorMode?: "blocking" | "quiet";
  }): Promise<Application.IResponseDataSuccess<T>> => {
    try {
      const result = await requestController<T, K>({
        controller,
        endPoint,
        method,
        body,
        headers,
        silentStatuses,
        telemetryMode: errorMode,
      });

      if ("error" in result && result.error) {
        const errorString =
          "Network response was not ok: " + JSON.stringify(result);
        setError(errorString, { severity: errorMode });
        throw new Error(errorString);
      }

      return result as Application.IResponseDataSuccess<T>;
    } catch (error) {
      const errorString =
        error instanceof Error ? error.message : String(error);
      const isSilentStatus =
        error instanceof Error &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number" &&
        silentStatuses?.includes((error as { status: number }).status);
      if (isSilentStatus) {
        throw error;
      } else if (isConflictError(error)) {
        setError("Conflict (409): server data changed. Reload latest data and retry.");
      } else if (errorMode === "quiet") {
        setError("Request failed: " + errorString, {
          severity: "quiet",
          context: "request:quiet",
        });
      } else {
        setError("Request failed: " + errorString);
      }
      throw error;
    }
  };

  return [request];
}

export default useRequest;
