import { useEffect, useState } from "preact/hooks";
import { ServerApi } from "@shared/contracts";
import { isConflictError } from "@/core/api/httpClient";
import { debugLog } from "@/core/logger";
import { TRestRequest, TSetError, toErrorMessage } from "./types";

export type TNamedValue = { name: string; value: string };

type TNamedDatasetResponse = {
  entries: TNamedValue[];
  hash: string;
};

type TUseNamedRestDatasetArgs = {
  requestData: TRestRequest;
  setError: TSetError;
  getEndPoint: string;
  updateEndPoint: string;
  deleteEndPoint: string;
  labelPlural: string;
  labelSingular: string;
};

export const useNamedRestDataset = ({
  requestData,
  setError,
  getEndPoint,
  updateEndPoint,
  deleteEndPoint,
  labelPlural,
  labelSingular,
}: TUseNamedRestDatasetArgs) => {
  const [entries, setEntries] = useState<TNamedValue[]>([]);
  const [hash, setHash] = useState("");

  const applyResponse = (response: TNamedDatasetResponse | null | undefined, fallback: TNamedValue[]) => {
    setEntries(response?.entries || fallback);
    setHash(response?.hash || "");
  };

  const load = () =>
    requestData<TNamedDatasetResponse>({ endPoint: getEndPoint })
      .then((response) => {
        applyResponse(response.data, []);
      })
      .catch((error) => {
        setError(toErrorMessage(error));
        debugLog(`Failed to fetch ${labelPlural}:`, error);
      });

  useEffect(() => {
    load();
  }, []);

  const saveEntry = (entry: TNamedValue, options: { clear?: () => void } = {}) => {
    const index = entries.findIndex((row) => row.name === entry.name);
    const fallback = [...entries];
    if (index === -1) {
      fallback.push(entry);
    } else {
      fallback[index] = entry;
    }
    const patch: ServerApi.PatchOperation[] = [
      { op: "replace", path: "/name", value: entry.name },
      { op: "replace", path: "/value", value: entry.value },
    ];
    requestData<TNamedDatasetResponse>({
      endPoint: updateEndPoint,
      body: {
        expectedHash: hash,
        patch,
      },
    })
      .then((response) => {
        applyResponse(response.data, fallback);
        options.clear?.();
      })
      .catch((error) => {
        if (isConflictError(error)) {
          load();
          setError(`Conflict (409): ${labelPlural} changed on server. Reloaded latest data, please retry.`);
          return;
        }
        setError(toErrorMessage(error));
        debugLog(`Failed to update ${labelPlural}:`, error);
      });
  };

  const deleteEntry = (name: string) => {
    const fallback = entries.filter((entry) => entry.name !== name);
    requestData<TNamedDatasetResponse>({
      endPoint: deleteEndPoint,
      body: { name },
    })
      .then((response) => {
        applyResponse(response.data, fallback);
      })
      .catch((error) => {
        setError(toErrorMessage(error));
        debugLog(`Failed to delete ${labelSingular}:`, error);
      });
  };

  const addLocalEntry = (name: string) => {
    setEntries([...entries, { name, value: "" }]);
  };

  return {
    entries,
    hash,
    load,
    saveEntry,
    deleteEntry,
    addLocalEntry,
    setEntries,
  };
};
