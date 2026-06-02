import { JSX } from "preact";
import { Character } from "@shared/contracts";
import Armor1hIcon from "@components/icons/magus/Armor1hIcon";
import Armor2hIcon from "@components/icons/magus/Armor2hIcon";
import ArmorBootsIcon from "@components/icons/magus/ArmorBootsIcon";
import ArmorBracerIcon from "@components/icons/magus/ArmorBracerIcon";
import ArmorChestIcon from "@components/icons/magus/ArmorChestIcon";
import ArmorCloakIcon from "@components/icons/magus/ArmorCloakIcon";
import ArmorGlovesIcon from "@components/icons/magus/ArmorGlovesIcon";
import ArmorHelmetIcon from "@components/icons/magus/ArmorHelmetIcon";
import ArmorNecklaceIcon from "@components/icons/magus/ArmorNecklaceIcon";
import ArmorPantsIcon from "@components/icons/magus/ArmorPantsIcon";
import ArmorRingIcon from "@components/icons/magus/ArmorRingIcon";
import ArmorShieldIcon from "@components/icons/magus/ArmorShieldIcon";
import ArmorShouldersIcon from "@components/icons/magus/ArmorShouldersIcon";
import ArmorTrinketIcon from "@components/icons/magus/ArmorTrinketIcon";
import CharBagIcon from "@components/icons/magus/CharBagIcon";
import MiscIcon from "@components/icons/magus/MiscIcon";

export const getItemDefaultIcon = (
  item: Character.Item.TItem,
  className = "w-6 h-6",
  emptyFallback: "misc" | "trinket" = "misc"
): JSX.Element => {
  if (item.equipable === null) {
    return emptyFallback === "trinket" ? (
      <ArmorTrinketIcon className={className} />
    ) : (
      <MiscIcon className={className} />
    );
  }

  switch (item.equipable) {
    case Character.Item.ITEM_TYPE_EQUIPPABLE.WEP1H:
      return <Armor1hIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.WEP2H:
      return <Armor2hIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.BOOTS:
      return <ArmorBootsIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.BRACER:
      return <ArmorBracerIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.CHEST:
      return <ArmorChestIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.BACK:
      return <ArmorCloakIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.GLOVES:
      return <ArmorGlovesIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.HEAD:
      return <ArmorHelmetIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.NECK:
      return <ArmorNecklaceIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.LEGS:
      return <ArmorPantsIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.SHOULDER:
      return <ArmorShouldersIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.ACCESSORY:
      return emptyFallback === "trinket" ? (
        <ArmorTrinketIcon className={className} />
      ) : (
        <ArmorRingIcon className={className} />
      );
    case Character.Item.ITEM_TYPE_EQUIPPABLE.SHIELD:
      return <ArmorShieldIcon className={className} />;
    case Character.Item.ITEM_TYPE_EQUIPPABLE.BAG:
    case Character.Item.ITEM_TYPE_EQUIPPABLE.SATCHEL:
      return <CharBagIcon className={className} />;
    default:
      return emptyFallback === "trinket" ? (
        <ArmorTrinketIcon className={className} />
      ) : (
        <MiscIcon className={className} />
      );
  }
};

export const getEmptySlotIcon = (
  slotName: string,
  className = "w-6 h-6 opacity-70"
): JSX.Element => {
  switch (slotName) {
    case "hands":
      return <ArmorGlovesIcon className={className} />;
    case "mainHand":
      return <Armor1hIcon className={className} />;
    case "head":
      return <ArmorHelmetIcon className={className} />;
    case "neck":
      return <ArmorNecklaceIcon className={className} />;
    case "chest":
      return <ArmorChestIcon className={className} />;
    case "legs":
      return <ArmorPantsIcon className={className} />;
    case "feet":
      return <ArmorBootsIcon className={className} />;
    case "rings1":
    case "rings2":
      return <ArmorRingIcon className={className} />;
    case "cloak":
      return <ArmorCloakIcon className={className} />;
    case "shoulder":
      return <ArmorShouldersIcon className={className} />;
    case "trinket":
      return <ArmorTrinketIcon className={className} />;
    case "offHand":
      return <ArmorShieldIcon className={className} />;
    case "bracer":
      return <ArmorBracerIcon className={className} />;
    case "bag":
    case "satchel":
      return <CharBagIcon className={className} />;
    default:
      return <MiscIcon className={className} />;
  }
};
