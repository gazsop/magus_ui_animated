import { ButtonUnq } from "@components/GeneralElements";
import { FlexRow } from "@components/Flex";
import { IWindowsLayerWindowProps, useWindowsLayer } from "@pages/WindowsLayer";
import ClipboardIcon from "@components/icons/general/ClipboardIcon";

type TRestWindowKind =
  | "admin-rest"
  | "admin-professions"
  | "admin-items"
  | "admin-xp-levels"
  | "admin-vendors";

const REST_WINDOW_DEFS: Record<
  TRestWindowKind,
  { name: string; icon: string | IWindowsLayerWindowProps["icon"]; descriptorIcon: string; title: string }
> = {
  "admin-rest": { name: "RestHandling", icon: "RH", descriptorIcon: "RH", title: "Rest" },
  "admin-professions": { name: "Professions", icon: "PH", descriptorIcon: "PH", title: "Professions" },
  "admin-items": { name: "Item handling", icon: <ClipboardIcon className="w-4 h-4" />, descriptorIcon: "IH", title: "Items" },
  "admin-xp-levels": { name: "XP Levels", icon: "XL", descriptorIcon: "XL", title: "XP Levels" },
  "admin-vendors": { name: "Vendor handling", icon: "VH", descriptorIcon: "VH", title: "Vendors" },
};

export default function AdminRestDataHandling() {
  const windowsLayer = useWindowsLayer();
  const openRestWindow = (kind: TRestWindowKind) => {
    const def = REST_WINDOW_DEFS[kind];
    windowsLayer.addWindow({
      name: def.name,
      icon: typeof def.icon === "string" ? <>{def.icon}</> : def.icon,
      descriptor: {
        id: def.name,
        kind,
        title: def.title,
        icon: def.descriptorIcon,
      },
    });
  };
  const openRestHandling = () => openRestWindow("admin-rest");
  const openProfessions = () => openRestWindow("admin-professions");
  const openItems = () => openRestWindow("admin-items");
  const openXpLevels = () => openRestWindow("admin-xp-levels");
  const openVendors = () => openRestWindow("admin-vendors");

  return (
    <FlexRow className={`items-center justify-center w-full flex-wrap gap-1`}>
      <ButtonUnq
        id={`open-all-rest`}
        onClick={openRestHandling}
        className="w-full sm:w-[200px]"
      >
        Rest
      </ButtonUnq>
      <ButtonUnq
        id={`open-professions`}
        onClick={openProfessions}
        className="w-full sm:w-[200px]"
      >
        Professions
      </ButtonUnq>
      <ButtonUnq
        id={`open-items`}
        onClick={openItems}
        className="w-full sm:w-[200px]"
      >
        Items
      </ButtonUnq>
      <ButtonUnq
        id={`open-xp-levels`}
        onClick={openXpLevels}
        className="w-full sm:w-[200px]"
      >
        XP Levels
      </ButtonUnq>
      <ButtonUnq
        id={`open-vendors`}
        onClick={openVendors}
        className="w-full sm:w-[200px]"
      >
        Vendors
      </ButtonUnq>
    </FlexRow>
  );
}
