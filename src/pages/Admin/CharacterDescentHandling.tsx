import { useEffect, useRef, useState } from "preact/hooks";
import { Application, Character } from "@shared/contracts";
import useRequest from "@hooks/request";
import { InputUnq, SelectUnq, TextAreaUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";
import RndContainer from "@components/RndContainer";
import { useWindowsLayer } from "@pages/WindowsLayer";
import { useDataContext } from "@contexts/dataContext";
import useError from "@hooks/error";
import usePopup from "@hooks/popup";
import { debugLog } from "@/core/logger";
import AllowedClassesSection from "./DescentEditor/AllowedClassesSection";
import SecondaryStatInitialsSection from "./DescentEditor/SecondaryStatInitialsSection";
import { toInt } from "@utils/common";
import { defineWindowRegistration } from "@/windows/windowFactory";
import { isConflictError } from "@/core/api/httpClient";
import { buildTopLevelDiffPatch } from "@/core/api/patch";

type TDescentWithMeta = Character.TDescent & { hash?: string };

const normalizeDescentForEditor = (
  descentData: TDescentWithMeta
): TDescentWithMeta => ({
  ...descentData,
  description: descentData.description || "",
  allowedClasses: [...(descentData.allowedClasses || [])],
  modifiers: {
    ...descentData.modifiers,
    primaryStats: [...descentData.modifiers.primaryStats],
    secondaryStatScalings: [...descentData.modifiers.secondaryStatScalings],
    hm: { ...descentData.modifiers.hm },
  },
});

const DescentHandlingWindow = ({
  close,
  selectedDescentProp,
}: {
  close: () => void;
  selectedDescentProp: TDescentWithMeta;
}) => {
  const { setError } = useError();
  const { setPopup } = usePopup();
  const { refreshCharacterBootstrap } = useDataContext();
  const [requestCharacter] = useRequest(Application.REQUEST_CONTROLLER.CHARACTERS);
  const [baseDescent, setBaseDescent] = useState<TDescentWithMeta>(
    normalizeDescentForEditor(selectedDescentProp)
  );
  const [selectedDescent, setSelectedDescent] =
    useState<Character.TDescent>(normalizeDescentForEditor(selectedDescentProp));
  const baseDescentRef = useRef(baseDescent);
  const selectedDescentRef = useRef(selectedDescent);
  const [classList, setClassList] =
    useState<{ id: string; name: Character.CLASSES }[]>();

  const reportRequestError = (message: string, error: unknown) => {
    setError(`${message}: ${error}`);
    debugLog(message, error);
  };

  useEffect(() => {
    const nextBase = normalizeDescentForEditor(selectedDescentProp);
    setBaseDescent(nextBase);
    setSelectedDescent(nextBase);
  }, [selectedDescentProp]);

  useEffect(() => {
    baseDescentRef.current = baseDescent;
  }, [baseDescent]);

  useEffect(() => {
    selectedDescentRef.current = selectedDescent;
  }, [selectedDescent]);

  const loadLatestDescent = () =>
    requestCharacter<TDescentWithMeta>({
      endPoint: "/getDescent",
      body: { descentId: baseDescentRef.current.id },
    }).then((response) => {
      const latest = normalizeDescentForEditor(response.data);
      setBaseDescent(latest);
      setSelectedDescent(latest);
      return latest;
    });

  const getDescentPatchPayload = () => ({
    base: baseDescentRef.current,
    patch: buildTopLevelDiffPatch(
      baseDescentRef.current as unknown as Record<string, unknown>,
      selectedDescentRef.current as unknown as Record<string, unknown>
    ),
  });

  const saveDescent = (): Promise<boolean> => {
    const { base, patch } = getDescentPatchPayload();
    if (patch.length < 1) return Promise.resolve(true);
    return requestCharacter<TDescentWithMeta>({
      endPoint: "/updateDescent",
      body: {
        expectedHash: base.hash,
        patch,
      },
    })
      .then((response) => {
        const saved = normalizeDescentForEditor(response.data);
        setBaseDescent(saved);
        setSelectedDescent(saved);
        refreshCharacterBootstrap();
        return true;
      })
      .catch((error) => {
        if (isConflictError(error)) {
          loadLatestDescent()
            .then(() => {
              setError(
                "Conflict (409): descent changed on server. Reloaded latest data, please retry."
              );
            })
            .catch((reloadError) => {
              reportRequestError(
                "Conflict (409): descent changed on server, and reload failed",
                reloadError
              );
            });
          return false;
        }
        reportRequestError("Failed to update descent", error);
        return false;
      });
  };

  const handleClose = () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.setTimeout(() => {
      const { patch } = getDescentPatchPayload();
      if (patch.length < 1) {
        close();
        return;
      }
      setPopup({
        label: "Mentés",
        text: "Szeretnél menteni?",
        save: "Igen",
        prev: "Nem",
        showClose: false,
        saveCallback: () => {
          void saveDescent().then((saved) => {
            if (!saved) return;
            setPopup(null);
            close();
          });
        },
        prevCallback: () => {
          setPopup(null);
          close();
        },
      });
    }, 0);
  };

  useEffect(() => {
    requestCharacter<{ id: string; name: Character.CLASSES }[]>({
      endPoint: "getAllClasses",
    })
      .then((response) => {
        setClassList([
          { id: "0", name: "Kaszt kiválasztása" as Character.CLASSES },
          ...response.data,
        ]);
      })
      .catch((error) => {
        reportRequestError("Failed to fetch classes", error);
      });
  }, []);

  return (
    <RndContainer
      id={`DescentHandling-${selectedDescent.id}`}
      aditionalIcons={null}
      close={handleClose}
      label={`char_${selectedDescent.id || ""}`}
    >
      <FlexCol className="grow w-full gap-1 overflow-auto">
        <InputUnq
          id={`DescentHandling-${selectedDescent.id}-name`}
          label="Név"
          value={selectedDescent.name || ""}
          disabled={true}
        />
        <AllowedClassesSection
          selectedDescent={selectedDescent}
          setSelectedDescent={setSelectedDescent}
          classList={classList}
        />
        <hr />
        <FlexCol className="gap-1 shrink-0 !min-h-fit">
          <label>HM</label>
          <InputUnq
            id={`DescentHandling-${selectedDescent.id}-hm-atk`}
            label={Character.HM.ATK}
            value={selectedDescent.modifiers.hm.ATK || 0}
            onChange={(e) => {
              const target = e.target as HTMLInputElement;
              const value = toInt(target.value, selectedDescent.modifiers.hm.ATK || 0);
              setSelectedDescent((prev) => ({
                ...prev,
                modifiers: { ...prev.modifiers, hm: { ...prev.modifiers.hm, ATK: value } },
              }));
            }}
            type="number"
          />
          <InputUnq
            id={`DescentHandling-${selectedDescent.id}-hm-def`}
            label={Character.HM.DEF}
            value={selectedDescent.modifiers.hm.DEF || 0}
            onChange={(e) => {
              const target = e.target as HTMLInputElement;
              const value = toInt(target.value, selectedDescent.modifiers.hm.DEF || 0);
              setSelectedDescent((prev) => ({
                ...prev,
                modifiers: { ...prev.modifiers, hm: { ...prev.modifiers.hm, DEF: value } },
              }));
            }}
            type="number"
          />
          <InputUnq
            id={`DescentHandling-${selectedDescent.id}-hm-ini`}
            label={Character.HM.INI}
            value={selectedDescent.modifiers.hm.INI || 0}
            onChange={(e) => {
              const target = e.target as HTMLInputElement;
              const value = toInt(target.value, selectedDescent.modifiers.hm.INI || 0);
              setSelectedDescent((prev) => ({
                ...prev,
                modifiers: { ...prev.modifiers, hm: { ...prev.modifiers.hm, INI: value } },
              }));
            }}
            type="number"
          />
          <InputUnq
            id={`DescentHandling-${selectedDescent.id}-hm-aim`}
            label={Character.HM.AIM}
            value={selectedDescent.modifiers.hm.AIM || 0}
            onChange={(e) => {
              const target = e.target as HTMLInputElement;
              const value = toInt(target.value, selectedDescent.modifiers.hm.AIM || 0);
              setSelectedDescent((prev) => ({
                ...prev,
                modifiers: { ...prev.modifiers, hm: { ...prev.modifiers.hm, AIM: value } },
              }));
            }}
            type="number"
          />
        </FlexCol>
        <hr />
        {Object.values(Character.PRIMARY_STATS).map((stat, index) => (
          <FlexRow
            key={`primary-stat-${stat}-${index}`}
            className="flex-wrap shrink-0 !min-h-fit"
          >
            <InputUnq
              id={`DescentHandling-${selectedDescent.id}-primaryStats-${index}`}
              label={stat}
              value={
                selectedDescent.modifiers.primaryStats.find((s) => s.name === stat)?.val || 0
              }
              type="number"
              onChange={(e) => {
                const target = e.target as HTMLInputElement;
                const value = toInt(
                  target.value,
                  selectedDescent.modifiers.primaryStats.find((s) => s.name === stat)?.val || 0
                );
                setSelectedDescent((prev) => {
                  const statIndex = prev.modifiers.primaryStats.findIndex(
                    (s) => s.name === stat
                  );
                  const primaryStats =
                    statIndex === -1
                      ? [...prev.modifiers.primaryStats, { name: stat, val: value }]
                      : prev.modifiers.primaryStats.map((primaryStat, currentIndex) =>
                          currentIndex === statIndex
                            ? { ...primaryStat, val: value }
                            : primaryStat
                        );
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      primaryStats,
                    },
                  };
                });
              }}
              className="justify-between grow shrink-0"
            />
          </FlexRow>
        ))}
        <hr />
        <SecondaryStatInitialsSection
          selectedDescent={selectedDescent}
          setSelectedDescent={setSelectedDescent}
          toInt={toInt}
        />
        <TextAreaUnq
          id={`DescentHandling-${selectedDescent.id}-description`}
          label="Leírás"
          value={selectedDescent.description}
          onSave={(msg) => {
            setSelectedDescent((prev) => ({ ...prev, description: msg }));
          }}
          element="editor"
        />
      </FlexCol>
    </RndContainer>
  );
};

export const AdminDescentDescriptorWindow = ({
  close,
  descentId,
}: {
  close: () => void;
  descentId: string;
}) => {
  const { setError } = useError();
  const [requestCharacter] = useRequest(Application.REQUEST_CONTROLLER.CHARACTERS);
  const [descent, setDescent] = useState<TDescentWithMeta | null>(null);

  useEffect(() => {
    if (!descentId) return;
    requestCharacter<TDescentWithMeta>({
      endPoint: "/getDescent",
      body: { descentId },
    })
      .then((response) => setDescent(response.data))
      .catch((error) => {
        setError(`Failed to fetch descent: ${error}`);
        debugLog("Failed to fetch descent", error);
      });
  }, [descentId]);

  if (!descent) {
    return (
      <RndContainer
        id={`DescentHandling-${descentId || "loading"}`}
        aditionalIcons={null}
        close={close}
        label="Származás"
      >
        <p className="p-2 text-sm opacity-70">Származás betöltése...</p>
      </RndContainer>
    );
  }

  return <DescentHandlingWindow close={close} selectedDescentProp={descent} />;
};

function DescentHandling() {
  const { descents: descentList } = useDataContext();
  const windowsLayer = useWindowsLayer();

  const openDescentWindow = (descentId: string) => {
    const windowName = `DescentHandling-${descentId}`;
    windowsLayer.addWindow(defineWindowRegistration({
      id: windowName,
      kind: "admin-descent-editor",
      title: "Származás",
      icon: "DH",
      params: { descentId },
    }));
  };

  return (
    <FlexCol className="w-full min-w-0 overflow-hidden">
      <SelectUnq
        id="DescentHandling-list"
        label="Származások"
        optionData={descentList ? descentList.map((c) => ({ value: c.id, label: c.name })) : []}
        onChange={(e) => {
          if (!e) return;
          openDescentWindow(e.value);
        }}
        value={{
          label: "Származás kiválasztása",
          value: "0" as Character.DESCENTS,
        }}
      />
    </FlexCol>
  );
}

export default DescentHandling;







