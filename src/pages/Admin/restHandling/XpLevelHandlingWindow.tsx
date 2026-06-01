import { useEffect, useState } from "preact/hooks";
import RndContainer from "@components/RndContainer";
import { FlexCol, FlexRow } from "@components/Flex";
import { ButtonUnq, InputUnq } from "@components/GeneralElements";
import { debugLog } from "@/core/logger";
import { TCloseProps, TRestRequest, TSetError, toErrorMessage } from "./types";
import { isConflictError } from "@/core/api/httpClient";

type TXpLevelHandlingWindowProps = TCloseProps & {
  requestData: TRestRequest;
  setError: TSetError;
};

export default function XpLevelHandlingWindow({
  close,
  requestData,
  setError,
}: TXpLevelHandlingWindowProps) {
  const [levels, setLevels] = useState<number[]>([]);
  const [hash, setHash] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const validateOrdered = (arr: number[]) => {
    const errors: Record<number, string> = {};
    for (let i = 0; i < arr.length; i += 1) {
      const v = Number(arr[i]);
      if (!Number.isFinite(v) || v <= 0) {
        errors[i] = "Must be a positive number";
      }
      if (i > 0 && v <= Number(arr[i - 1])) {
        errors[i] = `Must be greater than Lv ${i} (${arr[i - 1]})`;
      }
    }
    return errors;
  };

  const load = () => {
    requestData<{ levels: number[]; hash: string }>({
      endPoint: "getXpLevels",
    })
      .then((response) => {
        setLevels((response.data?.levels || []).map((n) => Number(n)));
        setHash(response.data?.hash || "");
      })
      .catch((error) => {
        setError(toErrorMessage(error));
        debugLog("Failed to fetch xp levels:", error);
      });
  };

  const saveLevels = (next: number[]) => {
    requestData<{ levels: number[]; hash: string }>({
      endPoint: "updateXpLevels",
      body: {
        expectedHash: hash,
        patch: [{ op: "replace", path: "/levels", value: next }],
      },
    })
      .then((response) => {
        setLevels((response.data?.levels || []).map((n) => Number(n)));
        setHash(response.data?.hash || "");
      })
      .catch((error) => {
        if (isConflictError(error)) {
          load();
          setError("Conflict (409): xp levels changed on server. Reloaded latest data, please retry.");
          return;
        }
        setError(toErrorMessage(error));
        debugLog("Failed to update xp levels:", error);
      });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (levels.length > 0) {
      setNewLevel(String((levels[levels.length - 1] || 0) + 1));
    } else {
      setNewLevel("");
    }
  }, [levels.length]);

  return (
    <RndContainer
      id="xp-level-handling"
      aditionalIcons={null}
      close={close}
      label="xp-level-handling"
    >
      <FlexCol className="grow w-full min-w-0 p-1 gap-0.5 overflow-auto">
        <FlexRow className="items-end gap-0.5 min-w-0 shrink-0 flex-wrap">
          <InputUnq
            id="new-xp-level"
            label="Új XP küszöb"
            value={newLevel}
            onChange={(e) => setNewLevel(e.currentTarget.value)}
            className="shrink-0"
            widthOverride="w-40 shrink-0"
          />
          <ButtonUnq
            id="add-xp-level"
            className="shrink-0"
            onClick={() => {
              const val = Math.floor(Number(newLevel));
              if (!Number.isFinite(val) || val <= 0) {
                setError("Invalid XP level value");
                return;
              }
              if (levels.length > 0 && val <= levels[levels.length - 1]) {
                setError("New level must be greater than previous level");
                return;
              }
              const next = [...levels, val];
              const errors = validateOrdered(next);
              setRowErrors(errors);
              if (Object.keys(errors).length > 0) {
                setError("Invalid XP level order");
                return;
              }
              setLevels(next);
              saveLevels(next);
            }}
          >
            Add
          </ButtonUnq>
        </FlexRow>
        <FlexCol className="grow min-w-0 shrink-0 overflow-auto gap-0.5">
          {levels.length === 0 ? (
            <p>Nincs mentett XP küszöb.</p>
          ) : (
            levels.map((level, idx) => (
              <FlexRow
                key={`xp-level-${idx}`}
                className="items-center justify-between fancy-container px-0.5 py-0.25 gap-0.5 min-w-0 flex-wrap"
              >
                <p className="w-10 shrink-0">Lv {idx + 1}</p>
                <input
                  type="number"
                  className="text-black h-[26px] rounded px-1 grow min-w-[120px]"
                  value={String(level)}
                  onInput={(e) => {
                    const nextVal = Math.floor(Number((e.currentTarget as HTMLInputElement).value || 0));
                    const next = [...levels];
                    next[idx] = Number.isFinite(nextVal) ? nextVal : 0;
                    const errors = validateOrdered(next);
                    setRowErrors(errors);
                    setLevels(next);
                  }}
                  onBlur={() => {
                    const errors = validateOrdered(levels);
                    setRowErrors(errors);
                    if (Object.keys(errors).length === 0) {
                      saveLevels(levels);
                    }
                  }}
                />
                {rowErrors[idx] ? (
                  <p className="text-red-500 text-xs w-44 shrink-0">
                    {rowErrors[idx]}
                  </p>
                ) : null}
              </FlexRow>
            ))
          )}
        </FlexCol>
      </FlexCol>
    </RndContainer>
  );
}


