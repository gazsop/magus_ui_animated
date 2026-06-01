import { Character } from "@shared/contracts";

export type TItemSort = "nameAsc" | "nameDesc";
export type TItemFilter = "all" | "consumable" | "equippable" | "storage";

export type TItemAuraDraft = {
  name: string;
  description: string;
  color: string;
  effect: Character.Spell.TSpellEffect[];
  applyWhen?: Character.Item.TItemAuraApplyWhen;
  modifiers: Character.TAuraModifier[];
};

export type TPrimaryStatDraft = {
  name: Character.PRIMARY_STATS;
  value: number;
};
