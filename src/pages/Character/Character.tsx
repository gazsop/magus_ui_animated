import { Adventure, Application, Character, ServerApi, Vendor } from "@shared/contracts";
import { formatRoll as formatSharedRoll, getRollRange } from "@shared/game";
import { useEffect, useRef, useState } from "preact/hooks";
import { FlexCol, FlexRow } from "@components/Flex";
import { JSX } from "preact";
import useRequest from "@hooks/request";
import NewCharacter from "@pages/Character/NewCharacter";
import { useInventoryPanels } from "@pages/Character/Inventory";
import GridItem from "@pages/Character/components/GridItem";
import {
  useHeaderIdentity,
  useHeaderStatsPanel,
  HeaderXp,
} from "@pages/Character/components/CharacterHeader";
import useAurasAndDamagePanel from "@pages/Character/components/CharacterAurasAndDamage";
import RPElement from "@pages/Character/components/CharacterRPElement";
import CharacterSpellsPanel from "@pages/Character/components/CharacterSpellsPanel";
import CharacterSpecializationModal from "@pages/Character/components/CharacterSpecializationModal";
import CharacterSecondarySkillsPanel from "@pages/Character/components/CharacterSecondarySkillsPanel";
import ImageUploadControl from "@components/ImageUploadControl";
import { parseCharacterPayload } from "@pages/Character/utils/characterPayload";
import { useUtilContext } from "@contexts/utilContext";
import { useDataContext } from "@contexts/dataContext";
import useError from "@hooks/error";
import { useCallback } from "preact/hooks";
import {
  useWindowsLayer,
} from "@pages/WindowsLayer";
import RndContainer from "@components/RndContainer";
import { useAdventureLiveEventSubscription, useSyncStatusSubscription } from "@hooks/liveEvents";
import { useLiveEventsContext } from "@contexts/liveEventsContext";
import { usePresenceUI } from "@contexts/presenceUIContext";
import { createPortal } from "preact/compat";
import { debugLog } from "@/core/logger";
import { createEmptyHm } from "@/utils/hm";
import { PageState } from "@/app/navigation";
import { HttpRequestError, isConflictError } from "@/core/api/httpClient";
import { MoneyDisplay } from "@components/Money";
import {
  registerWindowDescriptorRenderer,
  TWindowDescriptorRenderer,
  unregisterWindowDescriptorRenderer,
} from "@/windows/windowDescriptorRenderers";
import { defineWindowRegistration } from "@/windows/windowFactory";

type TLayoutBlockId =
  | "header_xp"
  | "header_identity"
  | "header_orbs"
  | "header_resourcebars"
  | "header_stats"
  | "header_hm"
  | "rp"
  | "inventory"
  | "default_storage"
  | "equipment"
  | "auras"
  | "damages";

type TLayoutItem = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type TLayoutState = Record<TLayoutBlockId, TLayoutItem>;
type TPendingLevelUp = {
  uid: string;
  advId: string;
  oldLevel: number;
  newLevel: number;
  levelUps: number;
  currentXp: number;
  hpRoll?: Adventure.TRollElements | null;
  resourceRoll?: Adventure.TRollElements | null;
  hmPoints: number;
  secondarySkillPoints: number;
};

const computeSpellVisibilityCap = (level: number): number => {
  const safeLevel = Math.max(1, Math.floor(Number(level || 1)));
  if (safeLevel < 10) return 10;
  return Math.min(99, (Math.floor(safeLevel / 10) + 1) * 10);
};

const CHARACTER_LAYOUT_KEY = "character_page_layout_v2";
const CHARACTER_BAG_LAYOUT_KEY = "character_page_bag_layout_v1";

const buildCharacterPatch = (
  current: Character.TCharacter,
  next: Character.TCharacter
): ServerApi.PatchOperation[] => {
  const patch: ServerApi.PatchOperation[] = [];
  const pushReplace = (path: string, value: unknown) => {
    patch.push({ op: "replace", path, value });
  };
  if (current.initialized !== next.initialized) pushReplace("/initialized", next.initialized);
  if (JSON.stringify(current.level) !== JSON.stringify(next.level)) pushReplace("/level", next.level);
  if (current.descent !== next.descent) pushReplace("/descent", next.descent);
  if (current.class !== next.class) pushReplace("/class", next.class);
  if (JSON.stringify(current.rp) !== JSON.stringify(next.rp)) pushReplace("/rp", next.rp);
  if (JSON.stringify(current.primaryStats) !== JSON.stringify(next.primaryStats)) {
    pushReplace("/primaryStats", next.primaryStats);
  }
  if (JSON.stringify(current.hm) !== JSON.stringify(next.hm)) pushReplace("/hm", next.hm);
  if (JSON.stringify(current.inventory) !== JSON.stringify(next.inventory)) {
    pushReplace("/inventory", next.inventory);
  }
  if (JSON.stringify(current.secondaryStats) !== JSON.stringify(next.secondaryStats)) {
    pushReplace("/secondaryStats", next.secondaryStats);
  }
  if (JSON.stringify(current.resource) !== JSON.stringify(next.resource)) {
    pushReplace("/resource", next.resource);
  }
  if (JSON.stringify(current.orbs) !== JSON.stringify(next.orbs)) pushReplace("/orbs", next.orbs);
  if (JSON.stringify(current.auras || []) !== JSON.stringify(next.auras || [])) {
    pushReplace("/auras", next.auras || []);
  }
  if (JSON.stringify(current.damageLog || []) !== JSON.stringify(next.damageLog || [])) {
    pushReplace("/damageLog", next.damageLog || []);
  }
  return patch;
};

const isInventoryOnlyPatch = (patch: ServerApi.PatchOperation[]) =>
  patch.length === 1 && patch[0].op === "replace" && patch[0].path === "/inventory";

const DEFAULT_LAYOUT: TLayoutState = {
  header_xp: { x: 1, y: 1, w: 33, h: 2 },
  header_identity: { x: 1, y: 3, w: 11, h: 7 },
  header_orbs: { x: 25, y: 3, w: 3, h: 7 },
  header_resourcebars: { x: 28, y: 3, w: 6, h: 7 },
  header_stats: { x: 1, y: 10, w: 33, h: 7 },
  header_hm: { x: 12, y: 3, w: 13, h: 7 },
  rp: { x: 27, y: 17, w: 14, h: 14 },
  inventory: { x: 3, y: 5, w: 2, h: 3 },
  default_storage: { x: 1, y: 30, w: 12, h: 11 },
  equipment: { x: 13, y: 17, w: 14, h: 25 },
  auras: { x: 21, y: 41, w: 19, h: 24 },
  damages: { x: 1, y: 41, w: 20, h: 24 },
};

const sanitizeLayoutItem = (
  input: Partial<TLayoutItem> | undefined,
  fallback: TLayoutItem
): TLayoutItem => ({
  x: Math.max(1, Math.floor(Number(input?.x ?? fallback.x))),
  y: Math.max(1, Math.floor(Number(input?.y ?? fallback.y))),
  w: Math.max(1, Math.floor(Number(input?.w ?? fallback.w))),
  h: Math.max(1, Math.floor(Number(input?.h ?? fallback.h))),
});

export default function CharacterPage({
  advId = "",
  expectExistingCharacter = false,
}: {
  advId: string;
  expectExistingCharacter?: boolean;
}) {
  const [selectedCharacter, setSelectedCharacter] =
    useState<Character.TCharacter>({
      createdAt: Date.now(),
      initialized: false,
      level: {
        current: 1,
        currentXp: 0,
      },
      descent: Character.DESCENTS.HUMAN,
      class: Character.CLASSES.WARRIOR,
      rp: {
        name: "",
        age: 0,
        skinColor: "",
        hair: "",
        eyes: "",
        bioType: Character.BTYPE.MALE,
        height: 0,
        weight: 0,
        description: "",
        religion: "",
        bornPlace: "",
        schools: "",
        personality: "",
        knownLanguages: [],
        professions: [],
        avatar: null,
      },
      primaryStats: [
        { name: Character.PRIMARY_STATS.AST, val: 0 },
        { name: Character.PRIMARY_STATS.INT, val: 0 },
        { name: Character.PRIMARY_STATS.STR, val: 0 },
        { name: Character.PRIMARY_STATS.DEX, val: 0 },
        { name: Character.PRIMARY_STATS.SPE, val: 0 },
        { name: Character.PRIMARY_STATS.WIP, val: 0 },
        { name: Character.PRIMARY_STATS.CON, val: 0 },
        { name: Character.PRIMARY_STATS.HEA, val: 0 },
        { name: Character.PRIMARY_STATS.BEA, val: 0 },
        { name: Character.PRIMARY_STATS.PER, val: 0 },
      ],
      hm: createEmptyHm(),
      inventory: {
        backpacks: [],
        money: [
          { name: "Gold", amount: 0 },
          { name: "Silver", amount: 0 },
          { name: "Copper", amount: 0 },
        ],
      },
      secondaryStats: [],
      resource: {
        health: {
          currentHp: 0,
          maxHp: 0,
          currentEp: 0,
          maxEp: 0,
        },
        abilities: {
          name: "Mana",
          current: 0,
          max: 0,
          regenPerRound: {
            dice: Adventure.DICE.SIX,
            nrOfDices: 0,
            constant: 0,
            nrOfRolls: 0,
          },
          lvlUp: {
            dice: Adventure.DICE.SIX,
            nrOfDices: 0,
            constant: 0,
            nrOfRolls: 0,
          },
        },
      },
      orbs: {
        black: 0,
        white: 0,
        voidorb: 0,
      },
      auras: [],
      damageLog: [],
    } as Character.TCharacter);
  const { setError } = useError();
  const [hasCharacterRecord, setHasCharacterRecord] = useState<boolean>(
    expectExistingCharacter
  );

  const [characterRequest] = useRequest(
    Application.REQUEST_CONTROLLER.CHARACTERS
  );
  const [adventureRequest] = useRequest(Application.REQUEST_CONTROLLER.ADVENTURES);
  const [restRequest] = useRequest(Application.REQUEST_CONTROLLER.REST);
  const { user, descents, classes } = useDataContext();
  const { setSyncSnapshot } = useLiveEventsContext();
  const { setCombatBadge } = usePresenceUI();
  const { addWindow, toggleWindow } = useWindowsLayer();
  const [religions, setReligions] = useState<Array<{ name: string; value: string }>>([]);
  const [personalities, setPersonalities] = useState<Array<{ name: string; value: string }>>([]);
  const [xpLevels, setXpLevels] = useState<number[]>(Character.LEVEL_CAPS);
  const [computedCharacter, setComputedCharacter] =
    useState<Character.TComputedCharacter | null>(null);
  const [characterHash, setCharacterHash] = useState<string>("");
  const [vendorState, setVendorState] = useState<Vendor.TVendorState | null>(null);
  const [pendingLevelUp, setPendingLevelUp] = useState<TPendingLevelUp | null>(null);
  const [levelUpStep, setLevelUpStep] = useState<0 | 1 | 2 | 3>(0);
  const [levelHpRows, setLevelHpRows] = useState<Array<{ hp: number; resource: number }>>([]);
  const [hmAlloc, setHmAlloc] = useState<{ ATK: number; DEF: number; INI: number; AIM: number }>({
    ATK: 0,
    DEF: 0,
    INI: 0,
    AIM: 0,
  });
  const [specializationChoice, setSpecializationChoice] = useState<string>("");
  const [levelUpError, setLevelUpError] = useState("");
  const characterHashRef = useRef<string>("");
  const syncRefreshRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const applyCharacterResponse = useCallback(
    (payload: unknown): Character.TCharacter => {
      const parsed = parseCharacterPayload(payload);
      const parsedCharacter = parsed.json;
      if (!parsedCharacter) throw new Error("Invalid character payload");
      const nextHash = parsed.hash || "";
      characterHashRef.current = nextHash;
      setSelectedCharacter(parsedCharacter);
      setComputedCharacter(parsed.computed);
      setCharacterHash(nextHash);
      return parsedCharacter;
    },
    []
  );

  const applyInventoryResponse = useCallback((payload: unknown): boolean => {
    const parsed = parseCharacterPayload(payload);
    const nextInventory = parsed.json?.inventory;
    if (!nextInventory) return false;
    setSelectedCharacter((prev) => ({
      ...prev,
      inventory: nextInventory,
    }));
    if (parsed.computed) setComputedCharacter(parsed.computed);
    const nextHash = parsed.hash || "";
    characterHashRef.current = nextHash;
    setCharacterHash(nextHash);
    return true;
  }, []);

  const { setDisableNavArrows } = useUtilContext();
  const [isLoadingCharacter, setIsLoadingCharacter] = useState<boolean>(true);
  const gridHostRef = useRef<HTMLDivElement>(null);
  const [gridSpec, setGridSpec] = useState({
    cols: 4,
    cellW: 36,
    rowH: 24,
    gap: 8,
    pad: 0,
  });
  const [isLayoutEdit, setIsLayoutEdit] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.innerWidth < 900);
  const [isNarrowMobile, setIsNarrowMobile] = useState(() => window.innerWidth < 600);
  const [layout, setLayout] = useState<TLayoutState>(() => {
    try {
      const raw = window.localStorage.getItem(CHARACTER_LAYOUT_KEY);
      if (!raw) return DEFAULT_LAYOUT;
      const parsed = JSON.parse(raw) as Partial<TLayoutState>;
      return {
        header_xp: { ...DEFAULT_LAYOUT.header_xp, ...(parsed.header_xp || {}) },
        header_identity: {
          ...DEFAULT_LAYOUT.header_identity,
          ...(parsed.header_identity || {}),
        },
        header_orbs: {
          ...DEFAULT_LAYOUT.header_orbs,
          ...(parsed.header_orbs || {}),
        },
        header_resourcebars: {
          ...DEFAULT_LAYOUT.header_resourcebars,
          ...(parsed.header_resourcebars || {}),
        },
        header_stats: { ...DEFAULT_LAYOUT.header_stats, ...(parsed.header_stats || {}) },
        header_hm: { ...DEFAULT_LAYOUT.header_hm, ...(parsed.header_hm || {}) },
        rp: { ...DEFAULT_LAYOUT.rp, ...(parsed.rp || {}) },
        inventory: { ...DEFAULT_LAYOUT.inventory, ...(parsed.inventory || {}) },
        default_storage: {
          ...DEFAULT_LAYOUT.default_storage,
          ...(parsed.default_storage || {}),
        },
        equipment: { ...DEFAULT_LAYOUT.equipment, ...(parsed.equipment || {}) },
        auras: {
          ...DEFAULT_LAYOUT.auras,
          ...(parsed.auras || {}),
        },
        damages: {
          ...DEFAULT_LAYOUT.damages,
          ...(parsed.damages || {})
        }
      };
    } catch {
      return DEFAULT_LAYOUT;
    }
  });
  const [bagStorageLayout, setBagStorageLayout] = useState<Record<string, TLayoutItem>>(() => {
    try {
      const raw = window.localStorage.getItem(CHARACTER_BAG_LAYOUT_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, Partial<TLayoutItem>>;
      return Object.fromEntries(
        Object.entries(parsed || {}).map(([storageId, value]) => [
          storageId,
          sanitizeLayoutItem(value, { x: 1, y: 1, w: 2, h: 2 }),
        ])
      );
    } catch {
      return {};
    }
  });

  useEffect(() => {
    window.localStorage.setItem(CHARACTER_LAYOUT_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    window.localStorage.setItem(
      CHARACTER_BAG_LAYOUT_KEY,
      JSON.stringify(bagStorageLayout)
    );
  }, [bagStorageLayout]);

  useEffect(() => {
    setLayout((prev) => {
      let next = prev;
      const sameRect = (a: TLayoutItem, b: TLayoutItem) =>
        a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

      if (sameRect(prev.inventory, prev.equipment)) {
        next = { ...next, equipment: { ...DEFAULT_LAYOUT.equipment } };
      }
      if (sameRect(prev.inventory, prev.default_storage)) {
        next = { ...next, default_storage: { ...DEFAULT_LAYOUT.default_storage } };
      }
      if (sameRect(prev.auras, prev.damages)) {
        next = { ...next, damages: { ...DEFAULT_LAYOUT.damages } };
      }
      if (sameRect(prev.header_identity, prev.header_orbs)) {
        next = { ...next, header_orbs: { ...DEFAULT_LAYOUT.header_orbs } };
      }
      if (
        sameRect(prev.header_identity, prev.header_resourcebars) ||
        sameRect(prev.header_orbs, prev.header_resourcebars)
      ) {
        next = {
          ...next,
          header_resourcebars: { ...DEFAULT_LAYOUT.header_resourcebars },
        };
      }
      return next;
    });
  }, []);

  const updateLayout = useCallback(
    (id: TLayoutBlockId, patch: Partial<TLayoutItem>) => {
      setLayout((prev) => {
        const current = prev[id];
        const next: TLayoutItem = {
          x: Math.max(1, Math.floor(patch.x ?? current.x)),
          y: Math.max(1, Math.floor(patch.y ?? current.y)),
          w: Math.max(1, Math.floor(patch.w ?? current.w)),
          h: Math.max(1, Math.floor(patch.h ?? current.h)),
        };
        return { ...prev, [id]: next };
      });
    },
    []
  );

  const selectedClassDef = classes.find((c) => c.name === selectedCharacter.class);
  const selectedDescentDef = descents.find((d) => d.name === selectedCharacter.descent);
  const hmBaseForWizard: Character.THm = {
    ATK:
      Number(selectedDescentDef?.modifiers.hm.ATK || 0) +
      Number(selectedClassDef?.modifiers.hm.ATK || 0),
    DEF:
      Number(selectedDescentDef?.modifiers.hm.DEF || 0) +
      Number(selectedClassDef?.modifiers.hm.DEF || 0),
    INI:
      Number(selectedDescentDef?.modifiers.hm.INI || 0) +
      Number(selectedClassDef?.modifiers.hm.INI || 0),
    AIM:
      Number(selectedDescentDef?.modifiers.hm.AIM || 0) +
      Number(selectedClassDef?.modifiers.hm.AIM || 0),
  };
  const hmInitialPointsForWizard = Number(selectedClassDef?.modifiers.hmPlus?.initial || 0);
  const spellVisibilityCap = computeSpellVisibilityCap(selectedCharacter.level?.current || 1);
  const activeSpecialization = String(selectedCharacter.rp?.specialization || "").trim();
  const classSpellsForWindow = useCallback(() => {
    const allSpells = selectedClassDef?.spells || [];
    return allSpells
      .filter((spell) => Number(spell.lvlReq || 0) <= spellVisibilityCap)
      .filter((spell) => {
        const spec = String(spell.spec || "").trim().toLowerCase();
        if (!spec || spec === "common") return true;
        if (!activeSpecialization) return false;
        return spec === activeSpecialization.toLowerCase();
      });
  }, [selectedClassDef, spellVisibilityCap, activeSpecialization]);
  const secondarySkillsForWindow = selectedCharacter.secondaryStats || [];

  useEffect(() => setDisableNavArrows({ left: false, right: true }), []);
  useEffect(() => {
    const currentHp = Number(selectedCharacter.resource?.health?.currentHp || 0);
    const maxHp = Number(selectedCharacter.resource?.health?.maxHp || 0);
    const hpRatio =
      maxHp > 0 && Number.isFinite(currentHp)
        ? Math.max(0, Math.min(1, currentHp / maxHp))
        : null;
    setCombatBadge((prev) => (prev.hpRatio === hpRatio ? prev : { ...prev, hpRatio }));
    return () => {
      setCombatBadge((prev) =>
        prev.hpRatio === null || prev.hpRatio === undefined ? prev : { ...prev, hpRatio: null }
      );
    };
  }, [
    selectedCharacter.resource?.health?.currentHp,
    selectedCharacter.resource?.health?.maxHp,
    setCombatBadge,
  ]);
  useEffect(() => {
    const onSet = (evt: Event) => {
      const detail = (evt as CustomEvent<boolean>).detail;
      setIsLayoutEdit(!isMobileLayout && !!detail);
    };
    window.addEventListener("character-layout-set", onSet as EventListener);
    return () =>
      window.removeEventListener("character-layout-set", onSet as EventListener);
  }, [isMobileLayout]);
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 900;
      setIsNarrowMobile(window.innerWidth < 600);
      setIsMobileLayout(mobile);
      if (mobile) setIsLayoutEdit(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    const renderSpellsWindow: TWindowDescriptorRenderer = (_descriptor, { close, classes }) => (
      <RndContainer
        id="character-spells-window"
        aditionalIcons={null}
        close={close}
        label="Varázslatok"
        className={classes}
      >
        <CharacterSpellsPanel
          spells={classSpellsForWindow()}
          levelCap={spellVisibilityCap}
          selectedSpecialization={activeSpecialization || undefined}
        />
      </RndContainer>
    );
    const renderSecondarySkillsWindow: TWindowDescriptorRenderer = (_descriptor, { close, classes }) => (
      <RndContainer
        id="character-secondary-skills-window"
        aditionalIcons={null}
        close={close}
        label="Képzettségek"
        className={classes}
      >
        <CharacterSecondarySkillsPanel
          secondaryStats={secondarySkillsForWindow}
          currentLevel={selectedCharacter.level?.current || 1}
          spend={
            advId && user?.uid
              ? {
                  advId,
                  uid: user.uid,
                  expectedHash: characterHash,
                  availablePoints: Number(selectedCharacter.secondarySkillPoints || 0),
                  onUpdated: applyCharacterResponse,
                }
              : undefined
          }
        />
      </RndContainer>
    );
    const renderAvatarEditorWindow: TWindowDescriptorRenderer = (_descriptor, { close, classes }) => (
      <RndContainer
        id="character-avatar-editor-window"
        aditionalIcons={null}
        close={close}
        label="Avatar"
        className={classes}
      >
        <FlexCol className="w-full h-full p-1 gap-1">
          <ImageUploadControl
            id="character-avatar-upload-modal"
            label="Avatar"
            value={selectedCharacter.rp?.avatar || null}
            onChange={async (meta) => {
              const nextCharacter = {
                ...selectedCharacter,
                rp: {
                  ...selectedCharacter.rp,
                  avatar: meta,
                },
              };
              if (!user?.uid || !advId) return;
              const patch = buildCharacterPatch(selectedCharacter, nextCharacter);
              if (patch.length < 1) return;
              const response = await characterRequest<
                Character.TCharacterServer | Character.TCharacter
              >({
                endPoint: "/updateAvatar",
                body: {
                  advId,
                  uid: user.uid,
                  expectedHash: characterHash,
                  patch: [{ op: "replace", path: "/rp/avatar", value: meta }],
                },
              });
              applyCharacterResponse(response.data);
            }}
          />
        </FlexCol>
      </RndContainer>
    );
    registerWindowDescriptorRenderer("character-spells", renderSpellsWindow);
    registerWindowDescriptorRenderer("character-secondary-skills", renderSecondarySkillsWindow);
    registerWindowDescriptorRenderer("character-avatar-editor", renderAvatarEditorWindow);

    const onToggleSpells = () => {
      toggleWindow(
        "CHAR_SPELLS",
        defineWindowRegistration({
          id: "CHAR_SPELLS",
          kind: "character-spells",
          title: "Varázslatok",
          icon: "SP",
          defaultOpen: false,
          allowedPages: [PageState.CHAR_SHEET],
          keepStateAcrossPages: true,
          launcherVisible: false,
        })
      );
    };
    const onToggleSecondary = () => {
      toggleWindow(
        "CHAR_SECONDARY_SKILLS",
        defineWindowRegistration({
          id: "CHAR_SECONDARY_SKILLS",
          kind: "character-secondary-skills",
          title: "Képzettségek",
          icon: "SS",
          defaultOpen: false,
          allowedPages: [PageState.CHAR_SHEET],
          keepStateAcrossPages: true,
          launcherVisible: false,
        })
      );
    };
    const onOpenAvatarEditor = () => {
      addWindow(defineWindowRegistration({
        id: "CHAR_AVATAR_EDITOR",
        kind: "character-avatar-editor",
        title: "Avatar",
        icon: "AV",
        defaultOpen: true,
        allowedPages: [PageState.CHAR_SHEET],
        keepStateAcrossPages: true,
      }));
    };
    window.addEventListener("character-toggle-spells", onToggleSpells as EventListener);
    window.addEventListener(
      "character-toggle-secondary-skills",
      onToggleSecondary as EventListener
    );
    window.addEventListener(
      "character-avatar-editor-open",
      onOpenAvatarEditor as EventListener
    );
    return () => {
      unregisterWindowDescriptorRenderer("character-spells", renderSpellsWindow);
      unregisterWindowDescriptorRenderer("character-secondary-skills", renderSecondarySkillsWindow);
      unregisterWindowDescriptorRenderer("character-avatar-editor", renderAvatarEditorWindow);
      window.removeEventListener(
        "character-toggle-spells",
        onToggleSpells as EventListener
      );
      window.removeEventListener(
        "character-toggle-secondary-skills",
        onToggleSecondary as EventListener
      );
      window.removeEventListener(
        "character-avatar-editor-open",
        onOpenAvatarEditor as EventListener
      );
    };
  }, [
    addWindow,
    classSpellsForWindow,
    secondarySkillsForWindow,
    selectedCharacter,
    user?.uid,
    advId,
    characterRequest,
    characterHash,
    applyCharacterResponse,
    toggleWindow,
  ]);
  useEffect(() => {
    if (isMobileLayout) return;
    const host = gridHostRef.current;
    if (!host) return;

    const GAP = 8;
    const PAD = 0;
    const MIN_CELL_W = 30;
    const DENSITY = 3;
    const EFFECTIVE_MIN_CELL_W = Math.max(1, Math.floor(MIN_CELL_W / DENSITY));

    const recalc = () => {
      const outerW = Math.floor(host.clientWidth);
      const innerW = Math.max(1, outerW - PAD * 2);
      const cols = Math.max(1, Math.floor((innerW + GAP) / (EFFECTIVE_MIN_CELL_W + GAP)));
      const cellW = Math.max(1, Math.floor((innerW - GAP * (cols - 1)) / cols));
      // Keep an integer row unit tied to width; matches previous 180x120 ratio.
      const rowH = Math.max(1, Math.floor((cellW * 2) / 3));
      if(gridSpec.cols === cols &&
        gridSpec.cellW === cellW &&
        gridSpec.rowH === rowH &&
        gridSpec.gap === GAP &&
        gridSpec.pad === PAD) return;
      else setGridSpec({ cols, cellW, rowH, gap: GAP, pad: PAD });
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(host);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [isMobileLayout]);

  const fetchCharacter = useCallback(async () => {
    if (!advId || !user?.uid) {
      setIsLoadingCharacter(false);
      return;
    }
    setIsLoadingCharacter(true);
    return characterRequest<Character.TCharacterServer | Character.TCharacter>({
      endPoint: "/get",
      body: {
        advId,
        uid: user.uid,
        createIfMissing: hasCharacterRecord,
      },
      silentStatuses: hasCharacterRecord ? undefined : [404],
      errorMode: "quiet",
    })
      .then((response) => {
        const parsed = applyCharacterResponse(response.data);
        setIsLoadingCharacter(false);
        return parsed;
      })
      .catch((e) => {
        if (e instanceof HttpRequestError && e.status === 404 && !hasCharacterRecord) {
          characterHashRef.current = "";
          setCharacterHash("");
          setComputedCharacter(null);
          setIsLoadingCharacter(false);
          return null;
        }
        setError("Failed to fetch character: " + e, {
          severity: "quiet",
          context: "character:fetch",
        });
        debugLog(e);
        setIsLoadingCharacter(false);
        return null;
      });
  }, [advId, user?.uid, hasCharacterRecord, applyCharacterResponse]);

  useEffect(() => {
    fetchCharacter();
  }, [fetchCharacter]);

  useEffect(() => {
    if (!advId || !user?.uid) {
      setSyncSnapshot(null);
      return;
    }
    setSyncSnapshot({
      advId,
      character: {
        uid: user.uid,
        hash: characterHash,
      },
    });
    return () => setSyncSnapshot(null);
  }, [advId, user?.uid, characterHash, setSyncSnapshot]);

  useSyncStatusSubscription(advId, (payload) => {
    const status = payload.character;
    if (!status || status.uid !== user?.uid) return;
    if (status.status !== "stale" && status.status !== "missing") return;
    if (syncRefreshRef.current) return;
    syncRefreshRef.current = true;
    fetchCharacter()
      .catch((error) => {
        debugLog("Failed to gently refresh stale character data", error);
      })
      .finally(() => {
        syncRefreshRef.current = false;
      });
  });

  useEffect(() => {
    if (!advId) {
      setVendorState(null);
      return;
    }
    adventureRequest<Vendor.TVendorState>({
      endPoint: "/vendor/get",
      body: { advId },
      errorMode: "quiet",
    })
      .then((response) => setVendorState(response.data || null))
      .catch(() => setVendorState(null));
  }, [advId]);

  useAdventureLiveEventSubscription(
    "character:updated",
    advId,
    (payload: {
      uid?: string;
      advId?: string;
      patch?: ServerApi.PatchOperation[] | null;
      character?: unknown;
    }) => {
      const eventUid = String(payload.uid || "");
      if (!eventUid || eventUid !== user?.uid) return;

      if (applyRemoteCharacterPatch(payload.patch || undefined, payload.character)) return;

      const parsedCharacter = parseCharacterPayload(payload.character).json;
      if (parsedCharacter) {
        applyCharacterResponse(payload.character);
        return;
      }
      // Fallback if event has no embedded character payload.
      fetchCharacter();
    }
  );

  const updateBagStorageLayout = useCallback(
    (storageId: string, fallback: TLayoutItem, patch: Partial<TLayoutItem>) => {
      setBagStorageLayout((prev) => {
        const current = prev[storageId] || fallback;
        const next = sanitizeLayoutItem(patch, current);
        return { ...prev, [storageId]: next };
      });
    },
    []
  );

  const applyRemoteCharacterPatch = useCallback(
    (patch: ServerApi.PatchOperation[] | undefined, payload: unknown): boolean => {
      if (!Array.isArray(patch) || patch.length === 0) return false;
      const supported = patch.every((op) => op.op === "replace" && op.path === "/inventory");
      if (!supported) return false;
      const inventoryPatch = patch.find((op) => op.path === "/inventory");
      const nextInventory = inventoryPatch?.value as Character.Item.TInventory | undefined;
      if (!nextInventory) return false;
      const parsed = parseCharacterPayload(payload);
      setSelectedCharacter((prev) => ({
        ...prev,
        inventory: nextInventory,
      }));
      if (parsed.computed) setComputedCharacter(parsed.computed);
      const nextHash = parsed.hash || "";
      characterHashRef.current = nextHash;
      setCharacterHash(nextHash);
      return true;
    },
    []
  );
  useAdventureLiveEventSubscription("vendor:state", advId, (payload: Vendor.TVendorState) => {
    setVendorState(payload);
  });
  useAdventureLiveEventSubscription(
    "vendor:tradeResolved",
    advId,
    (payload: { vendor?: Vendor.TVendorState }) => {
      if (payload.vendor) setVendorState(payload.vendor);
    }
  );
  useAdventureLiveEventSubscription("character:levelup", advId, (payload: TPendingLevelUp) => {
    if (!payload || payload.uid !== user?.uid) return;
    const rows = Array.from({ length: Math.max(0, Number(payload.levelUps || 0)) }, () => ({
      hp: 0,
      resource: 0,
    }));
    setPendingLevelUp(payload);
    setLevelUpStep(0);
    setLevelHpRows(rows);
    setHmAlloc({ ATK: 0, DEF: 0, INI: 0, AIM: 0 });
    setSpecializationChoice(String(selectedCharacter.rp?.specialization || "").trim());
    setLevelUpError("");
  });

  const saveCharacter = useCallback(
    async (
      nextCharacter: Character.TCharacter,
      options?: { createIfMissing?: boolean }
    ) => {
      if (!user?.uid || !advId) return;
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const getValidGuardsOrRefresh = async (): Promise<{ hash: string }> => {
            if (options?.createIfMissing && !hasCharacterRecord) return { hash: "" };
            let hash = String(characterHashRef.current || "");
            if (hash) return { hash };
            await fetchCharacter();
            hash = String(characterHashRef.current || "");
            if (!hash) {
              throw new Error("Missing hash guard after refresh; update aborted");
            }
            return { hash };
          };

          const executeUpdate = async (
            sendPatch: ServerApi.PatchOperation[]
          ) => {
            const guards = await getValidGuardsOrRefresh();
            return characterRequest<Character.TCharacterServer | Character.TCharacter>({
              endPoint: "/update",
              body: {
                advId,
                uid: user.uid,
                expectedHash: guards.hash,
                createIfMissing: options?.createIfMissing,
                patch: sendPatch,
              },
            });
          };

          let baseCharacter: Character.TCharacter = selectedCharacter;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const patch = buildCharacterPatch(baseCharacter, nextCharacter);
            if (patch.length < 1) return;
            try {
              const response = await executeUpdate(patch);
              if (isInventoryOnlyPatch(patch) && applyInventoryResponse(response.data)) {
                return;
              }
              applyCharacterResponse(response.data);
              return;
            } catch (err) {
              if (!isConflictError(err)) throw err;
              const refreshed = await fetchCharacter();
              if (!refreshed) throw err;
              baseCharacter = refreshed;
            }
          }
          throw new Error("Conflict (409): server data changed. Reload latest data and retry.");
        });
      await saveQueueRef.current;
    },
    [
      advId,
      user?.uid,
      fetchCharacter,
      selectedCharacter,
      hasCharacterRecord,
      applyCharacterResponse,
      applyInventoryResponse,
    ]
  );
  useEffect(() => {
    characterHashRef.current = characterHash;
  }, [characterHash]);
  useEffect(() => {
    restRequest<{ entries: Array<{ name: string; value: string }> }>({ endPoint: "getAllReligions", errorMode: "quiet" })
      .then((r) => setReligions(r.data?.entries || []))
      .catch((error) => {
        const msg = `Failed to fetch religions: ${error instanceof Error ? error.message : String(error)}`;
        setError(msg, { severity: "quiet", context: "character:religions-load" });
        debugLog(msg, error);
      });
    restRequest<{ entries: Array<{ name: string; value: string }> }>({ endPoint: "getAllPersonalities", errorMode: "quiet" })
      .then((r) => setPersonalities(r.data?.entries || []))
      .catch((error) => {
        const msg = `Failed to fetch personalities: ${error instanceof Error ? error.message : String(error)}`;
        setError(msg, { severity: "quiet", context: "character:personalities-load" });
        debugLog(msg, error);
      });
    restRequest<{ levels: number[] }>({ endPoint: "getXpLevels", errorMode: "quiet" })
      .then((r) => {
        const parsed = Array.isArray(r.data?.levels)
          ? r.data.levels.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)
          : [];
        if (parsed.length > 0) {
          setXpLevels(parsed);
        }
      })
      .catch((error) => {
        const msg = `Failed to fetch xp levels: ${error instanceof Error ? error.message : String(error)}`;
        setError(msg, { severity: "quiet", context: "character:xp-levels-load" });
        debugLog(msg, error);
      });
  }, []);

  useEffect(() => {
    if (isLoadingCharacter) return;
    const targetPath = "/character";
    if (window.location.pathname !== targetPath) {
      window.history.replaceState({}, "", targetPath);
    }
  }, [isLoadingCharacter]);

  const { equipmentPanel, backpackPanel, bagStoragePanels, defaultStoragePanel, moneyModal, itemHoverModal, itemContextMenu, sellModal } = useInventoryPanels({
    inventory: selectedCharacter.inventory,
    vendorMode: Boolean(vendorState?.enabled),
    defaultCapacity: selectedClassDef?.maxCarriedWeapons,
    onMoneyChange: async (money) => {
      const nextCharacter: Character.TCharacter = {
        ...selectedCharacter,
        inventory: {
          ...selectedCharacter.inventory,
          money,
        },
      };
      await saveCharacter(nextCharacter);
    },
    onInventoryChange: async (inventory) => {
      const nextCharacter: Character.TCharacter = {
        ...selectedCharacter,
        inventory,
      };
      await saveCharacter(nextCharacter);
    },
    onDropItem: async (source) => {
      if (!advId || !user?.uid) return;
      const response = await characterRequest<Character.TCharacterServer | Character.TCharacter>({
        endPoint: "/dropItem",
        body: {
          advId,
          uid: user.uid,
          source,
        },
      });
      if (applyInventoryResponse(response.data)) return;
      applyCharacterResponse(response.data);
    },
    onSellItem: async (source, requestedPriceCopper) => {
      if (!advId || !user?.uid) return;
      await characterRequest<ServerApi.CharacterRoutes.VendorTradeResponse>({
        endPoint: "/sellItem",
        body: {
          advId,
          uid: user.uid,
          source,
          requestedPriceCopper,
        },
      });
    },
    onUseItem: async (source) => {
      if (!advId || !user?.uid) return;
      const response = await characterRequest<Character.TCharacterServer | Character.TCharacter>({
        endPoint: "/useItem",
        body: {
          advId,
          uid: user.uid,
          source,
        },
      });
      if (applyInventoryResponse(response.data)) return;
      applyCharacterResponse(response.data);
    },
    onEquipItem: async (source, targetSlotId, target) => {
      if (!advId || !user?.uid) return;
      const response = await characterRequest<Character.TCharacterServer | Character.TCharacter>({
        endPoint: "/equipItem",
        body: {
          advId,
          uid: user.uid,
          source,
          targetSlotId,
          target,
        },
      });
      if (applyInventoryResponse(response.data)) return;
      applyCharacterResponse(response.data);
    },
  });

  const displayCharacter: Character.TCharacter = {
    ...selectedCharacter,
    hm: computedCharacter?.hm || selectedCharacter.hm,
    primaryStats: computedCharacter?.primaryStats || selectedCharacter.primaryStats,
    secondaryStats: computedCharacter?.secondaryStats || selectedCharacter.secondaryStats,
    resource: computedCharacter?.resource || selectedCharacter.resource,
  };

  const {aurasPanel, damagesPanel} = useAurasAndDamagePanel({
    character: displayCharacter,
    onSave: saveCharacter
  });

  const {headerIdentityInfo, headerOrbs, headerResourceBars} = useHeaderIdentity({
    name: displayCharacter.rp ? displayCharacter.rp.name : "Új karakter",
    descent: displayCharacter.descent || Character.DESCENTS.HUMAN,
    class: displayCharacter.class || Character.CLASSES.WARRIOR,
    lvl: displayCharacter.level ? displayCharacter.level.current : 1,
    avatar: displayCharacter.rp?.avatar || null,
    selectedCharacter: displayCharacter,
    onAvatarClick: () => {
      window.dispatchEvent(new CustomEvent("character-avatar-editor-open"));
    },
  });

  const {PrimaryStats, HMData} = useHeaderStatsPanel({
    selectedCharacter: displayCharacter
  });

  const layoutMaxRow = Math.max(
    layout.header_xp.y + layout.header_xp.h - 1,
    layout.header_identity.y + layout.header_identity.h - 1,
    layout.header_orbs.y + layout.header_orbs.h - 1,
    layout.header_resourcebars.y + layout.header_resourcebars.h - 1,
    layout.header_stats.y + layout.header_stats.h - 1,
    layout.header_hm.y + layout.header_hm.h - 1,
    layout.rp.y + layout.rp.h - 1,
    layout.inventory.y + layout.inventory.h - 1,
    layout.equipment.y + layout.equipment.h - 1,
    layout.auras.y + layout.auras.h - 1,
    layout.damages.y + layout.damages.h - 1,
  );
  const getDefaultBagStorageLayout = (index: number): TLayoutItem => ({
    x: layout.default_storage.x,
    y: layout.default_storage.y + layout.default_storage.h + index * 2,
    w: layout.default_storage.w,
    h: 2,
  });
  const getBagStorageLayout = (storageId: string, index: number): TLayoutItem =>
    bagStorageLayout[storageId] || getDefaultBagStorageLayout(index);
  const bagStorageMaxRow =
    bagStoragePanels.length > 0
      ? Math.max(
          ...bagStoragePanels.map((entry, index) => {
            const itemLayout = getBagStorageLayout(entry.storageId, index);
            return itemLayout.y + itemLayout.h - 1;
          })
        )
      : 0;
  const EDIT_EXTRA_ROWS = 12;
  const contentRows = Math.max(layoutMaxRow, bagStorageMaxRow);
  const editableRows = contentRows + EDIT_EXTRA_ROWS;
  const gridMinHeightRows = isLayoutEdit ? editableRows : contentRows;
  const gridMinHeightPx =
    gridSpec.pad * 2 +
    gridMinHeightRows * gridSpec.rowH +
    Math.max(0, gridMinHeightRows - 1) * gridSpec.gap;
  const characterPanels = {
    headerXp: (
      <HeaderXp
        lvlData={{
          currentLvl: selectedCharacter.level?.current || 1,
          currentXp: selectedCharacter.level?.currentXp || 0,
          levelCap:
            Number((selectedCharacter.level as Character.TLevel & { nextXpMax?: number })?.nextXpMax || 0) > 0
              ? Number((selectedCharacter.level as Character.TLevel & { nextXpMax?: number })?.nextXpMax || 0)
              : (() => {
                  const lvl = Math.max(1, Number(selectedCharacter.level?.current || 1));
                  return Math.max(
                    1,
                    Number(
                      xpLevels[Math.max(0, lvl - 1)] ??
                        Character.LEVEL_CAPS[Math.max(0, lvl - 1)] ??
                        Character.LEVEL_CAPS[Character.LEVEL_CAPS.length - 1] ??
                        1
                    )
                  );
                })(),
        }}
      />
    ),
    headerIdentity: headerIdentityInfo,
    headerOrbs,
    headerResourceBars,
    primaryStats: <PrimaryStats />,
    hmData: <HMData />,
    rp: (
      <RPElement
        rpData={selectedCharacter.rp}
        primaryStats={selectedCharacter.primaryStats}
        primaryStatRolls={selectedClassDef?.modifiers.primaryStats || []}
        hm={selectedCharacter.hm}
        religions={religions}
        personalities={personalities}
        languageOptions={descents.map((d) => d.name)}
        hmBase={hmBaseForWizard}
        hmInitialPoints={hmInitialPointsForWizard}
        disabled={selectedCharacter.initialized}
        onSave={async (nextRp, nextPrimaryStats, nextHm) => {
          const nextCharacter = {
            ...selectedCharacter,
            rp: nextRp,
            primaryStats: nextPrimaryStats,
            hm: nextHm,
          };
          await saveCharacter(nextCharacter);
        }}
      />
    ),
    inventory: backpackPanel,
    bagStorages: bagStoragePanels,
    defaultStorage: defaultStoragePanel,
    equipment: equipmentPanel,
    auras: aurasPanel,
    damages: damagesPanel,
  };
  const mobilePanelOrder: Array<{
    key: string;
    panel: JSX.Element | JSX.Element[];
    className?: string;
  }> = [
    { key: "xp", panel: characterPanels.headerXp, className: "h-5" },
    {
      key: "header",
      panel: (
        <FlexRow className="w-full min-w-0 gap-2 items-stretch">
          <div className="grow min-w-0 min-h-[88px]">{characterPanels.headerIdentity}</div>
          <div className="shrink-0 min-h-[88px]">{characterPanels.headerOrbs}</div>
          <div className="grow min-w-0 min-h-[88px]">{characterPanels.headerResourceBars}</div>
        </FlexRow>
      ),
      className: "min-h-[88px]",
    },
    { key: "stats", panel: characterPanels.primaryStats, className: "" },
    { key: "hm", panel: characterPanels.hmData, className: "" },
    {
      key: "rp",
      panel: characterPanels.rp,
      className: "min-h-0",
    },
    {
      key: "inventory",
      panel: (
        <FlexRow
          className={`w-full min-w-0 gap-2 ${isNarrowMobile ? "flex-col" : "flex-row"}`}
        >
          <div className="flex-1 min-w-0 min-h-0">{characterPanels.defaultStorage}</div>
          {characterPanels.bagStorages.map((entry) => (
            <div key={`mobile-bag-storage-${entry.storageId}`} className="flex-1 min-w-0 min-h-0">
              {entry.panel}
            </div>
          ))}
          <div className="flex-1 min-w-0 min-h-0">{characterPanels.equipment}</div>
        </FlexRow>
      ),
      className: "min-h-0",
    },
    { key: "auras", panel: characterPanels.auras, className: "min-h-[180px]" },
    { key: "damages", panel: characterPanels.damages },
  ];

  if (!isLoadingCharacter && !hasCharacterRecord) {
    return (
      <div className="grow fancy-container overflow-y-auto p-1 relative">
        <NewCharacter
          advId={advId}
          selectedCharacter={selectedCharacter}
          setSelectedCharacter={setSelectedCharacter}
          onCharacterSaved={async (nextCharacter) => {
            await saveCharacter(nextCharacter, { createIfMissing: true });
            setHasCharacterRecord(true);
          }}
        />
      </div>
    );
  }

  const formatRoll = (roll?: Adventure.TRollElements | null): string =>
    formatSharedRoll(roll, {
      diceSeparator: "k",
      includeRollAttempts: true,
      alwaysShowRollAttempts: true,
      defaultDice: Adventure.DICE.SIX,
      fallbackOnFalsyDice: true,
      constantMode: "positive-only",
    });
  const needsSpecializationSelection =
    !!pendingLevelUp &&
    pendingLevelUp.oldLevel < 10 &&
    pendingLevelUp.newLevel >= 10 &&
    !String(selectedCharacter.rp?.specialization || "").trim();

  const totalHmAllocated = hmAlloc.ATK + hmAlloc.DEF + hmAlloc.INI + hmAlloc.AIM;
  const hasResourceLevelUpRoll =
    !!pendingLevelUp?.resourceRoll &&
    (Number(pendingLevelUp.resourceRoll.nrOfDices || 0) > 0 ||
      Number(pendingLevelUp.resourceRoll.constant || 0) !== 0);
  const canGoNextFromHp =
    levelHpRows.length === 0 ||
    levelHpRows.every(
      (r) =>
        Number.isFinite(r.hp) &&
        r.hp >= 0 &&
        (!hasResourceLevelUpRoll ||
          (Number.isFinite(r.resource) && r.resource >= 0))
    );
  const canGoNextFromHm = !pendingLevelUp || totalHmAllocated === pendingLevelUp.hmPoints;

  const applyLevelUpWizard = async () => {
    if (!pendingLevelUp) return;
    if (needsSpecializationSelection && !specializationChoice.trim()) {
      setLevelUpError("Válassz specializációt a 10. szint mentése előtt.");
      return;
    }
    const response = await characterRequest<Character.TCharacterServer | Character.TCharacter>({
      endPoint: "/applyLevelUp",
      body: {
        advId,
        uid: user?.uid,
        hpGains: levelHpRows.map((r) => Number(r.hp || 0)),
        resourceGains: levelHpRows.map((r) =>
          hasResourceLevelUpRoll ? Number(r.resource || 0) : 0
        ),
        hmAlloc,
        levelUps: pendingLevelUp.levelUps,
        specialization: specializationChoice.trim() || undefined,
      },
    });
    const parsed = parseCharacterPayload(response.data);
    const parsedCharacter = parsed.json;
    if (!parsedCharacter) throw new Error("Invalid apply level-up response");
    setSelectedCharacter(parsedCharacter);
    setComputedCharacter(parsed.computed);
    const nextHash = parsed.hash || "";
    characterHashRef.current = nextHash;
    setCharacterHash(nextHash);
    setPendingLevelUp(null);
    setLevelUpError("");
    window.dispatchEvent(new CustomEvent("character-toggle-secondary-skills"));
  };

  return (
    <div className="grow fancy-container overflow-y-auto overflow-x-hidden p-1 relative">
      {isLayoutEdit ? (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
            backgroundSize: `${gridSpec.cellW + gridSpec.gap}px ${gridSpec.rowH + gridSpec.gap}px`,
            backgroundPosition: `${gridSpec.pad}px ${gridSpec.pad}px`,
          }}
        />
      ) : null}
      {isLoadingCharacter && isMobileLayout ? (
        <FlexRow className="w-full justify-center items-center p-2">
          <p>Karakterlap idézése...</p>
        </FlexRow>
      ) : null}
      {!isLoadingCharacter && hasCharacterRecord && isMobileLayout ? (
        <FlexCol className="relative z-10 gap-2 w-full min-w-0">
          {mobilePanelOrder.map((entry) => (
            <div
              key={`mobile-panel-${entry.key}`}
              className={`w-full min-w-0 overflow-auto ${entry.className || ""}`}
            >
              {entry.panel}
            </div>
          ))}
        </FlexCol>
      ) : null}
      {!isMobileLayout ? (
      <div
        ref={gridHostRef}
        className="grid relative z-10"
        style={{
          padding: `${gridSpec.pad}px`,
          gap: `${gridSpec.gap}px`,
          gridTemplateColumns: `repeat(${gridSpec.cols}, ${gridSpec.cellW}px)`,
          gridAutoRows: `${gridSpec.rowH}px`,
          minHeight: `${gridMinHeightPx}px`,
          alignContent: "start",
        }}
      >
      {isLoadingCharacter ? (
        <GridItem x={1} y={1} colSpan={2} rowSpan={1}>
          <FlexRow className="w-full justify-center items-center p-2">
          <p>Karakterlap idézése...</p>
        </FlexRow>
        </GridItem>
      ) : null}
      {!isLoadingCharacter && (
        <>
          {!hasCharacterRecord ? null : (
            <>
              <GridItem
                x={layout.header_xp.x}
                y={layout.header_xp.y}
                colSpan={layout.header_xp.w}
                rowSpan={layout.header_xp.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("header_xp", next)}
              >
                <HeaderXp
                  lvlData={{
                    currentLvl: selectedCharacter.level?.current || 1,
                    currentXp: selectedCharacter.level?.currentXp || 0,
                    levelCap:
                      Number((selectedCharacter.level as Character.TLevel & { nextXpMax?: number })?.nextXpMax || 0) > 0
                        ? Number((selectedCharacter.level as Character.TLevel & { nextXpMax?: number })?.nextXpMax || 0)
                        : (() => {
                      const lvl = Math.max(1, Number(selectedCharacter.level?.current || 1));
                      return Math.max(
                        1,
                        Number(
                          xpLevels[Math.max(0, lvl - 1)] ??
                            Character.LEVEL_CAPS[Math.max(0, lvl - 1)] ??
                            Character.LEVEL_CAPS[Character.LEVEL_CAPS.length - 1] ??
                            1
                        )
                      );
                    })(),
                  }}
                />
              </GridItem>
              <GridItem
                x={layout.header_identity.x}
                y={layout.header_identity.y}
                colSpan={layout.header_identity.w}
                rowSpan={layout.header_identity.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("header_identity", next)}
              >
                {headerIdentityInfo}
              </GridItem>
              <GridItem
                x={layout.header_orbs.x}
                y={layout.header_orbs.y}
                colSpan={layout.header_orbs.w}
                rowSpan={layout.header_orbs.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("header_orbs", next)}
              >
                {headerOrbs}
              </GridItem>
              <GridItem
                x={layout.header_resourcebars.x}
                y={layout.header_resourcebars.y}
                colSpan={layout.header_resourcebars.w}
                rowSpan={layout.header_resourcebars.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("header_resourcebars", next)}
              >
                {headerResourceBars}
              </GridItem>
              <GridItem
                x={layout.header_stats.x}
                y={layout.header_stats.y}
                colSpan={layout.header_stats.w}
                rowSpan={layout.header_stats.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("header_stats", next)}
              >
                <PrimaryStats />
              </GridItem>
              <GridItem
                x={layout.header_hm.x}
                y={layout.header_hm.y}
                colSpan={layout.header_hm.w}
                rowSpan={layout.header_hm.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("header_hm", next)}
              >
                <HMData />
              </GridItem>
              <GridItem
                x={layout.rp.x}
                y={layout.rp.y}
                colSpan={layout.rp.w}
                rowSpan={layout.rp.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("rp", next)}
              >
                <RPElement
                  rpData={selectedCharacter.rp}
                  primaryStats={selectedCharacter.primaryStats}
                  primaryStatRolls={selectedClassDef?.modifiers.primaryStats || []}
                  hm={selectedCharacter.hm}
                  religions={religions}
                  personalities={personalities}
                  languageOptions={descents.map((d) => d.name)}
                  hmBase={hmBaseForWizard}
                  hmInitialPoints={hmInitialPointsForWizard}
                  disabled={selectedCharacter.initialized}
                  onSave={async (nextRp, nextPrimaryStats, nextHm) => {
                    const nextCharacter = {
                      ...selectedCharacter,
                      rp: nextRp,
                      primaryStats: nextPrimaryStats,
                      hm: nextHm,
                    };
                    await saveCharacter(nextCharacter);
                  }}
                />
              </GridItem>
              <GridItem
                x={layout.default_storage.x}
                y={layout.default_storage.y}
                colSpan={layout.default_storage.w}
                rowSpan={layout.default_storage.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("default_storage", next)}
              >
                <>
                  {defaultStoragePanel}
                </>
              </GridItem>
              {bagStoragePanels.map((entry, index) => {
                const itemLayout = getBagStorageLayout(entry.storageId, index);
                const fallbackLayout = getDefaultBagStorageLayout(index);
                return (
                <GridItem
                  key={`bag-storage-grid-${entry.storageId}`}
                  x={itemLayout.x}
                  y={itemLayout.y}
                  colSpan={itemLayout.w}
                  rowSpan={itemLayout.h}
                  editable={isLayoutEdit}
                  grid={gridSpec}
                  onCommit={(next) =>
                    updateBagStorageLayout(entry.storageId, fallbackLayout, next)
                  }
                >
                  {entry.panel}
                </GridItem>
                );
              })}
              <GridItem
                x={layout.equipment.x}
                y={layout.equipment.y}
                colSpan={layout.equipment.w}
                rowSpan={layout.equipment.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("equipment", next)}
              >
                <>
                  {equipmentPanel}
                </>
              </GridItem>
              <GridItem
                x={layout.auras.x}
                y={layout.auras.y}
                colSpan={layout.auras.w}
                rowSpan={layout.auras.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("auras", next)}
              >
                {aurasPanel}
              </GridItem>
              <GridItem
                x={layout.damages.x}
                y={layout.damages.y}
                colSpan={layout.damages.w}
                rowSpan={layout.damages.h}
                editable={isLayoutEdit}
                grid={gridSpec}
                onCommit={(next) => updateLayout("damages", next)}
              >
                {damagesPanel}
              </GridItem>
            </>
          )}
        </>
      )}
      </div>
      ) : null}
      {vendorState?.enabled
        ? createPortal(
            <div className="fixed right-4 top-20 z-[100002] w-[min(420px,92vw)] max-h-[70vh] fancy-container p-2 overflow-auto flex flex-col gap-2">
              <p className="font-semibold">{vendorState.vendorName}</p>
              {(vendorState.items || []).length === 0 ? (
                <p className="text-sm">Nincs tárgy.</p>
              ) : (
                vendorState.items.map((entry) => (
                  <div key={entry.id} className="fancy-container p-2 flex flex-col gap-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{entry.item.name}</p>
                      <MoneyDisplay copper={entry.listedPriceCopper} className="text-xs" />
                    </div>
                    <p className="text-xs">Stock: {entry.remainingStock}</p>
                    <p className="text-xs line-clamp-2">{entry.item.description}</p>
                    <button
                      type="button"
                      className="fancy-container px-2 py-1"
                      disabled={entry.remainingStock < 1}
                      onClick={() => {
                        if (!advId || !user?.uid) return;
                        const ok = window.confirm(`Buy ${entry.item.name} for ${entry.listedPriceCopper} copper?`);
                        if (!ok) return;
                        characterRequest<ServerApi.CharacterRoutes.VendorTradeResponse>({
                          endPoint: "/vendor/buy",
                          body: { advId, uid: user.uid, vendorItemId: entry.id },
                        }).catch((error) => setError("Failed to request purchase: " + error));
                      }}
                    >
                      Buy
                    </button>
                  </div>
                ))
              )}
            </div>,
            document.body
          )
        : null}
      {moneyModal}
      {itemHoverModal}
      {itemContextMenu}
      {sellModal}
      {pendingLevelUp
        ? createPortal(
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100005] p-2">
              <div
                className={`fancy-container p-2 max-w-[95vw] max-h-[90vh] overflow-auto flex flex-col gap-2 ${
                  levelUpStep === 3 ? "w-[min(1120px,95vw)]" : "w-[min(640px,95vw)]"
                }`}
              >
                <p className="font-semibold">
                  Level Up ({pendingLevelUp.oldLevel} {"->"} {pendingLevelUp.newLevel})
                </p>
                {levelUpError ? <p className="text-red-700">{levelUpError}</p> : null}
                {levelUpStep === 0 ? (
                  <div className="flex flex-col gap-2 min-h-0">
                    <p className="text-sm">
                      Dobás szintenként: ÉP `{formatRoll(pendingLevelUp.hpRoll)}`
                      {hasResourceLevelUpRoll
                        ? ` és erőforrás \`${formatRoll(pendingLevelUp.resourceRoll)}\``
                        : ""}
                    </p>
                    <div className="max-h-[320px] overflow-auto border border-slate-500 rounded p-1">
                      {levelHpRows.map((row, idx) => (
                        <div
                          key={`lvlup-hp-${idx}`}
                          className={`grid grid-cols-1 ${
                            hasResourceLevelUpRoll
                              ? "sm:grid-cols-[80px_1fr_1fr]"
                              : "sm:grid-cols-[80px_1fr]"
                          } gap-2 items-center mb-1`}
                        >
                          <p>Szint {pendingLevelUp.oldLevel + idx + 1}</p>
                          <input
                            type="number"
                            min={0}
                            className="px-2 py-1 rounded"
                            placeholder="ÉP gyógyulás"
                            value={row.hp}
                            onInput={(e) => {
                              const value = Math.max(0, Number((e.currentTarget as HTMLInputElement).value || 0));
                              setLevelHpRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, hp: value } : r))
                              );
                            }}
                          />
                          {hasResourceLevelUpRoll ? (
                            <input
                              type="number"
                              min={0}
                              className="px-2 py-1 rounded"
                              placeholder="Erőforrás gyarapodás"
                              value={row.resource}
                              onInput={(e) => {
                                const value = Math.max(0, Number((e.currentTarget as HTMLInputElement).value || 0));
                                setLevelHpRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, resource: value } : r))
                                );
                              }}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {levelUpStep === 1 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm">
                      HM pontok kiosztása: {totalHmAllocated}/{pendingLevelUp.hmPoints}
                    </p>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="text-left p-1">HM</th>
                          <th className="text-right p-1">Jelenlegi</th>
                          <th className="text-right p-1">+</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(["ATK", "DEF", "INI", "AIM"] as const).map((key) => (
                          <tr key={`hm-alloc-${key}`} className="border-t border-slate-400/30">
                            <td className="p-1">{key}</td>
                            <td className="p-1 text-right">
                              {Number(selectedCharacter.hm?.[key] || 0)}
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                min={0}
                                className="px-2 py-1 rounded w-full text-right"
                                value={hmAlloc[key]}
                                onInput={(e) => {
                                  const value = Math.max(0, Number((e.currentTarget as HTMLInputElement).value || 0));
                                  setHmAlloc((prev) => ({ ...prev, [key]: value }));
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {levelUpStep === 3 ? (
                  <CharacterSpecializationModal
                    specs={selectedClassDef?.specs || []}
                    spells={selectedClassDef?.spells || []}
                    selected={specializationChoice}
                    levelCap={spellVisibilityCap}
                    isMobile={isMobileLayout}
                    onSelect={(specName) => {
                      setSpecializationChoice(specName);
                      setLevelUpError("");
                    }}
                  />
                ) : null}
                <div className="flex justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    className="fancy-container px-2 py-1"
                    onClick={() => {
                      setLevelUpError("");
                      setLevelUpStep((prev) => {
                        if (prev <= 0) return 0;
                        if (!needsSpecializationSelection) {
                          if (prev === 1) return 0;
                          return 1;
                        }
                        if (prev === 1) return 0;
                        return 1;
                      });
                    }}
                    disabled={levelUpStep === 0}
                  >
                    Vissza
                  </button>
                  <div className="flex gap-2 flex-wrap">
                    {levelUpStep < (needsSpecializationSelection ? 3 : 1) ? (
                      <button
                        type="button"
                        className="fancy-container px-2 py-1"
                        onClick={() => {
                          if (levelUpStep === 0 && !canGoNextFromHp) {
                            setLevelUpError("Adj meg érvényes ÉP értéket minden szinthez.");
                            return;
                          }
                          if (levelUpStep === 0 && selectedClassDef) {
                            const hpRange = getRollRange(selectedClassDef.modifiers.hpLvlScaling);
                            const resourceRange = getRollRange(
                              selectedClassDef.modifiers.resource?.lvlUp
                            );
                            const invalidHp = levelHpRows.some(
                              (r) => Number(r.hp) < hpRange.minTotal || Number(r.hp) > hpRange.maxTotal
                            );
                            const invalidResource = levelHpRows.some(
                              (r) =>
                                hasResourceLevelUpRoll &&
                                (Number(r.resource) < resourceRange.minTotal ||
                                  Number(r.resource) > resourceRange.maxTotal)
                            );
                            if (invalidHp || invalidResource) {
                              setLevelUpError(
                                hasResourceLevelUpRoll
                                  ? `ÉP tartomány: ${hpRange.minTotal}-${hpRange.maxTotal}, erőforrás tartomány: ${resourceRange.minTotal}-${resourceRange.maxTotal}`
                                  : `ÉP tartomány: ${hpRange.minTotal}-${hpRange.maxTotal}`
                              );
                              return;
                            }
                          }
                          if (levelUpStep === 1 && !canGoNextFromHm) {
                            setLevelUpError(
                              `A HM pontokat teljesen el kell költeni (${totalHmAllocated}/${pendingLevelUp.hmPoints}).`
                            );
                            return;
                          }
                          setLevelUpError("");
                          setLevelUpStep((prev) => {
                            if (!needsSpecializationSelection) {
                              return 1;
                            }
                            if (prev >= 3) return 3;
                            if (prev === 0) return 1;
                            return 3;
                          });
                        }}
                      >
                        Tovább
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="fancy-container px-2 py-1"
                        onClick={applyLevelUpWizard}
                      >
                        Mentés
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}







