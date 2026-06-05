import { ButtonUnq } from "@components/GeneralElements";
import { FlexRow } from "@components/Flex";
import { IWindowsLayerWindowProps, useWindowsLayer } from "@pages/WindowsLayer";
import ClipboardIcon from "@components/icons/general/ClipboardIcon";
import { defineWindowRegistration } from "@/windows/windowFactory";

type TRestWindowKind =
  | "admin-rest"
  | "admin-professions"
  | "admin-items"
  | "admin-npcs"
  | "admin-combats"
  | "admin-xp-levels"
  | "admin-vendors";

const REST_WINDOW_DEFS: Record<
  TRestWindowKind,
  { name: string; icon: string | IWindowsLayerWindowProps["icon"]; descriptorIcon: string; title: string }
> = {
  "admin-rest": { name: "Pihenők kezelése", icon: "RH", descriptorIcon: "RH", title: "Rest" },
  "admin-professions": { name: "Képzettségek", icon: "PH", descriptorIcon: "PH", title: "Képzettségek" },
  "admin-items": { name: "Tárgykezelés", icon: <ClipboardIcon className="w-4 h-4" />, descriptorIcon: "IH", title: "Tárgyak" },
  "admin-npcs": { name: "NJK-kezelés", icon: "NH", descriptorIcon: "NH", title: "NJK-k" },
  "admin-combats": { name: "Harckezelés", icon: "CH", descriptorIcon: "CH", title: "Harcok" },
  "admin-xp-levels": { name: "TP-szintek", icon: "XL", descriptorIcon: "XL", title: "TP-szintek" },
  "admin-vendors": { name: "Kereskedőkezelés", icon: "VH", descriptorIcon: "VH", title: "Kalmárok" },
};

export default function AdminRestDataHandling() {
  const windowsLayer = useWindowsLayer();
  const openRestWindow = (kind: TRestWindowKind) => {
    const def = REST_WINDOW_DEFS[kind];
    windowsLayer.addWindow(defineWindowRegistration({
      id: def.name,
      name: def.name,
      kind,
      title: def.title,
      icon: def.descriptorIcon,
      iconElement: typeof def.icon === "string" ? <>{def.icon}</> : def.icon,
    }));
  };
  const openRestHandling = () => openRestWindow("admin-rest");
  const openProfessions = () => openRestWindow("admin-professions");
  const openItems = () => openRestWindow("admin-items");
  const openNpcs = () => openRestWindow("admin-npcs");
  const openCombats = () => openRestWindow("admin-combats");
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
        id={`open-npcs`}
        onClick={openNpcs}
        className="w-full sm:w-[200px]"
      >
        NJK-k
      </ButtonUnq>
      <ButtonUnq
        id={`open-combats`}
        onClick={openCombats}
        className="w-full sm:w-[200px]"
      >
        Harcok
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
