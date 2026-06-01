import { Character } from "@shared/contracts";
import AuraDisplay from "@components/AuraDisplay";
import { formatHmCompact, withHmDefaults } from "@/utils/hm";
import { getItemDefaultIcon } from "@/utils/itemIcons";

type ItemHoverCardProps = {
  item: Character.Item.TItem;
  x: number;
  y: number;
  iconFallback?: "misc" | "trinket";
  showEffectHm?: boolean;
  showPrimary?: boolean;
  showWeaponDamages?: boolean;
};

export default function ItemHoverCard({
  item,
  x,
  y,
  iconFallback = "misc",
  showEffectHm = false,
  showPrimary = false,
  showWeaponDamages = false,
}: ItemHoverCardProps) {
  const imgSrc = item.imgMeta?.src || item.img || "";
  const baseHm = withHmDefaults(item.hm);
  const effectHm = withHmDefaults(item.effects?.hm);
  const primaryMods = item.effects?.primaryStats || [];
  const auras = item.effects?.auras || [];
  const weaponDamages = item.effects?.weaponDamages || [];

  return (
    <div
      className="fixed z-[100003] pointer-events-none fancy-container p-2 w-[280px] text-xs"
      style={{
        left: `${Math.min(window.innerWidth - 300, x + 12)}px`,
        top: `${Math.min(window.innerHeight - 260, y + 12)}px`,
      }}
    >
      <div className="flex gap-2 items-start">
        <div className="w-14 h-14 border border-slate-500 rounded overflow-hidden bg-white/40 shrink-0 flex items-center justify-center">
          {imgSrc ? (
            <img
              src={imgSrc}
              className="w-full h-full object-cover"
              style={{ objectFit: item.imgMeta?.fit || "cover" }}
            />
          ) : (
            getItemDefaultIcon(item, "w-8 h-8 opacity-70", iconFallback)
          )}
        </div>
        <div className="min-w-0 grow">
          <p className="font-bold break-words">{item.name || "Unnamed item"}</p>
          <p className="text-[11px] break-words">{item.description || "-"}</p>
        </div>
      </div>
      <hr className="fancy my-1" />
      <div className="flex flex-col gap-0.5">
        {(showEffectHm || showPrimary || showWeaponDamages) && (
          <p className="font-semibold">Stat modifiers</p>
        )}
        <p>HM: {formatHmCompact(baseHm)}</p>
        {showEffectHm ? <p>Effect HM: {formatHmCompact(effectHm)}</p> : null}
        {showPrimary ? (
          <p>
            Primary:{" "}
            {primaryMods.length > 0
              ? primaryMods
                  .map((m) => `${m.name} ${m.value >= 0 ? "+" : ""}${m.value}`)
                  .join(", ")
              : "-"}
          </p>
        ) : null}
        {showWeaponDamages ? (
          <p>
            Weapon:{" "}
            {weaponDamages.length > 0
              ? weaponDamages
                  .map(
                    (d) =>
                      `${d.nrOfRolls || 1}x${d.nrOfDices || 0}k${d.dice}${
                        d.constant ? `+${d.constant}` : ""
                      }`
                  )
                  .join(", ")
              : "-"}
          </p>
        ) : null}
        <div>
          <p>Auras: {auras.length > 0 ? "" : "-"}</p>
          {auras.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {auras.map((aura, index) => (
                <AuraDisplay
                  key={`hover-aura-${index}`}
                  aura={aura}
                  showName={false}
                  showColorDot={false}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
