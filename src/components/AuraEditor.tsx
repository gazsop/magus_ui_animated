import { Character } from "@shared/contracts";
import { FlexCol, FlexRow } from "@components/Flex";

export type TAuraEditorDraft = {
  name: string;
  description: string;
  color: string;
  effect: Character.Spell.TSpellEffect[];
  modifiers: Character.TAuraModifier[];
  applyWhen?: Character.Item.TItemAuraApplyWhen;
};

const DEFAULT_PRIMARY =
  Object.values(Character.PRIMARY_STATS)[0] || Character.PRIMARY_STATS.STR;
const DEFAULT_EFFECT_TYPE =
  Object.values(Character.SPELL_TYPE)[0] || Character.SPELL_TYPE.AURA;

const toModifierNumber = (
  value: number | Character.TValueModifier | undefined
): number => (typeof value === "number" ? value : Number(value?.flat || 0));

export const createEmptyAuraEditorDraft = (
  overrides: Partial<TAuraEditorDraft> = {}
): TAuraEditorDraft => ({
  name: "",
  description: "",
  color: "#888888",
  effect: [{ type: DEFAULT_EFFECT_TYPE, length: 1 }],
  modifiers: [],
  ...overrides,
});

const updateModifierGroup = (
  draft: TAuraEditorDraft,
  groupIndex: number,
  nextGroup: Character.TAuraModifier
): TAuraEditorDraft => ({
  ...draft,
  modifiers: draft.modifiers.map((group, index) => (index === groupIndex ? nextGroup : group)),
});

export default function AuraEditor({
  draft,
  onChange,
  showName = true,
  showColor = true,
}: {
  draft: TAuraEditorDraft;
  onChange: (next: TAuraEditorDraft) => void;
  showName?: boolean;
  showColor?: boolean;
}) {
  const setDraft = (patch: Partial<TAuraEditorDraft>) => onChange({ ...draft, ...patch });
  const addEffect = () =>
    setDraft({
      effect: [...draft.effect, { type: DEFAULT_EFFECT_TYPE, length: 1 }],
    });
  const updateEffect = (
    index: number,
    patch: Partial<Character.Spell.TSpellEffect>
  ) =>
    setDraft({
      effect: draft.effect.map((entry, effectIndex) =>
        effectIndex === index ? { ...entry, ...patch } : entry
      ),
    });
  const removeEffect = (index: number) =>
    setDraft({ effect: draft.effect.filter((_, effectIndex) => effectIndex !== index) });

  const addModifierGroup = () =>
    setDraft({ modifiers: [...draft.modifiers, {}] });
  const removeModifierGroup = (groupIndex: number) =>
    setDraft({
      modifiers: draft.modifiers.filter((_, index) => index !== groupIndex),
    });

  const addHm = (groupIndex: number) =>
    onChange(
      updateModifierGroup(draft, groupIndex, {
        ...draft.modifiers[groupIndex],
        hm: draft.modifiers[groupIndex]?.hm || { ATK: 0, DEF: 0, AIM: 0, INI: 0 },
      })
    );
  const addHealth = (groupIndex: number) =>
    onChange(
      updateModifierGroup(draft, groupIndex, {
        ...draft.modifiers[groupIndex],
        resource: {
          ...draft.modifiers[groupIndex]?.resource,
          health:
            draft.modifiers[groupIndex]?.resource?.health || {
              maxHp: 0,
              currentHp: 0,
              maxEp: 0,
              currentEp: 0,
            },
        },
      })
    );
  const addAbility = (groupIndex: number) =>
    onChange(
      updateModifierGroup(draft, groupIndex, {
        ...draft.modifiers[groupIndex],
        resource: {
          ...draft.modifiers[groupIndex]?.resource,
          abilities:
            draft.modifiers[groupIndex]?.resource?.abilities || {
              max: 0,
              current: 0,
            },
        },
      })
    );
  const addPrimary = (groupIndex: number) =>
    onChange(
      updateModifierGroup(draft, groupIndex, {
        ...draft.modifiers[groupIndex],
        primaryStats: [
          ...(draft.modifiers[groupIndex]?.primaryStats || []),
          { name: DEFAULT_PRIMARY, flat: 0, percent: 0 },
        ],
      })
    );
  const addSecondary = (groupIndex: number) =>
    onChange(
      updateModifierGroup(draft, groupIndex, {
        ...draft.modifiers[groupIndex],
        secondaryStats: [
          ...(draft.modifiers[groupIndex]?.secondaryStats || []),
          { id: "", flat: 0, percent: 0 },
        ],
      })
    );

  return (
    <FlexCol className="w-full min-w-0 gap-2">
      {showName ? (
        <input
          className="w-full px-2 py-1 rounded"
          placeholder="Aura neve"
          value={draft.name}
          onInput={(e) => setDraft({ name: (e.currentTarget as HTMLInputElement).value })}
        />
      ) : null}
      <textarea
        className="w-full px-2 py-1 rounded min-h-[72px]"
        placeholder="Aura leírása"
        value={draft.description}
        onInput={(e) => setDraft({ description: (e.currentTarget as HTMLTextAreaElement).value })}
      />
      {showColor ? (
        <FlexRow className="items-center gap-2">
          <span className="text-xs">Szín</span>
          <input
            type="color"
            value={draft.color}
            onInput={(e) => setDraft({ color: (e.currentTarget as HTMLInputElement).value })}
          />
        </FlexRow>
      ) : null}

      <FlexCol className="gap-1 min-w-0">
        <FlexRow className="items-center justify-between gap-2 flex-wrap">
          <p className="font-semibold text-sm">Hatások</p>
          <button type="button" className="fancy-container px-2 py-0.5" onClick={addEffect}>
            + Effect
          </button>
        </FlexRow>
        {draft.effect.length < 1 ? <p className="text-xs">Nincs hatás.</p> : null}
        {draft.effect.map((effect, index) => (
          <FlexRow key={`effect-${index}`} className="gap-2 items-center flex-wrap min-w-0">
            <select
              className="px-2 py-1 rounded text-black w-full sm:w-auto sm:min-w-[160px]"
              value={effect.type}
              onChange={(e) =>
                updateEffect(index, {
                  type: (e.currentTarget as HTMLSelectElement).value as Character.SPELL_TYPE,
                })
              }
            >
              {Object.values(Character.SPELL_TYPE).map((type) => (
                <option key={`effect-type-${type}`} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              className="px-2 py-1 rounded w-full sm:w-24"
              value={effect.length}
              onInput={(e) =>
                updateEffect(index, {
                  length: Math.max(0, Number((e.currentTarget as HTMLInputElement).value || 0)),
                })
              }
            />
            <button
              type="button"
              className="fancy-container px-2 py-0.5"
              onClick={() => removeEffect(index)}
            >
              Remove
            </button>
          </FlexRow>
        ))}
      </FlexCol>

      <FlexCol className="gap-2 min-w-0">
        <FlexRow className="items-center justify-between gap-2 flex-wrap">
          <p className="font-semibold text-sm">Módosítócsoportok</p>
          <button type="button" className="fancy-container px-2 py-0.5" onClick={addModifierGroup}>
            + Modifier Group
          </button>
        </FlexRow>
        {draft.modifiers.length < 1 ? <p className="text-xs">Nincs módosító.</p> : null}
        {draft.modifiers.map((group, groupIndex) => (
          <FlexCol key={`modifier-group-${groupIndex}`} className="border border-slate-500 rounded p-2 gap-2 min-w-0">
            <FlexRow className="items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold">Group {groupIndex + 1}</p>
              <button
                type="button"
                className="fancy-container px-2 py-0.5"
                onClick={() => removeModifierGroup(groupIndex)}
              >
                Remove Group
              </button>
            </FlexRow>

            <FlexRow className="gap-1 flex-wrap">
              <button type="button" className="fancy-container px-2 py-0.5" onClick={() => addHm(groupIndex)}>
                + HM
              </button>
              <button type="button" className="fancy-container px-2 py-0.5" onClick={() => addPrimary(groupIndex)}>
                + Primary
              </button>
              <button type="button" className="fancy-container px-2 py-0.5" onClick={() => addSecondary(groupIndex)}>
                + Secondary
              </button>
              <button type="button" className="fancy-container px-2 py-0.5" onClick={() => addHealth(groupIndex)}>
                + Health
              </button>
              <button type="button" className="fancy-container px-2 py-0.5" onClick={() => addAbility(groupIndex)}>
                + Ability
              </button>
            </FlexRow>

            {group.hm ? (
              <FlexRow className="gap-1 flex-wrap">
                {(["ATK", "DEF", "AIM", "INI"] as Array<keyof Character.THm>).map((key) => (
                  <label key={`hm-${groupIndex}-${key}`} className="text-xs">
                    {key}
                    <input
                      type="number"
                      className="px-2 py-1 rounded w-24 ml-1"
                      value={toModifierNumber(group.hm?.[key])}
                      onInput={(e) =>
                        onChange(
                          updateModifierGroup(draft, groupIndex, {
                            ...group,
                            hm: {
                              ...(group.hm || {}),
                              [key]: Number((e.currentTarget as HTMLInputElement).value || 0),
                            },
                          })
                        )
                      }
                    />
                  </label>
                ))}
              </FlexRow>
            ) : null}

            {(group.primaryStats || []).map((entry, index) => (
              <FlexRow key={`primary-${groupIndex}-${index}`} className="gap-1 flex-wrap items-center">
                <select
                  className="px-2 py-1 rounded text-black"
                  value={entry.name}
                  onChange={(e) =>
                    onChange(
                      updateModifierGroup(draft, groupIndex, {
                        ...group,
                        primaryStats: (group.primaryStats || []).map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, name: (e.currentTarget as HTMLSelectElement).value as Character.PRIMARY_STATS }
                            : current
                        ),
                      })
                    )
                  }
                >
                  {Object.values(Character.PRIMARY_STATS).map((stat) => (
                    <option key={`primary-stat-${stat}`} value={stat}>
                      {stat}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="px-2 py-1 rounded w-20"
                  value={entry.flat || 0}
                  onInput={(e) =>
                    onChange(
                      updateModifierGroup(draft, groupIndex, {
                        ...group,
                        primaryStats: (group.primaryStats || []).map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, flat: Number((e.currentTarget as HTMLInputElement).value || 0) }
                            : current
                        ),
                      })
                    )
                  }
                />
                <input
                  type="number"
                  className="px-2 py-1 rounded w-20"
                  value={entry.percent || 0}
                  onInput={(e) =>
                    onChange(
                      updateModifierGroup(draft, groupIndex, {
                        ...group,
                        primaryStats: (group.primaryStats || []).map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, percent: Number((e.currentTarget as HTMLInputElement).value || 0) }
                            : current
                        ),
                      })
                    )
                  }
                />
              </FlexRow>
            ))}

            {(group.secondaryStats || []).map((entry, index) => (
              <FlexRow key={`secondary-${groupIndex}-${index}`} className="gap-1 flex-wrap items-center">
                <input
                  className="px-2 py-1 rounded w-full sm:w-auto"
                  placeholder="Másodlagos ID"
                  value={entry.id}
                  onInput={(e) =>
                    onChange(
                      updateModifierGroup(draft, groupIndex, {
                        ...group,
                        secondaryStats: (group.secondaryStats || []).map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, id: (e.currentTarget as HTMLInputElement).value }
                            : current
                        ),
                      })
                    )
                  }
                />
                <input
                  type="number"
                  className="px-2 py-1 rounded w-20"
                  value={entry.flat || 0}
                  onInput={(e) =>
                    onChange(
                      updateModifierGroup(draft, groupIndex, {
                        ...group,
                        secondaryStats: (group.secondaryStats || []).map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, flat: Number((e.currentTarget as HTMLInputElement).value || 0) }
                            : current
                        ),
                      })
                    )
                  }
                />
                <input
                  type="number"
                  className="px-2 py-1 rounded w-20"
                  value={entry.percent || 0}
                  onInput={(e) =>
                    onChange(
                      updateModifierGroup(draft, groupIndex, {
                        ...group,
                        secondaryStats: (group.secondaryStats || []).map((current, currentIndex) =>
                          currentIndex === index
                            ? { ...current, percent: Number((e.currentTarget as HTMLInputElement).value || 0) }
                            : current
                        ),
                      })
                    )
                  }
                />
              </FlexRow>
            ))}

            {group.resource?.health ? (
              <FlexRow className="gap-1 flex-wrap">
                {(["maxHp", "currentHp", "maxEp", "currentEp"] as const).map((key) => (
                  <label key={`health-${groupIndex}-${key}`} className="text-xs">
                    {key}
                    <input
                      type="number"
                      className="px-2 py-1 rounded w-24 ml-1"
                      value={toModifierNumber(group.resource?.health?.[key])}
                      onInput={(e) =>
                        onChange(
                          updateModifierGroup(draft, groupIndex, {
                            ...group,
                            resource: {
                              ...group.resource,
                              health: {
                                ...(group.resource?.health || {}),
                                [key]: Number((e.currentTarget as HTMLInputElement).value || 0),
                              },
                            },
                          })
                        )
                      }
                    />
                  </label>
                ))}
              </FlexRow>
            ) : null}

            {group.resource?.abilities ? (
              <FlexRow className="gap-1 flex-wrap">
                {(["max", "current"] as const).map((key) => (
                  <label key={`ability-${groupIndex}-${key}`} className="text-xs">
                    {key}
                    <input
                      type="number"
                      className="px-2 py-1 rounded w-24 ml-1"
                      value={toModifierNumber(group.resource?.abilities?.[key])}
                      onInput={(e) =>
                        onChange(
                          updateModifierGroup(draft, groupIndex, {
                            ...group,
                            resource: {
                              ...group.resource,
                              abilities: {
                                ...(group.resource?.abilities || {}),
                                [key]: Number((e.currentTarget as HTMLInputElement).value || 0),
                              },
                            },
                          })
                        )
                      }
                    />
                  </label>
                ))}
              </FlexRow>
            ) : null}
          </FlexCol>
        ))}
      </FlexCol>
    </FlexCol>
  );
}
