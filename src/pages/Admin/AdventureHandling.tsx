import { useEffect, useState } from "preact/hooks";
import useRequest from "@hooks/request";
import { SingleValue } from "react-select";
import {
  ButtonUnq,
  InputUnq,
  SelectUnq,
} from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";
import { Adventure, Application } from "@shared/contracts";
import CharacterHandling from "./CharacterHandling";
import useError from "@hooks/error";
import { debugLog } from "@/core/logger";
import { isConflictError } from "@/core/api/httpClient";

const nowWorldDateTime = (): number => {
  return Date.now();
};
const formatWorldDateTime = (epochMs?: number | null): string => {
  const d = new Date(Number(epochMs || 0) || Date.now());
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
};
const parseWorldDateTime = (value: string): number | null => {
  const text = String(value || "").trim();
  const match = /^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (!Number.isFinite(year) || month < 0 || month > 11) return null;
  const date = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
};

const newAdv = {
  id: "0",
  json: {
    name: "New Adventure",
    worldDateStart: nowWorldDateTime(),
    worldDateCurrent: nowWorldDateTime(),
  },
};
const emptyAdv = {
  id: "-1",
  json: {
    name: "",
    worldDateStart: nowWorldDateTime(),
    worldDateCurrent: nowWorldDateTime(),
  },
};

function AdventureHandling() {
  type TAdventureAdmin = Adventure.IAdventureClient & { hash?: string };
  const [adventures, _setAdventures] = useState<TAdventureAdmin[]>([
    newAdv,
  ]);
  const [selectedAdventure, setSelectedAdventure] =
    useState<TAdventureAdmin>(emptyAdv);
  const [display, setDisplay] = useState<boolean>(true);
  const [requestAdventure] = useRequest(
    Application.REQUEST_CONTROLLER.ADVENTURES
  );
  const { setError } = useError();

  const reportRequestError = (message: string, error: unknown) => {
    setError(`${message}: ${error}`);
    debugLog(message, error);
  };

  useEffect(() => {
    getAllAdventures();
  }, []);

  useEffect(() => {
    if (
      selectedAdventure.id !== "-1" &&
      !adventures.some((adv) => adv.id === selectedAdventure.id)
    ) {
      setSelectedAdventure(emptyAdv);
    }
  }, [adventures, selectedAdventure.id]);

  const isEmptySelection = selectedAdventure.id === "-1";
  const isNewSelection = selectedAdventure.id === "0";
  const isExistingSelection = !isEmptySelection && !isNewSelection;
  const selectedStart = formatWorldDateTime(selectedAdventure.json.worldDateStart);
  const selectedCurrent = formatWorldDateTime(selectedAdventure.json.worldDateCurrent);

  function getAllAdventures() {
    const currentSelectedId = selectedAdventure.id;
    requestAdventure<TAdventureAdmin[]>({
      endPoint: "/getAll",
    })
      .then((response) => {
        const nextAdventures = [newAdv, ...response.data];
        _setAdventures(nextAdventures);
        if (currentSelectedId === "-1") {
          setSelectedAdventure(newAdv);
          return;
        }
        const matchedAdventure = nextAdventures.find(
          (adv) => adv.id === currentSelectedId
        );
        setSelectedAdventure(matchedAdventure || newAdv);
      })
      .catch((error) => {
        reportRequestError("Failed to fetch adventures", error);
      });
  }

  function setAdventures(adv: Adventure.IAdventureClient) {
    if (adv.id === "-1") return;
    if (adventures.some((currentAdventure) => currentAdventure.id === adv.id)) {
      _setAdventures((prev) =>
        prev.map((prevAdv) => {
          if (prevAdv.id === adv.id) {
            return adv;
          }
          return prevAdv;
        })
      );
      setSelectedAdventure(adv);
      return;
    }
    _setAdventures((prev) => [...prev, adv]);
    setSelectedAdventure(adv);
  }

  function getSelectValue() {
    if (isEmptySelection)
      return { label: "", value: "" };
    if (isNewSelection)
      return {
        label: selectedAdventure.json.name || "New Adventure",
        value: selectedAdventure.id || "0",
      };
    return { label: selectedAdventure.json.name, value: selectedAdventure.id };
  }

  return (
    <FlexCol className="w-full min-w-0">
      <label onClick={() => setDisplay(!display)} className={`text-center`}>
        ADVENTURES
      </label>
      <SelectUnq
        id={"adventures-list"}
        label={"Select Adventure"}
        value={getSelectValue()}
        onChange={(e: SingleValue<{ label: string; value: string }>) => {
          if (!e) return;
          setSelectedAdventure(
            adventures.find((adv) => adv.id === e.value) || newAdv
          );
        }}
        optionData={[
          ...adventures.map((adventure, index) => {
                if (index === 0)
                  return {
                    label: "New Adventure",
                value: "0",
              };
            return {
              label: adventure.json.name,
              value: adventure.id,
            };
          }),
        ]}
        className="m-1"
        disabled={false}
      />
      {display && (
        <>
          <InputUnq
            id={`id-${selectedAdventure.id}`}
            label={"id"}
            value={isExistingSelection ? selectedAdventure.id : ""}
            className="m-1"
            disabled={true}
          />
          <InputUnq
            id={`name-${selectedAdventure.id}`}
            label={"Name"}
            value={isEmptySelection ? "" : selectedAdventure.json.name}
            onBlur={(e) => {
              if (isEmptySelection) return;
              const elem = e.target as HTMLInputElement;
              const val = elem.value as string;
              setAdventures({
                id: selectedAdventure.id,
                json: {
                  name: val,
                },
              });
            }}
            className="m-1"
            disabled={isEmptySelection}
          />
          <InputUnq
            id={`world-start-${selectedAdventure.id}`}
            label={"Start Date (YYYY.MM.DD HH:mm)"}
            value={isEmptySelection ? "" : selectedStart}
            onBlur={(e) => {
              if (isEmptySelection) return;
              const val = (e.target as HTMLInputElement).value.trim();
              const parsed = parseWorldDateTime(val);
              if (parsed === null) return;
              setAdventures({
                ...selectedAdventure,
                json: {
                  ...selectedAdventure.json,
                  worldDateStart: parsed,
                },
              });
            }}
            className="m-1"
            disabled={isEmptySelection}
          />
          <InputUnq
            id={`world-current-${selectedAdventure.id}`}
            label={"Current Date (YYYY.MM.DD HH:mm)"}
            value={isEmptySelection ? "" : selectedCurrent}
            onBlur={(e) => {
              if (isEmptySelection) return;
              const val = (e.target as HTMLInputElement).value.trim();
              const parsed = parseWorldDateTime(val);
              if (parsed === null) return;
              setAdventures({
                ...selectedAdventure,
                json: {
                  ...selectedAdventure.json,
                  worldDateCurrent: parsed,
                },
              });
            }}
            className="m-1"
            disabled={isEmptySelection}
          />
          <FlexRow className="flex-wrap">
            <ButtonUnq
              id={`get-all-${selectedAdventure.id}`}
              onClick={() => getAllAdventures()}
              className="m-1"
            >
              GET ALL
            </ButtonUnq>
            <ButtonUnq
              id={`update-${selectedAdventure.id}`}
              onClick={() => {
                if (!isExistingSelection) return;
                requestAdventure({
                  endPoint: "/update",
                  body: {
                    id: selectedAdventure.id,
                    expectedHash: selectedAdventure.hash,
                    patch: [
                      { op: "replace", path: "/name", value: selectedAdventure.json.name },
                      { op: "replace", path: "/worldDateStart", value: selectedAdventure.json.worldDateStart || nowWorldDateTime() },
                      { op: "replace", path: "/worldDateCurrent", value: selectedAdventure.json.worldDateCurrent || nowWorldDateTime() },
                    ],
                  },
                })
                  .then(() => {
                    getAllAdventures();
                  })
                  .catch((error) => {
                    if (isConflictError(error)) {
                      getAllAdventures();
                      setError("Conflict (409): adventure changed on server. Reloaded latest data, please retry.");
                      return;
                    }
                    reportRequestError("Failed to update adventure", error);
                  });
              }}
              className="m-1"
              disabled={!isExistingSelection}
            >
              UPDATE
            </ButtonUnq>
            <ButtonUnq
              id={`delete-${selectedAdventure.id}`}
              onClick={() => {
                if (!isExistingSelection) return;
                if (!confirm("Are you sure you want to delete this adventure?"))
                  return;
                requestAdventure({
                  endPoint: "/delete",
                  body: {
                    id: selectedAdventure.id,
                  },
                })
                  .then(() => {
                    getAllAdventures();
                  })
                  .catch((error) => {
                    reportRequestError("Failed to delete adventure", error);
                  });
              }}
              className="m-1"
              disabled={!isExistingSelection}
            >
              DELETE
            </ButtonUnq>
            <ButtonUnq
              id={`create-${selectedAdventure.id}`}
              onClick={() => {
                if (!isNewSelection) return;
                const body: Adventure.IAdventureClient = {
                  id: "",
                  json: {
                    name: selectedAdventure.json.name,
                  },
                };
                if (!body.json.name.trim()) {
                  setError("Please enter an adventure name");
                  return;
                }
                requestAdventure({
                  endPoint: "/create",
                  body: body,
                })
                  .then(() => {
                    getAllAdventures();
                  })
                  .catch((error) => {
                    reportRequestError("Failed to create adventure", error);
                  });
              }}
              className="m-1"
              disabled={!isNewSelection}
            >
              CREATE
            </ButtonUnq>
          </FlexRow>
          <hr className="fancy m-1" />
          <FlexCol>
            <label htmlFor="" className={`text-center`}>
              Chars
            </label>
          </FlexCol>
          <CharacterHandling
            advId={selectedAdventure.id !== "-1" ? selectedAdventure.id : "0"}
          />
        </>
      )}
    </FlexCol>
  );
}

export default AdventureHandling;




