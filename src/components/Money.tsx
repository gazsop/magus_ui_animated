import {
  TMoneyBreakdown,
  copperToMoneyBreakdown,
  moneyBreakdownToCopper,
  normalizeMoneyUnit,
} from "@shared/game";
import { FlexRow } from "@components/Flex";
import CharCoinGold from "@components/icons/magus/CharCoinGoldIcon";
import CharCoinSilver from "@components/icons/magus/CharCoinSilver";
import CharCoinBronze from "@components/icons/magus/CharCoinBronzeIcon";

export function MoneyDisplay({
  copper,
  className = "",
}: {
  copper: number;
  className?: string;
}) {
  const value = copperToMoneyBreakdown(copper);
  return (
    <FlexRow className={`items-center gap-1 flex-wrap ${className}`}>
      <FlexRow className="items-center gap-0.5">
        <CharCoinGold className="w-4 h-4" />
        <span>{value.gold}</span>
      </FlexRow>
      <FlexRow className="items-center gap-0.5">
        <CharCoinSilver className="w-4 h-4" />
        <span>{value.silver}</span>
      </FlexRow>
      <FlexRow className="items-center gap-0.5">
        <CharCoinBronze className="w-4 h-4" />
        <span>{value.copper}</span>
      </FlexRow>
    </FlexRow>
  );
}

export function MoneyAddInput({
  id,
  label,
  valueCopper,
  onChange,
  className = "",
}: {
  id: string;
  label?: string;
  valueCopper: number;
  onChange: (nextCopper: number) => void;
  className?: string;
}) {
  const value = copperToMoneyBreakdown(valueCopper);
  const update = (patch: Partial<TMoneyBreakdown>) => {
    onChange(moneyBreakdownToCopper({ ...value, ...patch }));
  };
  const inputClass = "border rounded text-black p-1 w-20 min-w-0";

  return (
    <div className={`fancy-container p-1 min-w-0 shrink-0 ${className}`}>
      {label ? <p className="mb-1 font-semibold text-sm">{label}</p> : null}
      <FlexRow className="gap-1 flex-wrap items-end">
        <label className="flex flex-col gap-0.5">
          Gold
          <input
            id={`${id}-gold`}
            type="number"
            min={0}
            className={inputClass}
            value={value.gold}
            onInput={(e) => update({ gold: normalizeMoneyUnit(e.currentTarget.value) })}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Silver
          <input
            id={`${id}-silver`}
            type="number"
            min={0}
            className={inputClass}
            value={value.silver}
            onInput={(e) => update({ silver: normalizeMoneyUnit(e.currentTarget.value) })}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Copper
          <input
            id={`${id}-copper`}
            type="number"
            min={0}
            className={inputClass}
            value={value.copper}
            onInput={(e) => update({ copper: normalizeMoneyUnit(e.currentTarget.value) })}
          />
        </label>
      </FlexRow>
    </div>
  );
}
