import { useEffect, useMemo, useRef, useState } from "preact/compat";
import { FlexCol, FlexRow } from "@components/Flex";
import { Adventure, Application, Character } from "@shared/contracts";
import useRequest from "@hooks/request";
import {
  ButtonUnq,
  CheckBoxUnq,
  HTMLOptionData,
  InputUnq,
  SelectUnq,
  TextAreaUnq,
} from "@components/GeneralElements";
import DescentHandling from "./CharacterDescentHandling";
import { useWindowsLayer } from "@pages/WindowsLayer";
import RndContainer from "@components/RndContainer";
import RollItem from "@components/Roll";
import { SecondaryStatLevelsElement } from "./CharacterSecondaryStatHandling";
import { useDataContext } from "@contexts/dataContext";
import useError from "@hooks/error";
import usePopup from "@hooks/popup";
import { defineWindowRegistration } from "@/windows/windowFactory";
import SpecsSection from "./ClassEditor/SpecsSection";
import { SpellsElement } from "./ClassEditor/SpellsElements";
import SecondaryStatScalingsSection from "./ClassEditor/SecondaryStatScalingsSection";
import { toInt } from "@utils/common";
import { debugLog } from "@/core/logger";
import { isConflictError } from "@/core/api/httpClient";
import { buildTopLevelDiffPatch } from "@/core/api/patch";
import { nanoid } from "nanoid";

type TClassWithMeta = Character.TClass & { hash?: string };

const createEmptySpell = (): Character.Spell.TSpellElements & {
  descriptionOpen: boolean;
  levels: Character.Spell.ISpellLevel[];
} => ({
  id: "0",
  name: "",
  lvlReq: 0,
  description: "",
  spec: "common",
  levels: [],
  resourceCost: 0,
  passive: false,
  type: "damage",
  nrOfTurns: 1,
  nrOfTurnsToCast: 1,
  descriptionOpen: false,
  range: 0,
  class: "" as Character.Spell.SPELL_CLASSES,
  parentId: "0",
});

const normalizeClassForEditor = (classData: TClassWithMeta): TClassWithMeta => ({
  ...classData,
  description: classData.description || "",
  modifiers: {
    ...classData.modifiers,
    initialSecondarySkillPoints:
      Number(classData.modifiers.initialSecondarySkillPoints || 0),
    secondarySkillPointsPerLvl:
      Number(classData.modifiers.secondarySkillPointsPerLvl || 0),
    primaryStats: [...classData.modifiers.primaryStats],
    secondaryStats: [...classData.modifiers.secondaryStats],
    secondaryStatScalings: [...classData.modifiers.secondaryStatScalings],
  },
  specs: classData.specs ? [...classData.specs] : [],
  spells: classData.spells ? [...classData.spells] : [],
});

const ClassHandlingWindow = ({
  close,
  selectedClassProps,
}: {
  close: () => void;
  selectedClassProps: TClassWithMeta;
}) => {
  const { refreshCharacterBootstrap } = useDataContext();
  const { setError } = useError();
  const { setPopup } = usePopup();
  const [requestClass] = useRequest(Application.REQUEST_CONTROLLER.CHARACTERS);
  const [baseClass, setBaseClass] = useState<TClassWithMeta>(
    normalizeClassForEditor(selectedClassProps)
  );
  const [selectedClass, setSelectedClass] =
    useState<Character.TClass>(normalizeClassForEditor(selectedClassProps));
  const baseClassRef = useRef(baseClass);
  const selectedClassRef = useRef(selectedClass);
  const spellsRef = useRef<{
    [key in string]:
      | Character.Spell.TSpellElements
      | Character.Spell.ISpellLevel;
  }>({});
  const secondaryStatRefs = useRef<Character.TSecondaryStat[]>([]);
  const [showSecondaryStats, setshowSecondaryStats] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const [showSpells, setShowSpells] = useState(false);
  const [specsMounted, setSpecsMounted] = useState(false);
  const [spellsMounted, setSpellsMounted] = useState(false);

    useEffect(() => {
      const nextBase = normalizeClassForEditor(selectedClassProps);
      setBaseClass(nextBase);
      setSelectedClass(nextBase);
      secondaryStatRefs.current = nextBase.modifiers.secondaryStats;
    }, [selectedClassProps]);

    useEffect(() => {
      baseClassRef.current = baseClass;
    }, [baseClass]);

    useEffect(() => {
      selectedClassRef.current = selectedClass;
    }, [selectedClass]);

    const loadLatestClass = () =>
      requestClass<TClassWithMeta>({
        endPoint: "/getClass",
        body: { classId: baseClassRef.current.id },
      }).then((response) => {
        const latest = normalizeClassForEditor(response.data);
        setBaseClass(latest);
        setSelectedClass(latest);
        secondaryStatRefs.current = latest.modifiers.secondaryStats;
        refreshCharacterBootstrap();
        return latest;
      });

    const getClassPatchPayload = () => {
      const currentBase = baseClassRef.current;
      const currentClass = selectedClassRef.current;
      const mountedSpells = Object.keys(spellsRef.current);
      const reconstructedSpells = mountedSpells
        .map((s) => {
          if (spellsRef.current[s].parentId !== "0") {
            return null;
          }
          const levels = Object.keys(spellsRef.current)
            .map((l) => {
              if (
                !("parentId" in spellsRef.current[l]) ||
                !spellsRef.current[l].parentId ||
                spellsRef.current[l].parentId !== s
              ) {
                return null;
              }
              return spellsRef.current[l] as Character.Spell.ISpellLevel;
            })
            .filter(Boolean) as Character.Spell.ISpellLevel[];
          const spell = spellsRef.current[s] as Character.Spell.TSpellElements;
          return {
            ...spell,
            levels,
          };
        })
        .filter(Boolean) as Character.Spell.TSpellElements[];

      const newSelectedClass: Character.TClass = {
        ...currentClass,
        spells: mountedSpells.length > 0 ? reconstructedSpells : currentClass.spells,
        modifiers: {
          ...currentClass.modifiers,
          secondaryStats:
            secondaryStatRefs.current.length > 0
              ? secondaryStatRefs.current
              : currentClass.modifiers.secondaryStats,
        },
      };
      const patch = buildTopLevelDiffPatch(
        currentBase as unknown as Record<string, unknown>,
        newSelectedClass as unknown as Record<string, unknown>
      );
      return { base: currentBase, patch };
    };

    const saveClass = (): Promise<boolean> => {
      const { base, patch } = getClassPatchPayload();
      if (patch.length < 1) return Promise.resolve(true);
      return requestClass<TClassWithMeta>({
        endPoint: "/updateClass",
        body: {
          expectedHash: base.hash,
          patch,
        },
      })
        .then((response) => {
          const saved = normalizeClassForEditor(response.data);
          setBaseClass(saved);
          setSelectedClass(saved);
          secondaryStatRefs.current = saved.modifiers.secondaryStats;
          refreshCharacterBootstrap();
          return true;
        })
        .catch((error) => {
          if (isConflictError(error)) {
            loadLatestClass()
              .then(() => {
                setError("Conflict (409): class changed on server. Reloaded latest data, please retry.");
              })
              .catch((reloadError) => {
                setError("Conflict (409): class changed on server, and reload failed: " + reloadError);
                debugLog("Failed to reload class after conflict:", reloadError);
              });
            return false;
          }
          setError("Failed to update class: " + error);
          debugLog("Failed to update class:", error);
          return false;
        });
    };

    const handleClose = () => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      window.setTimeout(() => {
        const { patch } = getClassPatchPayload();
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
            void saveClass().then((saved) => {
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

    const SecondaryStatScalings = () => (
      <SecondaryStatScalingsSection
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        toInt={toInt}
      />
    );

    const secondaryStatLevels = useMemo(
      () =>
        Object.keys(Character.SECONDARY_STATS).map((keyProp) => {
          const key = keyProp as keyof typeof Character.SECONDARY_STATS;
          const statName = Character.SECONDARY_STATS[key];
          const savedStat = selectedClass.modifiers.secondaryStats.find(
            (s) => s.name === statName
          );
          return {
            id: `secondary-${statName}`,
            name: statName,
            skillLevel:
              savedStat?.skillLevel || Character.SECONDARY_STAT_LEVEL.BASIC,
            skill: savedStat?.skill || 0,
            lvlReq: savedStat?.lvlReq || 0,
            note: savedStat?.note || "",
          };
        }),
      [selectedClass.modifiers.secondaryStats]
    );

    const Spells = () => {
      const [parentId, setParentId] = useState<string>("0");

      const [selectedSpell, setSelectedSpell] = useState<
        Character.Spell.TSpellElements & {
          descriptionOpen: boolean;
          levels?: Character.Spell.ISpellLevel[];
        }
      >(createEmptySpell());

      const isMouseDownRef = useRef(false);

      useEffect(() => {
        const spellsElement = document.getElementById("spells");
        const onMouseDown = () => {
          isMouseDownRef.current = true;
        };
        const onMouseUp = () => {
          isMouseDownRef.current = false;
        };
        spellsElement?.addEventListener("mousedown", onMouseDown);
        spellsElement?.addEventListener("mouseup", onMouseUp);

        return () => {
          spellsElement?.removeEventListener("mousedown", onMouseDown);
          spellsElement?.removeEventListener("mouseup", onMouseUp);
        };
      }, []);

      const NewSpell = () => {
        return (
          <FlexCol className="grow mb-2">
            <FlexRow>
              <SelectUnq
                id={`char-select-spell-${parentId}`}
                label="parentId"
                optionData={[
                  {
                    value: "0",
                    label: "New Spell",
                  },
                  ...selectedClass.spells.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
                onChange={(e) => {
                  const val = e?.value || "0";
                  if (val === "0") {
                    setParentId("0");
                    setSelectedSpell(createEmptySpell());
                    return;
                  }
                  const spell = selectedClass.spells.find((s) => s.id === val);
                  if (!spell) return;
                  setSelectedSpell({
                    ...spell,
                    levels: spell.levels || [],
                    descriptionOpen: false,
                  });
                  setParentId(val);
                }}
                value={{
                  label:
                    selectedClass.spells.find((s) => s.id === parentId)?.name ||
                    "New Spell",
                  value: parentId,
                }}
                layout="flex-col"
                widthOverride="w-32"
              />
              <InputUnq
                id={`char-input-spell-${selectedSpell.id}`}
                label="name"
                value={selectedSpell.name}
                onBlur={(e) => {
                  const target = e.target as HTMLInputElement;
                  const value = target.value;
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      name: value,
                    };
                  });
                }}
                layout="flex-col"
                widthOverride="w-32"
              />
              <SelectUnq
                id={`char-select-spec-${selectedSpell.id}`}
                label="spec"
                optionData={[
                  {
                    value: "common",
                    label: "common",
                  },
                  ...(selectedClass.specs
                    ? selectedClass.specs.map(
                        (c) =>
                          ({
                            value: c.name,
                            label: c.name,
                          } as HTMLOptionData<string>)
                      )
                    : []),
                ]}
                onChange={(e) => {
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      spec: e?.value || "0",
                    };
                  });
                }}
                value={{
                  label: selectedSpell.spec,
                  value: selectedSpell.spec,
                }}
                layout="flex-col"
                widthOverride="w-32"
                disabled={parentId !== "0" ? true : false}
              />
              <SelectUnq
                id={`char-select-type-${selectedSpell.id}`}
                label="Type"
                optionData={[
                  {
                    value: "damage",
                    label: "damage",
                  },
                  {
                    value: "heal",
                    label: "heal",
                  },
                  {
                    value: "utility",
                    label: "utility",
                  },
                ]}
                onChange={(e) => {
                  const val = e?.value as Character.Spell.TSpellType;
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      type: val || ("damage" as Character.Spell.TSpellType),
                    };
                  });
                }}
                value={{
                  label: selectedSpell.type,
                  value: selectedSpell.type,
                }}
                layout="flex-col"
                widthOverride="w-32"
                disabled={parentId !== "0" ? true : false}
              />
              <InputUnq
                id={`char-input-lvlReq-${selectedSpell.id}`}
                label="lvlReq"
                value={selectedSpell.lvlReq}
                onInput={(e) => {
                  if (!isMouseDownRef.current) return;
                  const target = e.target as HTMLInputElement;
                  const value = toInt(target.value);
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      lvlReq: value,
                    };
                  });
                }}
                onBlur={(e) => {
                  const target = e.target as HTMLInputElement;
                  const value = toInt(target.value);
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      lvlReq: value,
                    };
                  });
                }}
                type="number"
                layout="flex-col"
                widthOverride="w-20"
              />
              <InputUnq
                id={`char-input-resourceCost-${selectedSpell.id}`}
                label="resourceCost"
                value={selectedSpell.resourceCost}
                onInput={(e) => {
                  if (!isMouseDownRef.current) return;
                  const target = e.target as HTMLInputElement;
                  const value = toInt(target.value);
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      resourceCost: value,
                    };
                  });
                }}
                onBlur={(e) => {
                  const target = e.target as HTMLInputElement;
                  const value = toInt(target.value);
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      resourceCost: value,
                    };
                  });
                }}
                layout="flex-col"
                widthOverride="w-20"
              />
              <InputUnq
                id={`char-input-nrOfTurns-${selectedSpell.id}`}
                label="nrOfTurns"
                value={selectedSpell.nrOfTurns}
                onInput={(e) => {
                  if (!isMouseDownRef.current) return;
                  const target = e.target as HTMLInputElement;
                  const value = toInt(target.value);
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      nrOfTurns: value,
                    };
                  });
                }}
                onBlur={(e) => {
                  const target = e.target as HTMLInputElement;
                  const value = toInt(target.value);
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      nrOfTurns: value,
                    };
                  });
                }}
                type="number"
                layout="flex-col"
                widthOverride="w-20"
              />
              <InputUnq
                id={`char-input-nrOfTurnsToCast-${selectedSpell.id}`}
                label="nrOfTurnsToCast"
                value={selectedSpell.nrOfTurnsToCast}
                onInput={(e) => {
                  if (!isMouseDownRef.current) return;
                  const target = e.target as HTMLInputElement;
                  const value = toInt(target.value);
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      nrOfTurnsToCast: value,
                    };
                  });
                }}
                onBlur={(e) => {
                  const target = e.target as HTMLInputElement;
                  const value = toInt(target.value);
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      nrOfTurnsToCast: value,
                    };
                  });
                }}
                type="number"
                layout="flex-col"
                widthOverride="w-20"
              />
              <InputUnq
                id={`char-input-range-${selectedSpell.id}`}
                label="range"
                value={selectedSpell.range || 0}
                onInput={(e) => {
                  if (!isMouseDownRef.current) return;
                  const target = e.target as HTMLInputElement;
                  const value = toInt(target.value);
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      range: value,
                    };
                  });
                }}
                onBlur={(e) => {
                  const target = e.target as HTMLInputElement;
                  const value = toInt(target.value);
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      range: value,
                    };
                  });
                }}
                type="number"
                layout="flex-col"
                widthOverride="w-20"
              />
              <SelectUnq
                label="SpellClass"
                id={`char-select-class-${selectedSpell.id}`}
                optionData={[
                  ...Object.keys(Character.Spell.SPELL_CLASSES).map((c) => ({
                    value: c,
                    label: c,
                  })),
                ]}
                onChange={(e) => {
                  const val = e?.value as Character.Spell.SPELL_CLASSES;
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      class: val,
                    };
                  });
                }}
                value={{
                  label: selectedSpell.class,
                  value: selectedSpell.class,
                }}
                layout="flex-col"
                widthOverride="w-32"
              />
              <CheckBoxUnq
                id={`char-input-passive-${selectedSpell.id}`}
                label="passive"
                value={selectedSpell.passive}
                onChange={(e) => {
                  const target = e.target as HTMLInputElement;
                  const val = target.checked;
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      passive: val,
                    };
                  });
                }}
                layout="flex-col"
                widthOverride="w-20"
                disabled={parentId !== "0" ? true : false}
              />
              <TextAreaUnq
                id={`spell-list-description-${selectedSpell.id}`}
                label="description"
                value={selectedSpell.description || ""}
                onSave={(e) => {
                  const msg = e;
                  if (msg === selectedSpell.description) return;
                  setSelectedSpell((prev) => {
                    return {
                      ...prev,
                      description: msg,
                    };
                  });
                }}
                layout="flex-col"
                element="editor"
                className="grow"
              />
              <ButtonUnq
                id="char-add-spell"
                onClick={() => {
                  const prevSpells = selectedClass.spells || [];
                  if (parentId === "0") {
                    setSelectedClass((prev) => {
                      return {
                        ...prev,
                        spells: [
                          ...(prev.spells || []),
                          {
                            ...selectedSpell,
                            id: nanoid(),
                            levels: selectedSpell.levels || [],
                            parentId: "0",
                          },
                        ],
                      };
                    });
                  } else {
                    const index = prevSpells.findIndex(
                      (s) => s.id === parentId
                    );
                    if (index === -1) return;
                    const newSpells = [...prevSpells];
                    const newSelectedSpell = {
                      ...selectedSpell,
                      levels: undefined,
                      parentId: parentId,
                    } as Character.Spell.ISpellLevel;

                    newSelectedSpell.rank = newSpells[index].levels?.length + 1;
                    newSelectedSpell.id = nanoid();
                    newSpells[index] = {
                      ...newSpells[index],
                      levels: [...(newSpells[index].levels || []), newSelectedSpell],
                    };
                    setSelectedClass((prev) => {
                      return {
                        ...prev,
                        spells: newSpells,
                      };
                    });
                  }
                }}
              >
                Add
              </ButtonUnq>
            </FlexRow>
          </FlexCol>
        );
      };

      return (
        <FlexCol className="pb-10" id="spells">
          <label>Spells</label>
          <FlexCol>
            {selectedClass.spells &&
              selectedClass.spells.map((spell) => {
                return (
                  <FlexCol key={`spell-root-${spell.id}`}>
                    <SpellsElement
                      spell={spell}
                      specs={selectedClass.specs}
                      spellsRef={spellsRef}
                      interactionBtns={
                        <>
                          <ButtonUnq
                            id={`char-add-spell-${spell.id}`}
                            onClick={() => {
                              const index = selectedClass.spells.findIndex(
                                (s) => s.id === spell.id
                              );
                              if (index === -1) return;
                              const newSpellState = {
                                ...spell,
                                descriptionOpen: false,
                              };
                              setSelectedSpell(newSpellState);
                              setParentId(spell.id);
                            }}
                            className="w-12 h-8 mx-1"
                          >
                            Add
                          </ButtonUnq>

                          <ButtonUnq
                            id={`char-remove-spell-${spell.id}`}
                            onClick={() => {
                              if ("levels" in spell) {
                                const index = selectedClass.spells.findIndex(
                                  (s) => s.id === spell.id
                                );
                                if (index === -1) return;
                                setSelectedClass((prev) => {
                                  return {
                                    ...prev,
                                    spells: prev.spells.filter(
                                      (s) => s.id !== spell.id
                                    ),
                                  };
                                });
                              } else {
                                const itsStillASpell =
                                  spell as Character.Spell.ISpellLevel;
                                const index = selectedClass.spells.findIndex(
                                  (s) =>
                                    s.levels &&
                                    s.levels.find(
                                      (l) => l.id === itsStillASpell.id
                                    )
                                );
                                if (index === -1) return;
                                const newSpells = [...selectedClass.spells];
                                const newLevels = newSpells[
                                  index
                                ].levels.filter(
                                  (s) => s.id !== itsStillASpell.id
                                );
                                newSpells[index] = {
                                  ...newSpells[index],
                                  levels: newLevels,
                                };
                                setSelectedClass((prev) => {
                                  return {
                                    ...prev,
                                    spells: newSpells,
                                  };
                                });
                              }
                            }}
                            className="w-24 h-8"
                          >
                            Remove
                          </ButtonUnq>
                        </>
                      }
                    >
                      {spell.levels &&
                        spell.levels.map((level) => (
                          <SpellsElement
                            key={`spell-level-${spell.id}-${level.id}`}
                            spell={level}
                            specs={selectedClass.specs}
                            spellsRef={spellsRef}
                            parentId={spell.id}
                            interactionBtns={
                              <>
                                <div className="w-12 h-8 mx-1"></div>
                                <ButtonUnq
                                  id={`char-remove-spell-${level.id}`}
                                  onClick={() => {
                                    const index =
                                      selectedClass.spells.findIndex(
                                        (s) => s.id === spell.id
                                      );
                                    if (index === -1) return;
                                    const newSpells = [...selectedClass.spells];
                                    const newLevels = newSpells[
                                      index
                                    ].levels.filter((s) => s.id !== level.id);
                                    newSpells[index] = {
                                      ...newSpells[index],
                                      levels: newLevels,
                                    };
                                    setSelectedClass((prev) => {
                                      return {
                                        ...prev,
                                        spells: newSpells,
                                      };
                                    });
                                  }}
                                  className="w-24 h-8"
                                >
                                  Remove
                                </ButtonUnq>
                              </>
                            }
                          />
                        ))}
                    </SpellsElement>
                    <hr className="fancy" />
                  </FlexCol>
                );
              })}
            <NewSpell />
          </FlexCol>
        </FlexCol>
      );
    };

    const Resource = () => {
      return (
        <FlexCol className="grow">
          <FlexRow>
            <label htmlFor="">Név</label>
            <SelectUnq
              id={`char-select-resource-${selectedClass.id}`}
              label="Select a resource"
              optionData={Object.values(Character.RESOURCE_TYPE).map((c) => ({
                value: c,
                label: c,
              }))}
              onChange={(e) => {
                setSelectedClass((prev) => {
                  const newModifiers = {
                    ...prev.modifiers,
                  };
                  if (!newModifiers.resource) {
                    newModifiers.resource = {
                      name: e?.value || ("0" as Character.RESOURCE_TYPE),
                      max: 0,
                      current: 0,
                      regenPerRound: {
                        dice: Adventure.DICE.SIX,
                        nrOfDices: 1,
                        constant: 0,
                        nrOfRolls: 0,
                      },
                      lvlUp: {
                        dice: Adventure.DICE.SIX,
                        nrOfDices: 1,
                        constant: 0,
                        nrOfRolls: 0,
                      },
                    };
                  } else {
                    newModifiers.resource.name =
                      e?.value || ("0" as Character.RESOURCE_TYPE);
                  }
                  return {
                    ...prev,
                    modifiers: {
                      ...newModifiers,
                    },
                  };
                });
              }}
              value={{
                label:
                  selectedClass.modifiers.resource &&
                  (selectedClass.modifiers.resource.name ?? "Select a resource"),
                value:
                  selectedClass.modifiers.resource &&
                  selectedClass.modifiers.resource.name
                    ? selectedClass.modifiers.resource.name
                    : ("0" as Character.RESOURCE_TYPE),
              }}
            ></SelectUnq>
          </FlexRow>
          <FlexRow>
            <label>Max</label>
            <InputUnq
              id={`char-input-max-${selectedClass.id}`}
              label="Alap"
              value={selectedClass.modifiers.resource?.max || 0}
              onBlur={(e) => {
                const target = e.target as HTMLInputElement;
            const value = toInt(target.value);
                if (
                  !selectedClass.modifiers ||
                  !selectedClass.modifiers.resource
                ) {
                  target.value = "0";
                  return;
                }
                setSelectedClass((prev) => {
                  const newResource: Character.TResourceAbilities = {
                    name: prev.modifiers.resource
                      ? prev.modifiers.resource.name
                      : Character.RESOURCE_TYPE.MANA,
                    current: prev.modifiers.resource
                      ? prev.modifiers.resource.current
                      : 0,
                    regenPerRound: prev.modifiers.resource
                      ? prev.modifiers.resource.regenPerRound
                      : {
                          dice: Adventure.DICE.SIX,
                          nrOfDices: 1,
                          constant: 0,
                          nrOfRolls: 0,
                        },
                    lvlUp: prev.modifiers.resource
                      ? prev.modifiers.resource.lvlUp
                      : {
                          dice: Adventure.DICE.SIX,
                          nrOfDices: 1,
                          constant: 0,
                          nrOfRolls: 0,
                        },
                    max: value,
                  };
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      resource: {
                        ...prev.modifiers.resource,
                        ...newResource,
                      },
                    },
                  };
                });
              }}
            />
          </FlexRow>
          <FlexRow>
            <label>RegenPerRound</label>
            <RollItem
              id={`char-roll-regen-${selectedClass.id}`}
              addRoll={(roll) => {
                setSelectedClass((prev) => {
                  const newResource: Character.TResourceAbilities = {
                    name: prev.modifiers.resource
                      ? prev.modifiers.resource.name
                      : Character.RESOURCE_TYPE.MANA,
                    current: prev.modifiers.resource
                      ? prev.modifiers.resource.current
                      : 0,
                    regenPerRound: roll,
                    lvlUp: prev.modifiers.resource
                      ? prev.modifiers.resource.lvlUp
                      : {
                          dice: Adventure.DICE.SIX,
                          nrOfDices: 1,
                          constant: 0,
                          nrOfRolls: 0,
                        },
                    max: prev.modifiers.resource
                      ? prev.modifiers.resource.max
                      : 0,
                  };
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      resource: {
                        ...prev.modifiers.resource,
                        ...newResource,
                      },
                    },
                  };
                });
              }}
              buttonText="Set"
              hideButton
              initialValues={
                selectedClass.modifiers?.resource?.regenPerRound || {
                  nrOfRolls: 0,
                  nrOfDices: 1,
                  dice: Adventure.DICE.SIX,
                  constant: 0,
                }
              }
            />
          </FlexRow>
          <FlexRow>
            <label>LvlUp</label>
            <RollItem
              id={`char-roll-lvlUp-${selectedClass.id}`}
              addRoll={(roll) => {
                setSelectedClass((prev) => {
                  const newResource: Character.TResourceAbilities = {
                    name: prev.modifiers.resource
                      ? prev.modifiers.resource.name
                      : Character.RESOURCE_TYPE.MANA,
                    current: prev.modifiers.resource
                      ? prev.modifiers.resource.current
                      : 0,
                    regenPerRound: prev.modifiers.resource
                      ? prev.modifiers.resource.regenPerRound
                      : {
                          dice: Adventure.DICE.SIX,
                          nrOfDices: 1,
                          constant: 0,
                          nrOfRolls: 0,
                        },
                    lvlUp: roll,
                    max: prev.modifiers.resource
                      ? prev.modifiers.resource.max
                      : 0,
                  };
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      resource: {
                        ...prev.modifiers.resource,
                        ...newResource,
                      },
                    },
                  };
                });
              }}
              buttonText="Set"
              hideButton
              initialValues={
                selectedClass.modifiers?.resource.lvlUp || {
                  nrOfRolls: 0,
                  nrOfDices: 1,
                  dice: Adventure.DICE.SIX,
                  constant: 0,
                }
              }
            />
          </FlexRow>
        </FlexCol>
      );
    };

    return (
      <RndContainer
        id={`char-${selectedClass.id}`}
        aditionalIcons={null}
        close={handleClose}
        label={`char_${"admin1"}`}
        className="123asd"
      >
        <FlexCol className="grow w-full shrink-0">
          <InputUnq
            id={`char-name-${selectedClass.id}`}
            label="Name"
            value={selectedClass.name}
            disabled={true}
          />
          <SelectUnq
            id={`char-select-mainclass-${selectedClass.id}`}
            label="Select a main class"
            optionData={Object.values(Character.MAIN_CLASSES).map((c) => ({
              value: c,
              label: c,
            }))}
            onChange={(e) => {
              setSelectedClass((prev) => {
                return {
                  ...prev,
                  mainClass: e?.value || ("0" as Character.MAIN_CLASSES),
                };
              });
            }}
            value={{
              label: selectedClass.mainClass || "Select a class",
              value: selectedClass.mainClass || ("0" as Character.MAIN_CLASSES),
            }}
          ></SelectUnq>
          <hr className="fancy" />
          <Resource />
          <hr className="fancy" />
          <InputUnq
            id={`char-input-hp-${selectedClass.id}`}
            label="hp"
            value={selectedClass.modifiers.hp}
            onBlur={(e) => {
              const target = e.target as HTMLInputElement;
            const value = toInt(target.value);
              setSelectedClass((prev) => {
                return {
                  ...prev,
                  modifiers: {
                    ...prev.modifiers,
                    hp: value,
                  },
                };
              });
            }}
          />
          <FlexRow>
            <label className={`grow`}>HpPerLevel</label>
            <RollItem
              id={`char-roll-hp-${selectedClass.id}`}
              addRoll={(roll) => {
                setSelectedClass((prev) => {
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      hpLvlScaling: roll,
                    },
                  };
                });
              }}
              buttonText="Set"
              initialValues={
                selectedClass.modifiers?.hpLvlScaling
                  ? {
                      nrOfRolls:
                        selectedClass.modifiers?.hpLvlScaling.nrOfRolls || 1,
                      nrOfDices:
                        selectedClass.modifiers?.hpLvlScaling.nrOfDices || 1,
                      dice: selectedClass.modifiers?.hpLvlScaling.dice || 6,
                      constant:
                        selectedClass.modifiers?.hpLvlScaling.constant || 0,
                    }
                  : {
                      nrOfRolls: 1,
                      nrOfDices: 1,
                      dice: 6,
                      constant: 0,
                    }
              }
            />
          </FlexRow>
          <InputUnq
            id={`char-input-ep-${selectedClass.id}`}
            label="ep"
            value={selectedClass.modifiers.ep}
            onBlur={(e) => {
              const target = e.target as HTMLInputElement;
              const value = target.value;
              setSelectedClass((prev) => {
                return {
                  ...prev,
                  modifiers: {
                    ...prev.modifiers,
                        ep: toInt(value, prev.modifiers.ep),
                  },
                };
              });
            }}
          />
          <hr className="fancy" />
          <FlexCol className="grow">
            <label>HM</label>
            <InputUnq
              id={`char-input-atk-${selectedClass.id}`}
              label={Character.HM.ATK}
              value={selectedClass.modifiers.hm.ATK}
              onBlur={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value;
                setSelectedClass((prev) => {
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      hm: {
                        ...prev.modifiers.hm,
                        ATK: toInt(value, prev.modifiers.hm.ATK),
                      },
                    },
                  };
                });
              }}
            />
            <InputUnq
              id={`char-input-def-${selectedClass.id}`}
              label={Character.HM.DEF}
              value={selectedClass.modifiers.hm.DEF}
              onBlur={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value;
                setSelectedClass((prev) => {
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      hm: {
                        ...prev.modifiers.hm,
                        DEF: toInt(value, prev.modifiers.hm.DEF),
                      },
                    },
                  };
                });
              }}
            />
            <InputUnq
              id={`char-input-ini-${selectedClass.id}`}
              label={Character.HM.INI}
              value={selectedClass?.modifiers.hm.INI || ""}
              onBlur={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value;
                setSelectedClass((prev) => {
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      hm: {
                        ...prev.modifiers.hm,
                        INI: toInt(value, prev.modifiers.hm.INI),
                      },
                    },
                  };
                });
              }}
            />
            <InputUnq
              id={`char-input-aim-${selectedClass.id}`}
              label={Character.HM.AIM}
              value={selectedClass?.modifiers.hm.AIM || 0}
              onBlur={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value;
                setSelectedClass((prev) => {
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      hm: {
                        ...prev.modifiers.hm,
                        AIM: toInt(value, prev.modifiers.hm.AIM),
                      },
                    },
                  };
                });
              }}
              type="number"
            />
            <InputUnq
              id={`char-input-startinghp-${selectedClass.id}`}
              label="startingHmPoints"
              value={selectedClass.modifiers.hmPlus.initial}
              onBlur={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value;
                setSelectedClass((prev) => {
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      hmPlus: {
                        ...prev.modifiers.hmPlus,
                        initial: toInt(value, prev.modifiers.hmPlus.initial),
                      },
                    },
                  };
                });
              }}
              type="number"
            />
            <InputUnq
              id={`char-input-hmPerLvl-${selectedClass.id}`}
              label="hmPointsPerLevel"
              value={selectedClass.modifiers.hmPlus.perLvl}
              onBlur={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value;
                setSelectedClass((prev) => {
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      hmPlus: {
                        ...prev.modifiers.hmPlus,
                        perLvl: toInt(value, prev.modifiers.hmPlus.perLvl),
                      },
                    },
                  };
                });
              }}
            />
            <InputUnq
              id={`char-input-secondary-initial-${selectedClass.id}`}
              label="initialSecondarySkillPoints"
              value={selectedClass.modifiers.initialSecondarySkillPoints}
              onBlur={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value;
                setSelectedClass((prev) => {
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      initialSecondarySkillPoints: Math.max(
                        0,
                        toInt(value, prev.modifiers.initialSecondarySkillPoints)
                      ),
                    },
                  };
                });
              }}
            />
            <InputUnq
              id={`char-input-secondary-per-lvl-${selectedClass.id}`}
              label="secondarySkillPointsPerLevel"
              value={selectedClass.modifiers.secondarySkillPointsPerLvl}
              onBlur={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value;
                setSelectedClass((prev) => {
                  return {
                    ...prev,
                    modifiers: {
                      ...prev.modifiers,
                      secondarySkillPointsPerLvl: Math.max(
                        0,
                        toInt(value, prev.modifiers.secondarySkillPointsPerLvl)
                      ),
                    },
                  };
                });
              }}
            />
          </FlexCol>
          <hr className="fancy" />
          {Object.values(Character.PRIMARY_STATS).map((stat) => {
            return (
              <FlexRow key={`primary-stat-${selectedClass.id}-${stat}`}>
                <label className={`grow p-1`}>{stat}</label>
                <RollItem
                  id={`char-roll-${stat}-${selectedClass.id}`}
                  addRoll={(roll) => {
                    setSelectedClass((prev) => {
                      const existingIndex = prev.modifiers.primaryStats.findIndex(
                        (primaryStat) => primaryStat.name === stat
                      );
                      const primaryStats =
                        existingIndex === -1
                          ? [
                              ...prev.modifiers.primaryStats,
                              {
                                name: stat,
                                roll,
                              },
                            ]
                          : prev.modifiers.primaryStats.map((primaryStat, index) =>
                              index === existingIndex
                                ? {
                                    ...primaryStat,
                                    roll,
                                  }
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
                  buttonText="Set"
                  initialValues={{
                    nrOfRolls:
                      selectedClass.modifiers.primaryStats.find(
                        (s) => s.name === stat
                      )?.roll?.nrOfRolls || 1,
                    nrOfDices:
                      selectedClass.modifiers.primaryStats.find(
                        (s) => s.name === stat
                      )?.roll?.nrOfDices || 1,
                    dice: (selectedClass.modifiers.primaryStats.find(
                      (s) => s.name === stat
                    )?.roll?.dice || 6) as Adventure.DICE,
                    constant:
                      selectedClass.modifiers.primaryStats.find(
                        (s) => s.name === stat
                      )?.roll?.constant || 0,
                  }}
                />
              </FlexRow>
            );
          })}
          <hr className="fancy" />
          <SecondaryStatScalings />

          <hr className="fancy" />
          <FlexCol className="grow">
            <label
              className="cursor-pointer select-none"
              onClick={() => setshowSecondaryStats((prev) => !prev)}
            >
              Secondary Stats {showSecondaryStats ? "-" : "+"}
            </label>
            {showSecondaryStats && (
              <SecondaryStatLevelsElement
                statArray={secondaryStatLevels}
                secondaryStatRefs={secondaryStatRefs}
              />
            )}
          </FlexCol>
          <hr className="fancy" />
          <FlexCol className="grow">
            <label
              onClick={() => {
                if (!specsMounted) setSpecsMounted(true);
                setShowSpecs((prev) => !prev);
              }}
            >
              Specs {showSpecs ? "-" : "+"}
            </label>
            {specsMounted && (
              <div className={showSpecs ? "" : "hidden"}>
                <SpecsSection
                  selectedClass={selectedClass}
                  setSelectedClass={setSelectedClass}
                />
              </div>
            )}
          </FlexCol>
          <hr className="fancy" />
          <FlexCol className="grow">
            <label
              onClick={() => {
                if (!spellsMounted) setSpellsMounted(true);
                setShowSpells((prev) => !prev);
              }}
            >
              Spells {showSpells ? "-" : "+"}
            </label>
            {spellsMounted && (
              <div className={showSpells ? "" : "hidden"}>
                <Spells />
              </div>
            )}
          </FlexCol>
          <hr className="fancy" />
          <FlexCol className={`basis-1`}>
            <TextAreaUnq
              id="char-input-description"
              label="Class description"
              value={selectedClass.description || ""}
              element="editor"
              onSave={(e) => {
                const msg = e;
                if (msg === selectedClass.description) return;
                setSelectedClass((prev) => {
                  return {
                    ...prev,
                    description: msg,
                  };
                });
              }}
            />
          </FlexCol>
        </FlexCol>
      </RndContainer>
    );
};

export const AdminClassDescriptorWindow = ({
  close,
  classId,
}: {
  close: () => void;
  classId: string;
}) => {
  const { setError } = useError();
  const [requestClass] = useRequest(Application.REQUEST_CONTROLLER.CHARACTERS);
  const [classData, setClassData] = useState<TClassWithMeta | null>(null);

  useEffect(() => {
    if (!classId) return;
    requestClass<TClassWithMeta>({
      endPoint: "/getClass",
      body: { classId },
    })
      .then((response) => setClassData(response.data))
      .catch((error) => {
        setError("Failed to fetch class: " + error);
        debugLog("Failed to fetch class:", error);
      });
  }, [classId]);

  if (!classData) {
    return (
      <RndContainer
        id={`Class-${classId || "loading"}`}
        aditionalIcons={null}
        close={close}
        label="Class"
      >
        <p className="p-2 text-sm opacity-70">Loading class...</p>
      </RndContainer>
    );
  }

  return <ClassHandlingWindow close={close} selectedClassProps={classData} />;
};

function ClassHandling() {
  const { classes: classList } = useDataContext();
  const windowsLayer = useWindowsLayer();

  const openClassWindow = (classId: string) => {
    const windowName = `Class-${classId}`;
    windowsLayer.addWindow(defineWindowRegistration({
      id: windowName,
      kind: "admin-class-editor",
      title: "Class",
      icon: "CL",
      iconElement: <div>Class</div>,
      params: { classId },
    }));
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 w-full min-w-0 gap-2 overflow-visible">
      <FlexCol className="w-full min-w-0 overflow-visible">
        <SelectUnq
          id="char-select-class"
          label="Classes"
          optionData={
            classList
              ? classList.map((c) => ({ value: c.id, label: c.name }))
              : []
          }
          onChange={(e) => {
            if (!e?.value) return;
            openClassWindow(e.value);
          }}
          value={{
            label: "Select a class",
            value: "0" as Character.CLASSES,
          }}
        ></SelectUnq>
      </FlexCol>
      <DescentHandling />
    </div>
  );
}

export default ClassHandling;








