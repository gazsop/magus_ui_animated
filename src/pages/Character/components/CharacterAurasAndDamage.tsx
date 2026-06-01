import { Character } from "@shared/contracts";
import { nanoid } from "nanoid";
import { useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { ButtonUnq } from "@components/GeneralElements";
import { FlexCol } from "@components/Flex";
import AuraEditor, { createEmptyAuraEditorDraft, TAuraEditorDraft } from "@components/AuraEditor";
import AuraDisplay from "@components/AuraDisplay";
import { formatClientDateTime } from "@/core/datetime";

type TAuraPanelEntry = Character.TAura & {
  applyWhen?: Character.Item.TItemAuraApplyWhen;
  sourceLabel?: string;
};

export default function useAurasAndDamagePanel({
  character,
  onSave,
}: {
  character: Character.TCharacter;
  onSave: (nextCharacter: Character.TCharacter) => Promise<void>;
}) {
  const [auraDraft, setAuraDraft] = useState<TAuraEditorDraft>(
    createEmptyAuraEditorDraft({ color: "#ffcc00" })
  );
  const [isAuraModalOpen, setIsAuraModalOpen] = useState(false);
  const [damageValue, setDamageValue] = useState<number>(0);
  const [healHpValue, setHealHpValue] = useState<number>(0);
  const [healEpValue, setHealEpValue] = useState<number>(0);
  const canUseDom = typeof document !== "undefined";
  const isEquippedEntry = (entry: Character.Item.TBackpack["items"][number]) =>
    entry.bag?.state === "equipped" || !!entry.placement?.equippedSlotId;
  const itemAuras = (character.inventory?.backpacks || [])
    .flatMap((bp) => bp.items || [])
    .flatMap((entry) => {
      const applies = (aura: Character.Item.TItemAura) =>
        aura.applyWhen === "carried" || isEquippedEntry(entry);
      const baseAuras = Array.isArray(entry.item?.effects?.auras)
        ? entry.item.effects!.auras!.filter(applies)
        : [];
      const extraAuras = Array.isArray(entry.additionalAuras)
        ? entry.additionalAuras.filter(applies)
        : [];
      const allAuras = [...baseAuras, ...extraAuras];
      const count = Math.max(0, Number(entry.amount) || 0);
      return Array.from({ length: count }, () => ({
        item: entry.item,
        auras: allAuras,
      }));
    })
    .flatMap((entryWithAuras, idx) =>
      entryWithAuras.auras.map((itemAura, auraIdx) => ({
        id: `item-aura-${entryWithAuras.item.name}-${idx}-${auraIdx}`,
        name: `${entryWithAuras.item.name}`,
        description: itemAura.description || "",
        effect: Array.isArray(itemAura.effect) ? itemAura.effect : [],
        color: "#7dd3fc",
        manual: false,
        modifiers: Array.isArray(itemAura.modifiers) ? itemAura.modifiers : [],
        applyWhen: itemAura.applyWhen === "carried" ? "carried" : "equipped",
        sourceLabel: "item",
      }))
    ) as TAuraPanelEntry[];
  const mergedAuras: TAuraPanelEntry[] = [...(character.auras || []), ...itemAuras];

  const applyDamage = async () => {
    const damage = Math.max(0, Number(damageValue) || 0);
    if (damage <= 0) return;
    const health = character.resource.health;
    const hpBefore = Number(health.currentHp || 0);
    const epBefore = Number(health.currentEp || 0);
    const hpDamage = Math.min(hpBefore, damage);
    const remaining = damage - hpDamage;
    const epDamage = Math.min(epBefore, remaining);
    const nextHp = hpBefore - hpDamage;
    const nextEp = epBefore - epDamage;

    const nextCharacter: Character.TCharacter = {
      ...character,
      resource: {
        ...character.resource,
        health: {
          ...character.resource.health,
          currentHp: nextHp,
          currentEp: nextEp,
        },
      },
      damageLog: [
        ...(character.damageLog || []),
        {
          id: nanoid(),
          time: Date.now(),
          hpChange: -hpDamage,
          epChange: -epDamage,
          hpCurrent: nextHp,
          hpMax: Number(health.maxHp || 0),
          epCurrent: nextEp,
          epMax: Number(health.maxEp || 0),
        },
      ],
    };
    await onSave(nextCharacter);
    setDamageValue(0);
  };

  const applyHpHeal = async () => {
    const heal = Math.max(0, Number(healHpValue) || 0);
    if (heal <= 0) return;
    const health = character.resource.health;
    const hpBefore = Number(health.currentHp || 0);
    const hpMax = Number(health.maxHp || 0);
    const healApplied = Math.max(0, Math.min(heal, hpMax - hpBefore));
    if (healApplied <= 0) return;
    const nextCharacter: Character.TCharacter = {
      ...character,
      resource: {
        ...character.resource,
        health: {
          ...character.resource.health,
          currentHp: hpBefore + healApplied,
        },
      },
      damageLog: [
        ...(character.damageLog || []),
        {
          id: nanoid(),
          time: Date.now(),
          hpChange: healApplied,
          epChange: 0,
          hpCurrent: hpBefore + healApplied,
          hpMax: hpMax,
          epCurrent: Number(health.currentEp || 0),
          epMax: Number(health.maxEp || 0),
        },
      ],
    };
    await onSave(nextCharacter);
    setHealHpValue(0);
  };

  const applyEpHeal = async () => {
    const heal = Math.max(0, Number(healEpValue) || 0);
    if (heal <= 0) return;
    const health = character.resource.health;
    const epBefore = Number(health.currentEp || 0);
    const epMax = Number(health.maxEp || 0);
    const healApplied = Math.max(0, Math.min(heal, epMax - epBefore));
    if (healApplied <= 0) return;
    const nextCharacter: Character.TCharacter = {
      ...character,
      resource: {
        ...character.resource,
        health: {
          ...character.resource.health,
          currentEp: epBefore + healApplied,
        },
      },
      damageLog: [
        ...(character.damageLog || []),
        {
          id: nanoid(),
          time: Date.now(),
          hpChange: 0,
          epChange: healApplied,
          hpCurrent: Number(health.currentHp || 0),
          hpMax: Number(health.maxHp || 0),
          epCurrent: epBefore + healApplied,
          epMax: epMax,
        },
      ],
    };
    await onSave(nextCharacter);
    setHealEpValue(0);
  };

  const addAura = async () => {
    const name = auraDraft.name.trim();
    const effects = auraDraft.effect;
    if (!name || effects.length < 1) return;
    const nextCharacter: Character.TCharacter = {
      ...character,
      auras: [
        ...(character.auras || []),
        {
          id: nanoid(),
          name,
          description: auraDraft.description.trim(),
          effect: effects,
          color: auraDraft.color || "#ffcc00",
          manual: true,
          modifiers: auraDraft.modifiers,
        },
      ],
    };
    await onSave(nextCharacter);
    setAuraDraft(createEmptyAuraEditorDraft({ color: "#ffcc00" }));
    setIsAuraModalOpen(false);
  };

  const canAddAura = auraDraft.name.trim().length > 0 && auraDraft.effect.length > 0;

  const removeAura = async (id: string) => {
    const nextCharacter: Character.TCharacter = {
      ...character,
      auras: (character.auras || []).filter((a) => a.id !== id),
    };
    await onSave(nextCharacter);
  };

  const updateAuraColor = async (id: string, color: string) => {
    const nextCharacter: Character.TCharacter = {
      ...character,
      auras: (character.auras || []).map((a) =>
        a.id === id ? { ...a, color } : a
      ),
    };
    await onSave(nextCharacter);
  };
  
  const aurasPanel = (
    <FlexCol className="fancy-container p-0.5 min-w-0 min-h-0 w-full h-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <p className="font-bold">Auras</p>
        <ButtonUnq
          id="aura-open-modal"
          onClick={() => {
            setAuraDraft(createEmptyAuraEditorDraft({ color: "#ffcc00" }));
            setIsAuraModalOpen(true);
          }}
        >
          + Aura
        </ButtonUnq>
      </div>
      <FlexCol className="gap-0.25 mt-0.5 w-full min-h-0 grow overflow-auto">
        {mergedAuras.length === 0 ? (
          <p>No active auras.</p>
        ) : (
          <table className="w-full table-fixed border-separate border-spacing-y-0.5">
            <tbody>
              {mergedAuras.map((aura) => (
                <tr key={aura.id} className="fancy-container">
                  <td className="w-6 p-0.5 align-top">
                    <input
                      type="color"
                      value={aura.color}
                      className="w-5 h-6"
                      disabled={!aura.manual}
                      onChange={(e) =>
                        updateAuraColor(aura.id, (e.currentTarget as HTMLInputElement).value)
                      }
                    />
                  </td>
                  <td className="p-0.5 align-top">
                    <AuraDisplay aura={aura} sourceLabel={aura.sourceLabel} showColorDot={false} />
                  </td>
                  <td className="w-[84px] p-0.5 align-top">
                    {aura.manual ? (
                      <ButtonUnq id={`remove-aura-${aura.id}`} onClick={() => removeAura(aura.id)} className="w-full">Remove</ButtonUnq>
                    ) : (
                      <p className="text-center">Item</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FlexCol>
      {isAuraModalOpen && canUseDom
        ? createPortal(
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100008] p-2">
              <div className="fancy-container p-2 w-[min(520px,95vw)] max-w-[95vw] max-h-[90vh] overflow-auto flex flex-col gap-2">
                <p className="font-semibold">Add Aura</p>
                <AuraEditor draft={auraDraft} onChange={setAuraDraft} />
                <div className="flex justify-end gap-2 flex-wrap">
                  <button
                    type="button"
                    className="fancy-container px-2 py-1"
                    onClick={() => setIsAuraModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`fancy-container px-2 py-1 ${canAddAura ? "" : "opacity-50 pointer-events-none"}`}
                    onClick={addAura}
                  >
                    Save Aura
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </FlexCol>
  );

  const damagesPanel = (
    <FlexCol className="fancy-container p-0.5 min-w-0 min-h-0 w-full h-full overflow-hidden">
      <p className="font-bold">Damage Tracker</p>
      <p className="break-words">
        HP: {character.resource.health.currentHp}/{character.resource.health.maxHp} | EP:{" "}
        {character.resource.health.currentEp}/{character.resource.health.maxEp}
      </p>
      <table className="w-full table-fixed border-separate border-spacing-y-0.5 shrink-0">
        <tbody>
          <tr>
            <td className="w-[34%] pr-1 whitespace-nowrap"><label htmlFor="damage-value">Damage</label></td>
            <td className="pr-1"><input id="damage-value" type="number" className="w-full px-1" value={damageValue} onInput={(e) => setDamageValue(Number(e.currentTarget.value) || 0)} /></td>
            <td className="w-[92px]"><ButtonUnq id="damage-apply" onClick={applyDamage} className="w-full">Apply</ButtonUnq></td>
          </tr>
          <tr>
            <td className="pr-1 whitespace-nowrap"><label htmlFor="heal-hp-value">Heal HP</label></td>
            <td className="pr-1"><input id="heal-hp-value" type="number" className="w-full px-1" value={healHpValue} onInput={(e) => setHealHpValue(Number(e.currentTarget.value) || 0)} /></td>
            <td><ButtonUnq id="heal-hp-apply" onClick={applyHpHeal} className="w-full">Apply HP</ButtonUnq></td>
          </tr>
          <tr>
            <td className="pr-1 whitespace-nowrap"><label htmlFor="heal-ep-value">Heal EP</label></td>
            <td className="pr-1"><input id="heal-ep-value" type="number" className="w-full px-1" value={healEpValue} onInput={(e) => setHealEpValue(Number(e.currentTarget.value) || 0)} /></td>
            <td><ButtonUnq id="heal-ep-apply" onClick={applyEpHeal} className="w-full">Apply EP</ButtonUnq></td>
          </tr>
        </tbody>
      </table>
      <FlexCol className="mt-0.5 gap-0.25 min-h-0 grow overflow-auto w-full min-w-0">
        {(character.damageLog || []).length === 0 ? (
          <p>No damage events.</p>
        ) : (
          [...(character.damageLog || [])]
            .reverse()
            .map((entry) => (
              <p key={entry.id} className="break-words">
                {formatClientDateTime(entry.time)} | HP {entry.hpChange} | EP {entry.epChange} [{entry.hpCurrent}/{entry.hpMax} HP, {entry.epCurrent}/{entry.epMax} EP]
              </p>
            ))
        )}
      </FlexCol>
    </FlexCol>
  );

  return {aurasPanel, damagesPanel};
}

