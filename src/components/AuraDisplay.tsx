import { Character } from "@shared/contracts";

export type TAuraDisplayAura = {
  name?: string;
  description?: string;
  effect?: Character.Spell.TSpellEffect[];
  modifiers?: Character.TAuraModifier[];
  color?: string;
  manual?: boolean;
  applyWhen?: Character.Item.TItemAuraApplyWhen;
};

type TAuraDisplayProps = {
  aura: TAuraDisplayAura;
  sourceLabel?: string;
  className?: string;
  showColorDot?: boolean;
  showName?: boolean;
};

const modifierNumber = (
  value: number | Character.TValueModifier | undefined
): string => {
  if (typeof value === "number") return signed(value);
  const parts = [];
  const flat = Number(value?.flat || 0);
  const percent = Number(value?.percent || 0);
  if (flat !== 0) parts.push(signed(flat));
  if (percent !== 0) parts.push(`${signed(percent)}%`);
  return parts.join("/") || "+0";
};

const signed = (value: number): string => `${value >= 0 ? "+" : ""}${value}`;

const formatEffect = (effect: Character.Spell.TSpellEffect): string =>
  `${effect.type} ${effect.length === 0 ? "endless" : `${effect.length}t`}`;

const formatModifierGroup = (modifier: Character.TAuraModifier): string[] => {
  const parts: string[] = [];

  const hmEntries = Object.entries(modifier.hm || {});
  if (hmEntries.length > 0) {
    parts.push(
      `HM ${hmEntries.map(([key, value]) => `${key} ${modifierNumber(value)}`).join(" ")}`
    );
  }

  if (modifier.primaryStats?.length) {
    parts.push(
      `Primary ${modifier.primaryStats
        .map((stat) => `${stat.name} ${modifierNumber(stat)}`)
        .join(", ")}`
    );
  }

  if (modifier.secondaryStats?.length) {
    parts.push(
      `Secondary ${modifier.secondaryStats
        .map((stat) => `${stat.id || "-"} ${modifierNumber(stat)}`)
        .join(", ")}`
    );
  }

  const healthEntries = Object.entries(modifier.resource?.health || {});
  if (healthEntries.length > 0) {
    parts.push(
      `Health ${healthEntries.map(([key, value]) => `${key} ${modifierNumber(value)}`).join(" ")}`
    );
  }

  const abilityEntries = Object.entries(modifier.resource?.abilities || {});
  if (abilityEntries.length > 0) {
    parts.push(
      `Abilities ${abilityEntries
        .map(([key, value]) => `${key} ${modifierNumber(value)}`)
        .join(" ")}`
    );
  }

  return parts;
};

const getModifierSummary = (modifiers: Character.TAuraModifier[]): string[] =>
  modifiers.flatMap((modifier, index) =>
    formatModifierGroup(modifier).map((part) =>
      modifiers.length > 1 ? `G${index + 1}: ${part}` : part
    )
  );

export default function AuraDisplay({
  aura,
  sourceLabel,
  className = "",
  showColorDot = true,
  showName = true,
}: TAuraDisplayProps) {
  const effects = Array.isArray(aura.effect) ? aura.effect : [];
  const modifiers = Array.isArray(aura.modifiers) ? aura.modifiers : [];
  const modifierSummary = getModifierSummary(modifiers);
  const applyLabel =
    aura.applyWhen === "carried"
      ? "carried"
      : aura.applyWhen === "equipped"
        ? "equipped"
        : "";
  const source = sourceLabel || (aura.manual === false ? "item" : "");

  return (
    <div className={`min-w-0 text-xs leading-snug ${className}`}>
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        {showColorDot && aura.color ? (
          <span
            className="inline-block w-2.5 h-2.5 rounded-full border border-slate-500 shrink-0"
            style={{ backgroundColor: aura.color }}
            aria-hidden="true"
          />
        ) : null}
        {showName && aura.name ? (
          <span className="font-semibold break-words">{aura.name}</span>
        ) : null}
        {source ? <span className="opacity-80">[{source}]</span> : null}
        {applyLabel ? <span className="opacity-80">[{applyLabel}]</span> : null}
        <span className="opacity-90">
          {effects.length > 0 ? effects.map(formatEffect).join(", ") : "no effect"}
        </span>
        <span className="opacity-80">mods:{modifiers.length}</span>
      </div>
      {modifierSummary.length > 0 ? (
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 opacity-90">
          {modifierSummary.map((entry, index) => (
            <span key={`aura-mod-${index}`} className="break-words">
              {entry}
            </span>
          ))}
        </div>
      ) : null}
      {aura.description ? (
        <p className="mt-0.5 break-words opacity-90">{aura.description}</p>
      ) : null}
    </div>
  );
}
