import { useEffect, useRef, useState, JSX, memo, useMemo, useCallback } from "preact/compat";
import { TSetState } from "./utils/common";
import { LoginForm } from "./pages/Login";
import Character from "./pages/Character/Character";
import { FlexCol, FlexRow } from "./components/Flex";
import { Adventure, Application, User, Vendor } from "@shared/contracts";
import { ServerApi } from "@shared/contracts/server_api";
import {
  IOnlineUserBadge,
  IWindowsLayerShortcut,
  IWindowsLayerWindowProps,
} from "./pages/WindowsLayer";
import AdventureCharacterSelection from "./pages/AdventureCharacterSelection";
import Admin from "./pages/Admin/Admin";
import AdventureGridView from "./pages/Admin/AdventureGridView";
import Dev from "./pages/Dev";
import ArrowLeftSelectionIcon from "./components/icons/general/ArrowLeftSelectionIcon";
import ArrowRightSelectionIcon from "./components/icons/general/ArrowRightSelectionIcon";
import { useUtilContext } from "./contexts/utilContext";
import useError from "./hooks/error";
import usePopup from "./hooks/popup";
import useRequest from "./hooks/request";
import AppProviders from "./app/providers";
import BackgroundDeco from "./components/BackgroundDeco";
import { useDataContext } from "./contexts/dataContext";
import BookOpenIcon from "./components/icons/general/BookOpenIcon";
import SparklesIcon from "./components/icons/general/SparklesIcon";
import GlobeIcon from "./components/icons/general/GlobeIcon";
import LaoyutIcon from "./components/icons/general/LaoyutIcon";
import ListChecklistIcon from "./components/icons/general/ListChecklistIcon";
import SearchIcon from "./components/icons/general/SearchIcon";
import SettingsIcon from "./components/icons/general/SettingsIcon";
import {
  Change,
  getNextPageState,
  PAGE_PATH,
  PageState,
  pathToPageState,
  Visibility,
} from "./app/navigation";
import { setCookie } from "./utils/common";
import { useSseContext } from "./contexts/sseContext";

const transTime = "1000";
import { useAdventureSseSubscription, useSseSubscription } from "./hooks/sse";
import { debugLog } from "@/core/logger";
import { ensurePushSubscription, getPushPermissionState, TPushPermissionState } from "@/utils/push";
import { PresenceUIProvider, usePresenceUI } from "./contexts/presenceUIContext";
import { applyPresenceEvent } from "./contexts/uiReducers";
import { WindowRegistryProvider, useWindowRegistry } from "./contexts/windowRegistryContext";
import { AdminAdventureCharactersProvider } from "./contexts/adminAdventureCharactersContext";
import {
  ChatWindowRegistryBridge,
  ChatWindowsProvider,
  TChatPolicy,
} from "./contexts/chatWindowsContext";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";

const MemoizedCharacter = memo(Character);
const MemoizedAdventureGridView = memo(AdventureGridView);
const LOGGED_IN_PAGES: PageState[] = [
  PageState.CHAR_SELECTION,
  PageState.CHAR_SHEET,
  PageState.ADMIN,
  PageState.DEV,
];
export default function App() {
  return (
    <AppProviders>
      <PresenceUIProvider>
        <AppContent />
        <PwaUpdatePrompt />
      </PresenceUIProvider>
    </AppProviders>
  );
}

function AppContent() {
  const { user } = useDataContext();
  const isSuperAdmin = user?.json?.rank === User.USER_RANK.SUPERADMIN;
  const isAdmin =
    isSuperAdmin ||
    user?.json?.isAdmin === true ||
    user?.json?.rank === User.USER_RANK.ADMIN;
  const [pSt, setPst] = useState<PageState>(() =>
    typeof window !== "undefined"
      ? pathToPageState(window.location.pathname)
      : PageState.LOGIN
  );
  const [returnPage, setReturnPage] = useState<PageState | null>(null);
  const [transitioning, setTransitioning] = useState<{
    state: Visibility;
    direction: Change;
  }>({
    state: Visibility.DISPLAY,
    direction: Change.INC,
  });

  const selectedAdvIdRef = useRef("");
  const selectedAdvHasCharacterRef = useRef(false);
  const [activeAdventureId, setActiveAdventureId] = useState("");
  const historyNavigationRef = useRef(false);
  const hasHydratedRouteRef = useRef(false);
  const { connectGlobal, connectAdventure, disconnectAll } = useSseContext();

  const updatePSt = (change: Change) => {
    setTransitioning({
      state: Visibility.HIDDEN,
      direction: change,
    });
  };

  const pageSelector = () => {
    const login = () => {
      selectedAdvIdRef.current = "";
      setActiveAdventureId("");
      setReturnPage(null);
      setTransitioning({
        state: Visibility.DISPLAY,
        direction: Change.STILL,
      });
    };

    switch (pSt) {
      case PageState.CHAR_SELECTION: {
        return (
          <AdventureCharacterSelection
            isAdmin={isAdmin}
            selectCharacter={(char: string, hasCharacter: boolean) => {
              selectedAdvIdRef.current = char;
              setActiveAdventureId(char);
              selectedAdvHasCharacterRef.current = hasCharacter;
              window.history.replaceState(
                {},
                "",
                isAdmin ? "/admin/adventures" : "/character"
              );
              updatePSt(Change.INC);
            }}
          />
        );
      }
      case PageState.CHAR_SHEET: {
        if (isAdmin) return <MemoizedAdventureGridView advId={selectedAdvIdRef.current} />;
        return (
          <MemoizedCharacter
            advId={selectedAdvIdRef.current}
            expectExistingCharacter={selectedAdvHasCharacterRef.current}
          />
        );
      }
      case PageState.ADMIN:
        return <Admin />;
      case PageState.DEV:
        return <Dev />;
    }
    return <LoginForm loginToInterface={login} />;
  };

  useEffect(() => {
    if (!selectedAdvIdRef.current && pSt === PageState.CHAR_SHEET) {
      setPst(PageState.CHAR_SELECTION);
    }
  }, [pSt]);

  useEffect(() => {
    if (!user?.uid) {
      selectedAdvIdRef.current = "";
      setActiveAdventureId("");
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      disconnectAll();
      return;
    }
    connectGlobal();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    connectAdventure(activeAdventureId);
  }, [user?.uid, activeAdventureId]);

  useEffect(() => {
    const onPopState = () => {
      historyNavigationRef.current = true;
      setPst(pathToPageState(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const targetPath =
      pSt === PageState.CHAR_SHEET
        ? isAdmin
          ? "/admin/adventures"
          : PAGE_PATH[pSt]
        : PAGE_PATH[pSt];
    if (!targetPath) return;
    const currentPath = window.location.pathname;
    const isCharacterPath =
      currentPath === "/character" ||
      currentPath === "/character/new" ||
      currentPath === "/admin/adventures";

    if (!hasHydratedRouteRef.current) {
      hasHydratedRouteRef.current = true;
      if (!(pSt === PageState.CHAR_SHEET && isCharacterPath) && currentPath !== targetPath) {
        window.history.replaceState({}, "", targetPath);
      }
      historyNavigationRef.current = false;
      return;
    }

    if (currentPath === targetPath || (pSt === PageState.CHAR_SHEET && isCharacterPath)) {
      historyNavigationRef.current = false;
      return;
    }

    if (historyNavigationRef.current) {
      historyNavigationRef.current = false;
      return;
    }

    window.history.pushState({}, "", targetPath);
  }, [isAdmin, pSt]);

  return (
    <UIElement
      pSt={pSt}
      activeAdventureId={activeAdventureId}
      returnPage={returnPage}
      setPst={setPst}
      setReturnPage={setReturnPage}
      setTransitioning={setTransitioning}
      transitioning={transitioning}
    >
      <div
        id="page-container"
        className="flex justify-center items-stretch grow relative overflow-hidden"
        style={{ zIndex: "var(--layer-bg)" }}
      >
        {pageSelector()}
      </div>
    </UIElement>
  );
}

function UIElement(props: {
  children: JSX.Element | JSX.Element[];
  pSt: PageState;
  activeAdventureId: string;
  returnPage: PageState | null;
  setPst: TSetState<PageState>;
  setReturnPage: TSetState<PageState | null>;
  setTransitioning: (transitioning: {
    state: Visibility;
    direction: Change;
  }) => void;
  transitioning: { state: Visibility; direction: Change };
}) {
  const {
    pSt,
    activeAdventureId,
    returnPage,
    setPst,
    setReturnPage,
    setTransitioning,
    transitioning,
  } = props;
  const backgroundOffsetX = 10;
  const backgroundOffsetY = 10;
  const { setError } = useError();
  const { setPopup } = usePopup();
  const { disableNavArrows } = useUtilContext();
  const { user, setUser } = useDataContext();
  const [userRequest] = useRequest(Application.REQUEST_CONTROLLER.USERS);
  const [adventureRequest] = useRequest(Application.REQUEST_CONTROLLER.ADVENTURES);
  const [chatRequest] = useRequest(Application.REQUEST_CONTROLLER.CHAT);
  const [pushRequest] = useRequest(Application.REQUEST_CONTROLLER.PUSH);
  const isSuperAdmin = user?.json?.rank === User.USER_RANK.SUPERADMIN;
  const isAdmin =
    isSuperAdmin ||
    user?.json?.isAdmin === true ||
    user?.json?.rank === User.USER_RANK.ADMIN;
  const isLoggedIn = !!user?.uid;
  const [isCharacterLayoutEdit, setIsCharacterLayoutEdit] = useState(false);
  const [chatPolicy, setChatPolicy] = useState<TChatPolicy>({
    allowUserDirect: true,
    allowUserAllRoom: true,
  });
  const [chatPolicyHash, setChatPolicyHash] = useState("");
  const [pushPermission, setPushPermission] = useState<TPushPermissionState>(() =>
    getPushPermissionState()
  );
  const [allChatUsers, setAllChatUsers] = useState<Array<{ uid: string; name: string }>>([]);
  const [vendorPhaseEnabled, setVendorPhaseEnabled] = useState(false);
  const phaseSyncRef = useRef(0);
  const initiativePopupKeyRef = useRef("");
  const maybeShowInitiativePopupRef = useRef<
    (state: {
      enabled?: boolean;
      turn?: number;
      initiatives?: Adventure.TCombatInitiative[];
    }) => void
  >(() => {});
  const {
    onlineBadges,
    setOnlineBadges,
    chatTarget,
    setChatTarget,
    unreadByPeer,
    setUnreadByPeer,
    combatBadge,
    setCombatBadge,
  } = usePresenceUI();

  const maybeShowInitiativePopup = useCallback(
    (state: {
      enabled?: boolean;
      turn?: number;
      initiatives?: Adventure.TCombatInitiative[];
    }) => {
      if (!activeAdventureId || !user?.uid) return;
      if (!state.enabled) {
        initiativePopupKeyRef.current = "";
        return;
      }
      const ownInitiative = (state.initiatives || []).find((row) => row.uid === user.uid);
      if (!ownInitiative) return;
      const turn = Math.max(1, Number(state.turn || 1));
      const hasSubmittedRoll = ownInitiative.rollSubmitted === true || ownInitiative.roll > 0;
      const popupKey = [
        activeAdventureId,
        user.uid,
        turn,
        hasSubmittedRoll ? "submitted" : "pending",
        ownInitiative.roll,
        ownInitiative.baseInitiative,
      ].join(":");
      if (initiativePopupKeyRef.current === popupKey) return;
      initiativePopupKeyRef.current = popupKey;
      if (hasSubmittedRoll) return;
      setPopup({
        label: "Combat initiative",
        text: `${ownInitiative.name}: enter your k10 initiative roll. Base KE: ${ownInitiative.baseInitiative}`,
        input: "",
        save: "Submit",
        showClose: false,
        saveCallback: (inputValue) => {
          const roll = Math.floor(Number(inputValue || 0));
          if (!Number.isFinite(roll) || roll < 1 || roll > 10) {
            setPopup((prev) =>
              prev
                ? {
                    ...prev,
                    error: "Enter a k10 value between 1 and 10.",
                    input: inputValue || "",
                  }
                : prev
            );
            return;
          }
          adventureRequest<
            Adventure.TCombatState,
            ServerApi.AdventureRoutes.SubmitCombatInitiativeBody
          >({
            endPoint: "/combat/initiative",
            body: {
              advId: activeAdventureId,
              roll,
            },
          })
            .then((response) => {
              setPopup(null);
              const nextState = response.data;
              const active = nextState?.enabled === true;
              setCombatBadge(
                active
                  ? {
                      enabled: true,
                      turn: Math.max(1, Number(nextState.turn || 1)),
                    }
                  : { enabled: false, turn: 0 }
              );
              const submitted = (nextState?.initiatives || []).find(
                (row) => row.uid === user.uid
              );
              if (submitted) {
                initiativePopupKeyRef.current = [
                  activeAdventureId,
                  user.uid,
                  Math.max(1, Number(nextState?.turn || 1)),
                  "submitted",
                  submitted.roll,
                  submitted.baseInitiative,
                ].join(":");
              }
            })
            .catch((error) => {
              initiativePopupKeyRef.current = "";
              setError("Failed to submit initiative: " + error);
            });
        },
      });
    },
    [activeAdventureId, adventureRequest, setCombatBadge, setError, setPopup, user?.uid]
  );
  maybeShowInitiativePopupRef.current = maybeShowInitiativePopup;

  const refreshPushPermission = useCallback(() => {
    setPushPermission(getPushPermissionState());
  }, []);

  const requestPushPermission = useCallback(() => {
    ensurePushSubscription(pushRequest)
      .then(() => {
        refreshPushPermission();
      })
      .catch((error) => {
        refreshPushPermission();
        setError("Failed to enable push notifications: " + error);
      });
  }, [pushRequest, refreshPushPermission, setError]);

  useEffect(() => {
    refreshPushPermission();
    if (typeof window === "undefined") return;
    window.addEventListener("focus", refreshPushPermission);
    return () => window.removeEventListener("focus", refreshPushPermission);
  }, [isLoggedIn, refreshPushPermission]);

  useEffect(() => {
    const syncId = phaseSyncRef.current + 1;
    phaseSyncRef.current = syncId;

    if (!isLoggedIn || !activeAdventureId) {
      setCombatBadge({ enabled: false, turn: 0 });
      setVendorPhaseEnabled(false);
      initiativePopupKeyRef.current = "";
      return;
    }
    const advId = activeAdventureId;
    adventureRequest<Adventure.TCombatState>({
      endPoint: "/combat/get",
      body: { advId },
      errorMode: "quiet",
    })
      .then((response) => {
        if (phaseSyncRef.current !== syncId || activeAdventureId !== advId) return;
        const combatState = response.data;
        setCombatBadge({
          enabled: Boolean(combatState?.enabled),
          turn: Math.max(0, Number(combatState?.turn || 0)),
        });
        maybeShowInitiativePopupRef.current(combatState || {});
      })
      .catch(() => {
        if (phaseSyncRef.current !== syncId || activeAdventureId !== advId) return;
        setCombatBadge({ enabled: false, turn: 0 });
      });
    adventureRequest<Vendor.TVendorState>({
      endPoint: "/vendor/get",
      body: { advId },
      errorMode: "quiet",
    })
      .then((response) => {
        if (phaseSyncRef.current !== syncId || activeAdventureId !== advId) return;
        setVendorPhaseEnabled(Boolean(response.data?.enabled));
      })
      .catch(() => {
        if (phaseSyncRef.current !== syncId || activeAdventureId !== advId) return;
        setVendorPhaseEnabled(false);
      });
  }, [activeAdventureId, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      setOnlineBadges({});
      setAllChatUsers([]);
      return;
    }
    userRequest<Array<{ uid: string; name: string }>>({
      endPoint: "/getAll",
      errorMode: "quiet",
    })
      .then((response) => {
        const base: Record<string, IOnlineUserBadge> = {};
        (response.data || []).forEach((u) => {
          if (!u?.uid || !u?.name) return;
          base[u.uid] = { uid: u.uid, name: u.name, active: true };
        });
        setAllChatUsers(
          (response.data || [])
            .filter((u) => u?.uid)
            .map((u) => ({ uid: u.uid, name: u.name || u.uid }))
        );
        setOnlineBadges((prev) => {
          const next: Record<string, IOnlineUserBadge> = {};
          Object.keys(prev).forEach((uid) => {
            const fallback = prev[uid];
            next[uid] = {
              ...fallback,
              name: base[uid]?.name || fallback.name,
            };
          });
          return next;
        });
      })
      .catch((error) => {
        setError("Failed to load users for online toolbar: " + error, {
          severity: "quiet",
          context: "online-toolbar:user-load",
        });
      });
  }, [isLoggedIn]);

  useSseSubscription("user:online", (event) => {
    const payload = (event.payload || {}) as { uid?: string; name?: string };
    setOnlineBadges((prev) => applyPresenceEvent(prev, payload, "upsert"));
  });

  useSseSubscription("user:offline", (event) => {
    const payload = (event.payload || {}) as { uid?: string };
    setOnlineBadges((prev) => applyPresenceEvent(prev, payload, "remove"));
  });

  useSseSubscription("user:logout", (event) => {
    const payload = (event.payload || {}) as { uid?: string };
    setOnlineBadges((prev) => applyPresenceEvent(prev, payload, "remove"));
  });

  useSseSubscription("user:active", (event) => {
    const payload = (event.payload || {}) as { uid?: string; name?: string; active?: boolean };
    const uid = String(payload.uid || "");
    if (!uid) return;
    // Local focus/blur activity pings should be silent for own client UI.
    if (uid === user?.uid) return;
    setOnlineBadges((prev) => applyPresenceEvent(prev, payload, "active"));
  });

  useSseSubscription("connected", (event) => {
    if (event.scope !== "global") return;
    const payload = (event.payload || {}) as {
      onlineUsers?: Array<{ uid: string; name: string; active: boolean }>;
    };
    const onlineUsers = Array.isArray(payload.onlineUsers) ? payload.onlineUsers : [];
    if (onlineUsers.length === 0) return;
    setOnlineBadges((prev) => {
      let next = prev;
      onlineUsers.forEach((u) => {
        if (!u?.uid) return;
        const patched = applyPresenceEvent(
          next,
          { uid: u.uid, name: u.name, active: u.active },
          "active"
        );
        next = patched;
      });
      return next;
    });
  });
  useAdventureSseSubscription(
    "connected",
    activeAdventureId,
    (payload: {
      combat?: {
        enabled?: boolean;
        turn?: number;
        initiatives?: Adventure.TCombatInitiative[];
      };
      vendor?: Vendor.TVendorState;
    }) => {
      if (payload.combat) {
        setCombatBadge({
          enabled: Boolean(payload.combat.enabled),
          turn: Math.max(0, Number(payload.combat.turn || 0)),
        });
        maybeShowInitiativePopup(payload.combat);
      }
      if (payload.vendor) {
        setVendorPhaseEnabled(Boolean(payload.vendor.enabled));
      }
    }
  );
  useAdventureSseSubscription(
    "combat:state",
    activeAdventureId,
    (payload: {
      advId?: string;
      enabled?: boolean;
      turn?: number;
      initiatives?: Adventure.TCombatInitiative[];
    }) => {
      setCombatBadge({
        enabled: Boolean(payload.enabled),
        turn: Math.max(0, Number(payload.turn || 0)),
      });
      maybeShowInitiativePopup(payload);
    }
  );
  useAdventureSseSubscription("vendor:state", activeAdventureId, (payload: Vendor.TVendorState) => {
    setVendorPhaseEnabled(Boolean(payload.enabled));
  });
  useAdventureSseSubscription(
    "chat:policy",
    activeAdventureId,
    (payload: {
      advId?: string;
      policy?: Partial<TChatPolicy>;
    }) => {
      setChatPolicy({
        allowUserDirect: payload.policy?.allowUserDirect !== false,
        allowUserAllRoom: payload.policy?.allowUserAllRoom !== false,
      });
      setChatPolicyHash(String((payload as { hash?: string }).hash || ""));
    }
  );
  const pinnedWindows: IWindowsLayerWindowProps[] = useMemo(() => [
    {
      name: "AI Chat",
      icon: <SparklesIcon className="w-4 h-4" />,
      descriptor: {
        id: "AI Chat",
        kind: "ai-chat",
        title: "AI Chat",
        icon: "AI",
        defaultOpen: false,
        allowedPages: LOGGED_IN_PAGES,
        keepStateAcrossPages: true,
        launcherGroup: "general",
      },
    },
    {
      name: "YNEV",
      icon: <GlobeIcon className="w-4 h-4" />,
      descriptor: {
        id: "YNEV",
        kind: "tile-map",
        title: "YNEV",
        icon: "YN",
        params: {
          advId: activeAdventureId,
        },
        defaultOpen: false,
        allowedPages: LOGGED_IN_PAGES,
        keepStateAcrossPages: true,
        launcherGroup: "general",
      },
    },
    {
      name: "Wiki",
      icon: <SearchIcon className="w-4 h-4" />,
      descriptor: {
        id: "Wiki",
        kind: "wiki",
        title: "Wiki",
        icon: "WK",
        defaultOpen: false,
        allowedPages: LOGGED_IN_PAGES,
        keepStateAcrossPages: true,
        launcherGroup: "general",
      },
    },
    ...(isAdmin
      ? [
          {
            name: "Admin",
            icon: <SettingsIcon className="w-4 h-4" />,
            descriptor: {
              id: "Admin",
              kind: "admin-page",
              title: "Admin",
              icon: "AD",
              defaultOpen: false,
              allowedPages: LOGGED_IN_PAGES,
              keepStateAcrossPages: true,
              launcherGroup: "admin" as const,
            },
          },
        ]
      : []),
    ...(isSuperAdmin
      ? [
          {
            name: "Dev",
            icon: <>DV</>,
            descriptor: {
              id: "Dev",
              kind: "dev-page",
              title: "Dev",
              icon: "DV",
              defaultOpen: false,
              allowedPages: LOGGED_IN_PAGES,
              keepStateAcrossPages: true,
              launcherGroup: "admin" as const,
            },
          },
        ]
      : []),
  ], [activeAdventureId, isAdmin, isSuperAdmin]);

  useEffect(() => {
    if (!isLoggedIn || !activeAdventureId) {
      setChatPolicy({ allowUserDirect: true, allowUserAllRoom: true });
      setChatPolicyHash("");
      return;
    }
    chatRequest<TChatPolicy & { hash?: string }>({
      endPoint: "/getPolicy",
      body: { advId: activeAdventureId },
    })
      .then((response) => {
        setChatPolicy({
          allowUserDirect: response.data?.allowUserDirect !== false,
          allowUserAllRoom: response.data?.allowUserAllRoom !== false,
        });
        setChatPolicyHash(response.data?.hash || "");
      })
      .catch(() => {
        setChatPolicy({ allowUserDirect: true, allowUserAllRoom: true });
        setChatPolicyHash("");
      });
  }, [isLoggedIn, activeAdventureId]);

  const chatLaunchersMuted = !chatPolicy.allowUserDirect || !chatPolicy.allowUserAllRoom;
  const mutedChatLauncherStyle = useMemo(
    () =>
      chatLaunchersMuted
        ? { backgroundColor: "rgba(0, 0, 0, 0.5)" }
        : undefined,
    [chatLaunchersMuted]
  );

  const shortcuts: IWindowsLayerShortcut[] = useMemo(() => [
    ...(isLoggedIn
      ? [
          {
            name:
              pushPermission === "granted"
                ? "Push permission enabled"
                : pushPermission === "denied"
                  ? "Push permission blocked"
                  : pushPermission === "unsupported"
                    ? "Push unsupported"
                    : "Enable push permission",
            icon: <>PP</>,
            launcherGroup: "general" as const,
            style: {
              backgroundColor:
                pushPermission === "granted"
                  ? "rgba(22, 163, 74, 0.9)"
                  : "rgba(220, 38, 38, 0.9)",
              color: "white",
            },
            className: "font-bold text-xs",
            onClick: requestPushPermission,
          } as IWindowsLayerShortcut,
        ]
      : []),
    ...(activeAdventureId && isAdmin
      ? (() => {
          return [{
            name: `Chat Policy (${chatPolicy.allowUserDirect ? "D:on" : "D:off"} ${chatPolicy.allowUserAllRoom ? "A:on" : "A:off"})`,
            icon: <>CP</>,
            launcherGroup: "chat" as const,
            style: mutedChatLauncherStyle,
            onClick: () => {
              // Admin policy switch intentionally cycles only between:
              // 1) full chat enabled (direct + all-room), and
              // 2) full user write lock (direct + all-room disabled).
              const sequence: TChatPolicy[] = [
                { allowUserDirect: true, allowUserAllRoom: true },
                { allowUserDirect: false, allowUserAllRoom: false },
              ];
              const index = sequence.findIndex(
                (item) =>
                  item.allowUserDirect === chatPolicy.allowUserDirect &&
                  item.allowUserAllRoom === chatPolicy.allowUserAllRoom
              );
              const next = sequence[(index + 1) % sequence.length];
              chatRequest<TChatPolicy & { hash?: string }>({
                endPoint: "/setPolicy",
                body: {
                  advId: activeAdventureId,
                  expectedHash: chatPolicyHash,
                  patch: [
                    { op: "replace", path: "/allowUserDirect", value: next.allowUserDirect },
                    { op: "replace", path: "/allowUserAllRoom", value: next.allowUserAllRoom },
                  ],
                },
              })
                .then((response) => {
                  setChatPolicy({
                    allowUserDirect: response.data?.allowUserDirect !== false,
                    allowUserAllRoom: response.data?.allowUserAllRoom !== false,
                  });
                  setChatPolicyHash(response.data?.hash || "");
                })
                .catch(() => {});
            },
          } as IWindowsLayerShortcut];
        })()
      : []),
    ...(pSt === PageState.CHAR_SHEET && !isAdmin
      ? [
          {
            name: "Spells Panel",
            icon: <BookOpenIcon className="w-4 h-4" />,
            launcherGroup: "page" as const,
            onClick: () => {
              window.dispatchEvent(new CustomEvent("character-toggle-spells"));
            },
          },
          {
            name: "Secondary Skills Panel",
            icon: <ListChecklistIcon className="w-4 h-4" />,
            launcherGroup: "page" as const,
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent("character-toggle-secondary-skills")
              );
            },
          },
          ...(combatBadge.enabled
            ? [
                {
                  name: "Combat Turn",
                  icon: (
                    <div className="w-5 h-5 rounded-full bg-red-700 border border-red-900 text-white text-[11px] flex items-center justify-center font-bold leading-none">
                      {Math.max(1, Number(combatBadge.turn || 1))}
                    </div>
                  ),
                  launcherGroup: "page" as const,
                  onClick: () => {},
                } as IWindowsLayerShortcut,
              ]
            : []),
          {
            name: isCharacterLayoutEdit ? "Layout Lock" : "Layout Edit",
            launcherGroup: "page" as const,
            icon: <LaoyutIcon className="w-4 h-4" />,
            onClick: () => {
              const next = !isCharacterLayoutEdit;
              setIsCharacterLayoutEdit(next);
              window.dispatchEvent(
                new CustomEvent("character-layout-set", { detail: next })
              );
            },
          },
        ]
      : []),
  ], [isLoggedIn, pushPermission, requestPushPermission, activeAdventureId, chatPolicy.allowUserDirect, chatPolicy.allowUserAllRoom, mutedChatLauncherStyle, pSt, isAdmin, combatBadge.enabled, combatBadge.turn, isCharacterLayoutEdit]);
  const showWindowSystem = pSt !== PageState.LOGIN;
  const onlineUserBadges = useMemo(() => {
    const baseByUid = new Map<string, IOnlineUserBadge>();
    allChatUsers
      .filter((u) => u.uid && u.uid !== user?.uid)
      .forEach((u) => {
        const presence = onlineBadges[u.uid];
        const status = presence ? (presence.active ? "active" : "inactive") : "offline";
        baseByUid.set(u.uid, {
          uid: u.uid,
          name: presence?.name || u.name || u.uid,
          active: status === "active",
          status,
          style: mutedChatLauncherStyle,
        });
      });
    Object.values(onlineBadges)
      .filter((u) => u.uid && u.uid !== user?.uid && !baseByUid.has(u.uid))
      .forEach((u) => {
        baseByUid.set(u.uid, {
          ...u,
          active: u.active !== false,
          status: u.active === false ? "inactive" : "active",
          style: mutedChatLauncherStyle,
        });
      });

    return Array.from(baseByUid.values()).map((u) => ({
      ...u,
      onClick: () => setChatTarget({ uid: u.uid, name: u.name }),
      hasNotification: (unreadByPeer[u.uid] || 0) > 0,
    }));
  }, [onlineBadges, allChatUsers, user?.uid, setChatTarget, unreadByPeer, mutedChatLauncherStyle]);
  const onlineUserBadgesWithAll = useMemo(() => [
    {
      uid: "__all",
      name: "All",
      active: true,
      status: "active" as const,
      onClick: () => setChatTarget({ uid: "__all", name: "All Room" }),
      hasNotification: (unreadByPeer.__all || 0) > 0,
      style: mutedChatLauncherStyle,
    },
    ...onlineUserBadges,
  ], [onlineUserBadges, unreadByPeer.__all, setChatTarget, mutedChatLauncherStyle]);
  const isAdventureSurface =
    pSt === PageState.CHAR_SHEET ||
    (pSt === PageState.ADMIN && window.location.pathname === "/admin/adventures");

  useEffect(() => {
    if (!isLoggedIn && pSt !== PageState.LOGIN) {
      setPst(PageState.LOGIN);
      return;
    }
    if (isLoggedIn && pSt === PageState.LOGIN) {
      setPst(PageState.CHAR_SELECTION);
      return;
    }
    if (!isAdmin && pSt === PageState.ADMIN) {
      setPst(returnPage ?? PageState.CHAR_SELECTION);
      setReturnPage(null);
      return;
    }
    if (!isSuperAdmin && pSt === PageState.DEV) {
      setPst(returnPage ?? PageState.CHAR_SELECTION);
      setReturnPage(null);
    }
  }, [isAdmin, isSuperAdmin, isLoggedIn, pSt, returnPage, setPst, setReturnPage]);

  return (
    <div
      className={`flex justify-center items-stretch w-screen`}
      style={{
        backgroundImage: `url(/imgs/bg_parchment_4.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: `${backgroundOffsetY + 10}px ${backgroundOffsetX + 10}px`,
        height: `100vh`,
        maxHeight: `100dvh`,
      }}
    >
      {isAdventureSurface && (combatBadge.enabled || vendorPhaseEnabled) ? (
        <div
          className="fixed top-0 left-0 w-screen h-screen pointer-events-none"
          style={{
            zIndex: 10000,
            backgroundColor: combatBadge.enabled ? "rgba(255, 0, 0, 0.07)" : "transparent",
            boxShadow: combatBadge.enabled
              ? "inset 0 0 60px rgb(249, 113, 113)"
              : "inset 0 0 60px rgb(255, 255, 255)",
          }}
        />
      ) : null}
      {showWindowSystem ? (
        <ChatWindowsProvider
          selfUid={user?.uid || ""}
          activeAdventureId={activeAdventureId}
          isAdmin={isAdmin}
          chatPolicy={chatPolicy}
          target={chatTarget}
          onTargetHandled={() => setChatTarget(null)}
          unreadByPeer={unreadByPeer}
          setUnreadByPeer={setUnreadByPeer}
        >
          <AdminAdventureCharactersProvider advId={activeAdventureId}>
            <WindowRegistryProvider
              windows={pinnedWindows}
              shortcuts={shortcuts}
              onlineUsers={onlineUserBadgesWithAll}
              currentPage={pSt}
            >
              <SharedAdventureNotesWindowBridge activeAdventureId={activeAdventureId} />
              <YnevWindowBridge activeAdventureId={activeAdventureId} />
              <ChatWindowRegistryBridge />
              {((pSt === PageState.ADMIN || pSt === PageState.DEV) &&
                returnPage !== null && (
                  <FlexRow className="absolute left-6 top-6 z-50">
                    <button
                      className="fancy-container px-3 py-1"
                      onClick={() => {
                        setPst(returnPage);
                        setReturnPage(null);
                      }}
                    >
                      Back
                    </button>
                  </FlexRow>
                )) || <></>}
              <div
                className={`opacity-100 transition duration-${transTime} self-center absolute left-0 top-1/2`}
                style={{
                  zIndex: "var(--layer-arrows)",
                }}
              >
              <div
                onClick={() => {
                    const previousPage = getNextPageState(pSt, Change.DEC);
                    if (pSt === PageState.ADMIN || previousPage === PageState.LOGIN) {
                      setPopup({
                        label: "Logout",
                        text: "Are you sure you want to logout?",
                        save: "Logout",
                        saveCallback: () => {
                          userRequest<User.IUserDataServer>({
                            endPoint: "/logout",
                          })
                            .then(() => {
                              setPopup(null);
                              setCookie("keepLogged", "false", 0);
                              setUser(null);
                              setReturnPage(null);
                              setPst(PageState.LOGIN);
                            })
                            .catch((error) => {
                              setError("Failed to logout: " + error);
                              debugLog("Failed to logout:", error);
                            });
                        },
                      });
                    } else {
                      setTransitioning({
                        state: Visibility.HIDDEN,
                        direction: Change.DEC,
                      });
                    }
                  }}
                  className={`text-gray-400 hover:text-black flex justify-center items-center focus:outline-none cursor-pointer transition duration-${transTime}
						  ${disableNavArrows.left && "select-none pointer-events-none opacity-25"}`}
                >
                  <ArrowLeftSelectionIcon className="w-[12px]" />
                </div>
              </div>
              <FlexCol
                className={`w-full relative grow transition-opacity duration-${transTime} ${
                  Visibility[transitioning.state] === "HIDDEN"
                    ? "opacity-0"
                    : "opacity-100"
                }`}
                onTransitionEnd={() => {
                  if (transitioning.state === Visibility.HIDDEN) {
                    setPst((prev) => getNextPageState(prev, transitioning.direction));
                    setTransitioning({
                      state: Visibility.DISPLAY,
                      direction: Change.STILL,
                    });
                  }
                }}
              >
                {props.children}
              </FlexCol>
              <div
                className={`opacity-100 transition duration-${transTime} self-center absolute right-0 top-1/2`}
                style={{
                  zIndex: "var(--layer-arrows)",
                }}
              >
                <div
                  onClick={() =>
                    setTransitioning({
                      state: Visibility.HIDDEN,
                      direction: Change.INC,
                    })
                  }
                  className={`text-gray-400 hover:text-black flex justify-center items-center focus:outline-none cursor-pointer transition duration-${transTime}${
                    disableNavArrows.right &&
                    "select-none pointer-events-none opacity-25"
                  }`}
                >
                  <ArrowRightSelectionIcon className="w-[12px]" />
                </div>
              </div>
            </WindowRegistryProvider>
          </AdminAdventureCharactersProvider>
        </ChatWindowsProvider>
      ) : (
        <FlexCol className="w-full relative grow">{props.children}</FlexCol>
      )}
      <BackgroundDeco
        backgroundOffsetX={backgroundOffsetX}
        backgroundOffsetY={backgroundOffsetY}
      />
    </div>
  );
}

function SharedAdventureNotesWindowBridge({
  activeAdventureId,
}: {
  activeAdventureId: string;
}) {
  const { registerWindow, updateWindow } = useWindowRegistry();
  const initializedRef = useRef(false);

  useEffect(() => {
    const createNotesWindow = (
      name: "Shared Notes" | "Private Notes",
      kind: "shared-notes" | "private-notes",
      icon: "NT" | "PN"
    ): IWindowsLayerWindowProps => ({
      name,
      icon: <>{icon}</>,
      defaultOpen: false,
      persistentLauncher: true,
      allowedPages: [PageState.CHAR_SHEET],
      keepStateAcrossPages: true,
      launcherGroup: "page",
      descriptor: {
        id: name,
        kind,
        title: name,
        icon,
        params: {
          advId: activeAdventureId,
        },
        defaultOpen: false,
        persistentLauncher: true,
        allowedPages: [PageState.CHAR_SHEET],
        keepStateAcrossPages: true,
        launcherGroup: "page",
      },
    });
    const windowDefs = [
      createNotesWindow("Shared Notes", "shared-notes", "NT"),
      createNotesWindow("Private Notes", "private-notes", "PN"),
    ];

    if (!initializedRef.current) {
      windowDefs.forEach(registerWindow);
      initializedRef.current = true;
      return;
    }
    windowDefs.forEach((windowDef) => {
      if (!windowDef.name) return;
      updateWindow(windowDef.name, windowDef);
    });
  }, [activeAdventureId, registerWindow, updateWindow]);

  return null;
}

function YnevWindowBridge({
  activeAdventureId,
}: {
  activeAdventureId: string;
}) {
  const { registerWindow, updateWindow } = useWindowRegistry();

  useEffect(() => {
    const buildYnevWindow = (jump?: { x: number; y: number; nonce: string }): IWindowsLayerWindowProps => ({
      name: "YNEV",
      icon: <GlobeIcon className="w-4 h-4" />,
      defaultOpen: Boolean(jump),
      persistentLauncher: true,
      allowedPages: LOGGED_IN_PAGES,
      keepStateAcrossPages: true,
      launcherGroup: "general",
      descriptor: {
        id: "YNEV",
        kind: "tile-map",
        title: "YNEV",
        icon: "YN",
        params: {
          advId: activeAdventureId,
          ...(jump
            ? {
                jumpX: String(jump.x),
                jumpY: String(jump.y),
                jumpNonce: jump.nonce,
              }
            : {}),
        },
        defaultOpen: Boolean(jump),
        persistentLauncher: true,
        allowedPages: LOGGED_IN_PAGES,
        keepStateAcrossPages: true,
        launcherGroup: "general",
      },
    });
    updateWindow("YNEV", buildYnevWindow());
    const handleJump = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const x = Number(detail.x);
      const y = Number(detail.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const advId = String(detail.advId || activeAdventureId);
      if (advId && activeAdventureId && advId !== activeAdventureId) return;
      registerWindow(
        buildYnevWindow({
          x,
          y,
          nonce: String(detail.nonce || Date.now()),
        })
      );
    };
    window.addEventListener("ynev:jump", handleJump);
    return () => window.removeEventListener("ynev:jump", handleJump);
  }, [activeAdventureId, registerWindow, updateWindow]);

  return null;
}
