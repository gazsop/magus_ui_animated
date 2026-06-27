import { Character } from "@shared/contracts";
import {
  createSpellUpgrade,
  formatSpellCost,
  formatSpellDuration,
  SPELL_MILESTONE_LEVELS,
  SPELL_SCHOOLS,
} from "@shared/game";
import { InputUnq, SelectUnq, TextAreaUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";
import EditIcon from "@components/icons/general/EditIcon";
import { memo, useEffect, useMemo, useState } from "preact/compat";
import { ComponentChildren } from "preact";
import { MutableRef } from "preact/hooks";
import { MultiValue } from "react-select";
import { toInt } from "@utils/common";

const sanitizeHtml = (rawHtml: string) => {
  if (!rawHtml) return "";
  const template = document.createElement("template");
  template.innerHTML = rawHtml;

  const blockedTags = ["script", "style", "iframe", "object", "embed", "link", "meta"];
  blockedTags.forEach((tag) => {
    template.content.querySelectorAll(tag).forEach((el) => el.remove());
  });

  template.content.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value.toLowerCase();
      if (attrName.startsWith("on")) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((attrName === "href" || attrName === "src") && attrValue.includes("javascript:")) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return template.innerHTML;
};

const normalizeUpgrades = (
  upgrades?: Character.Spell.TSpellUpgrade[]
): Character.Spell.TSpellUpgrade[] =>
  SPELL_MILESTONE_LEVELS.map((level) => {
    const existing = upgrades?.find((upgrade) => Number(upgrade.level) === level);
    return createSpellUpgrade(level, existing?.raw || "-");
  });

const DescriptionElement = memo(function ({
  spell,
  onSave,
}: {
  spell: Character.Spell.TSpellElements;
  onSave: (e: string) => void;
}) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const safeDescription = useMemo(() => sanitizeHtml(spell.description || ""), [spell.description]);
  return (
    <FlexCol>
      <FlexRow>
        <EditIcon
          className="h-4 m-1 w-6 cursor-pointer"
          onClick={() => {
            setDescriptionOpen((prev) => !prev);
          }}
        />
        <label htmlFor="">leírás</label>
      </FlexRow>

      {descriptionOpen ? (
        <TextAreaUnq
          id={`spell-list-description-${spell.id}`}
          value={spell.description}
          element="editor"
          className="grow"
          onSave={(e) => {
            if (e === spell.description) return;
            onSave(e);
          }}
        />
      ) : (
        <div
          dangerouslySetInnerHTML={{
            __html: safeDescription,
          }}
          className="w-64"
        ></div>
      )}
    </FlexCol>
  );
});

export const SpellsElement = memo(function ({
  spell,
  specs,
  spellsRef,
  children,
  interactionBtns,
}: {
  spell: Character.Spell.TSpellElements;
  specs: {
    name: string;
    description: string;
  }[];
  spellsRef: MutableRef<{
    [key in string]: Character.Spell.TSpellElements;
  }>;
  children?: ComponentChildren;
  interactionBtns: ComponentChildren;
}) {
  const [spellState, setSpellState] = useState<Character.Spell.TSpellElements>({
    ...spell,
    upgrades: normalizeUpgrades(spell.upgrades),
  });

  useEffect(() => {
    spellsRef.current[spellState.id] = spellState;
    return () => {
      delete spellsRef.current[spellState.id];
    };
  }, [spellState, spellsRef]);

  const schoolOptions = SPELL_SCHOOLS.map((school) => ({
    value: school,
    label: school,
  }));

  const setUpgradeRaw = (level: Character.Spell.TSpellMilestoneLevel, raw: string) => {
    setSpellState((prev) => ({
      ...prev,
      upgrades: normalizeUpgrades(prev.upgrades).map((upgrade) =>
        upgrade.level === level ? createSpellUpgrade(level, raw) : upgrade
      ),
    }));
  };

  return (
    <FlexCol className="fancy-container my-2 gap-2">
      <FlexRow className="items-start">
        <InputUnq
          id={`char-input-spell-${spellState.id}`}
          label="név"
          value={spellState.name}
          layout="flex-col"
          widthOverride="w-36"
          onBlur={(e) => {
            const target = e.target as HTMLInputElement;
            setSpellState((prev) => ({ ...prev, name: target.value }));
          }}
          className="grow w-36"
        />
        <SelectUnq
          id={`char-select-spec-${spellState.id}`}
          label="szakosodás"
          optionData={[
            { value: "common", label: "common" },
            ...specs.map((c) => ({ value: c.name, label: c.name })),
          ]}
          onChange={(e) => {
            const val = e?.value || "common";
            setSpellState((prev) => ({ ...prev, spec: val }));
          }}
          value={{
            label: spellState.spec,
            value: spellState.spec,
          }}
          layout="flex-col"
          widthOverride="w-28"
        />
        <SelectUnq
          id={`char-select-type-${spellState.id}`}
          label="típus"
          optionData={[
            { value: "damage", label: "damage" },
            { value: "heal", label: "heal" },
            { value: "utility", label: "utility" },
          ]}
          value={{ label: spellState.type, value: spellState.type }}
          onChange={(e) => {
            const val = e?.value as Character.Spell.TSpellType;
            setSpellState((prev) => ({ ...prev, type: val || "damage" }));
          }}
          layout="flex-col"
          widthOverride="w-24"
        />
        <SelectUnq
          id={`char-select-activation-${spellState.id}`}
          label="aktiválás"
          optionData={[
            { value: "active", label: "active" },
            { value: "passive", label: "passive" },
            { value: "active-passive", label: "active-passive" },
          ]}
          value={{ label: spellState.activation, value: spellState.activation }}
          onChange={(e) => {
            const val = e?.value as Character.Spell.TSpellActivation;
            setSpellState((prev) => ({ ...prev, activation: val || "active" }));
          }}
          layout="flex-col"
          widthOverride="w-32"
        />
        <InputUnq
          id={`char-input-lvlReq-${spellState.id}`}
          label="szintkövetelmény"
          value={spellState.lvlReq}
          type="number"
          layout="flex-col"
          widthOverride="w-24"
          onBlur={(e) => {
            const target = e.target as HTMLInputElement;
            const value = toInt(target.value);
            setSpellState((prev) => ({ ...prev, lvlReq: value }));
          }}
        />
        <SelectUnq<
          Character.Spell.TSpellSchool,
          MultiValue<{ value: Character.Spell.TSpellSchool; label: string }>
        >
          id={`char-select-schools-${spellState.id}`}
          label="iskolák"
          optionData={schoolOptions}
          value={(spellState.schools || []).map((school) => ({ value: school, label: school }))}
          onChange={(e) => {
            setSpellState((prev) => ({
              ...prev,
              schools: [...e.map((entry) => entry.value)],
            }));
          }}
          layout="flex-col"
          widthOverride="w-48"
          multiple
        />
        <InputUnq
          id={`char-input-choice-${spellState.id}`}
          label="választás"
          value={spellState.choice?.label || ""}
          layout="flex-col"
          widthOverride="w-36"
          onBlur={(e) => {
            const value = (e.target as HTMLInputElement).value.trim();
            setSpellState((prev) => ({
              ...prev,
              choice: value
                ? {
                    groupId: prev.choice?.groupId || `choice-${prev.id}`,
                    label: value,
                  }
                : undefined,
            }));
          }}
        />
        <DescriptionElement
          spell={spellState}
          onSave={(e) => {
            setSpellState((prev) => ({ ...prev, description: e }));
          }}
        />
        {interactionBtns}
      </FlexRow>
      <FlexRow className="items-start">
        {normalizeUpgrades(spellState.upgrades).map((upgrade) => (
          <FlexCol key={`spell-upgrade-${spellState.id}-${upgrade.level}`} className="w-32">
            <InputUnq
              id={`char-input-spell-upgrade-${spellState.id}-${upgrade.level}`}
              label={`lvl ${upgrade.level}`}
              value={upgrade.raw}
              layout="flex-col"
              widthOverride="w-32"
              onBlur={(e) => setUpgradeRaw(upgrade.level, (e.target as HTMLInputElement).value)}
            />
            <span className="text-xs opacity-70">
              {upgrade.available ? (upgrade.stagnates ? "Stagnál" : "Elérhető") : "Nem elérhető"}
            </span>
            <span className="text-xs opacity-70">Költség: {formatSpellCost(upgrade.cost)}</span>
            <span className="text-xs opacity-70">
              Időtartam: {formatSpellDuration(upgrade.duration)}
            </span>
          </FlexCol>
        ))}
      </FlexRow>
      {children}
    </FlexCol>
  );
});
