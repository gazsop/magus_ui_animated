import { Character } from "@shared/contracts";
import { CheckBoxUnq, InputUnq, SelectUnq, TextAreaUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";
import EditIcon from "@components/icons/general/EditIcon";
import { memo, useEffect, useMemo, useState } from "preact/compat";
import { ComponentChildren } from "preact";
import { MutableRef } from "preact/hooks";
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

const DescriptionElement = memo(function ({
  spell,
  onSave,
}: {
  spell: Character.Spell.TSpellElements | Character.Spell.ISpellLevel;
  onSave: (e: string) => void;
}) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const safeDescription = useMemo(
    () => sanitizeHtml(spell.description || ""),
    [spell.description]
  );
  return (
    <FlexCol>
      <FlexRow>
        <EditIcon
          className="h-4 m-1 w-6 cursor-pointer"
          onClick={() => {
            setDescriptionOpen((prev) => !prev);
          }}
        />
        <label htmlFor="">description</label>
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
  parentId,
  children,
  interactionBtns,
}: {
  spell: Character.Spell.TSpellElements | Character.Spell.ISpellLevel;
  specs: {
    name: string;
    description: string;
  }[];
  spellsRef: MutableRef<{
    [key in string]:
      | Character.Spell.TSpellElements
      | Character.Spell.ISpellLevel;
  }>;
  parentId?: string;
  children?: ComponentChildren;
  interactionBtns: ComponentChildren;
}) {
  const [spellState, setSpellState] = useState<
    Character.Spell.TSpellElements | Character.Spell.ISpellLevel
  >(
    "levels" in spell
      ? (spell as Character.Spell.TSpellElements)
      : (spell as Character.Spell.ISpellLevel)
  );

  useEffect(() => {
    const newSpell = {
      ...spellState,
      levels: undefined,
      parentId: parentId || "0",
    };
    spellsRef.current[spellState.id] = newSpell;
    return () => {
      delete spellsRef.current[spellState.id];
    };
  }, [parentId, spellState, spellsRef]);

  return (
    <FlexCol className="fancy-container my-2">
      <FlexRow
        className={`${
          "levels" in spellState && spellState.levels ? "bg-amber-900" : ""
        }`}
      >
        <InputUnq
          id={`char-input-rank-${spellState.id}`}
          label="rank"
          value={"rank" in spellState && spellState.rank ? spellState.rank : 1}
          widthOverride="w-24"
          layout="flex-col"
          onInput={(e) => {
            const target = e.target as HTMLInputElement;
            const value = toInt(target.value);
            if (value < 2) {
              target.value = "2";
              return;
            }
            setSpellState((prev) => ({ ...prev, rank: value }));
          }}
          onBlur={(e) => {
            const target = e.target as HTMLInputElement;
            const value = toInt(target.value);
            if (value < 2) {
              target.value = "2";
              return;
            }
            setSpellState((prev) => ({ ...prev, rank: value }));
          }}
          disabled={parentId ? false : true}
        />
        <InputUnq
          id={`char-input-spell-${spellState.id}`}
          label="name"
          value={spellState.name}
          layout="flex-col"
          widthOverride="w-24"
          onBlur={(e) => {
            const target = e.target as HTMLInputElement;
            setSpellState((prev) => ({ ...prev, name: target.value }));
          }}
          className="grow w-24"
        />
        <SelectUnq
          id={`char-select-spec-${spellState.id}`}
          label="spec"
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
          widthOverride="w-24"
        />
        <SelectUnq
          id={`char-select-type-${spellState.id}`}
          label="type"
          optionData={[
            { value: "damage", label: "damage" },
            { value: "heal", label: "heal" },
            { value: "utility", label: "utility" },
          ]}
          value={{ label: spellState.type, value: spellState.type }}
          onChange={(e) => {
            const val = e?.value as Character.Spell.TSpellType;
            setSpellState((prev) => ({ ...prev, type: val }));
          }}
          layout="flex-col"
          widthOverride="w-24"
        />
        <InputUnq
          id={`char-input-lvlReq-${spellState.id}`}
          label="lvlReq"
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
        <InputUnq
          id={`char-input-resourceCost-${spellState.id}`}
          label="resourceCost"
          value={spellState.resourceCost}
          type="number"
          onBlur={(e) => {
            const target = e.target as HTMLInputElement;
            const value = toInt(target.value);
            setSpellState((prev) => ({ ...prev, resourceCost: value }));
          }}
          layout="flex-col"
          widthOverride="w-24"
        />
        <InputUnq
          id={`char-input-nrOfTurnsToCast-${spellState.id}`}
          label="nrOfTurnsToCast"
          value={spellState.nrOfTurnsToCast}
          type="number"
          onBlur={(e) => {
            const target = e.target as HTMLInputElement;
            const value = toInt(target.value);
            setSpellState((prev) => ({ ...prev, nrOfTurnsToCast: value }));
          }}
          layout="flex-col"
          widthOverride="w-24"
        />
        <InputUnq
          id={`char-input-nrOfTurns-${spellState.id}`}
          label="nrOfTurns"
          value={spellState.nrOfTurns}
          type="number"
          onBlur={(e) => {
            const target = e.target as HTMLInputElement;
            const value = toInt(target.value);
            setSpellState((prev) => ({ ...prev, nrOfTurns: value }));
          }}
          layout="flex-col"
          widthOverride="w-24"
        />
        <InputUnq
          id={`char-input-range-${spellState.id}`}
          label="range"
          value={spellState.range}
          type="number"
          onBlur={(e) => {
            const target = e.target as HTMLInputElement;
            const value = toInt(target.value);
            setSpellState((prev) => ({ ...prev, range: value }));
          }}
          layout="flex-col"
          widthOverride="w-24"
        />
        <SelectUnq
          id={`char-select-class-${spellState.id}`}
          label="SpellClass"
          optionData={Object.keys(Character.Spell.SPELL_CLASSES).map((c) => ({
            value: c,
            label: c,
          }))}
          onChange={(e) => {
            const val = e?.value as Character.Spell.SPELL_CLASSES;
            setSpellState((prev) => ({ ...prev, class: val }));
          }}
          value={{ label: spellState.class, value: spellState.class }}
          layout="flex-col"
          widthOverride="w-24"
        />
        <CheckBoxUnq
          id={`char-input-passive-${spellState.id}`}
          label="passive"
          value={spellState.passive}
          onChange={(e) => {
            const target = e.target as HTMLInputElement;
            const val = target.checked;
            setSpellState((prev) => ({ ...prev, passive: val }));
          }}
          layout="flex-col"
          widthOverride="w-24"
        />
        <DescriptionElement
          spell={spellState}
          onSave={(e) => {
            setSpellState((prev) => ({ ...prev, description: e }));
          }}
        />
        {interactionBtns}
      </FlexRow>
      {children}
    </FlexCol>
  );
});
