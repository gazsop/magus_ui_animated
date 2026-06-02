import { JSX, createContext, useContext, useMemo, useState } from "preact/compat";
import { Dispatch, StateUpdater } from "preact/hooks";
import { IOnlineUserBadge } from "@/pages/WindowsLayer";

type ChatTarget = { uid: string; name: string } | null;
type TCombatBadge = { enabled: boolean; turn: number; hpRatio?: number | null };

interface IPresenceUIContext {
  onlineBadges: Record<string, IOnlineUserBadge>;
  setOnlineBadges: Dispatch<StateUpdater<Record<string, IOnlineUserBadge>>>;
  unreadByPeer: Record<string, number>;
  setUnreadByPeer: Dispatch<StateUpdater<Record<string, number>>>;
  chatTarget: ChatTarget;
  setChatTarget: Dispatch<StateUpdater<ChatTarget>>;
  combatBadge: TCombatBadge;
  setCombatBadge: Dispatch<StateUpdater<TCombatBadge>>;
}

const PresenceUIContext = createContext<IPresenceUIContext | null>(null);

export function PresenceUIProvider(props: { children: JSX.Element | JSX.Element[] }) {
  const [onlineBadges, setOnlineBadges] = useState<Record<string, IOnlineUserBadge>>({});
  const [chatTarget, setChatTarget] = useState<ChatTarget>(null);
  const [unreadByPeer, setUnreadByPeer] = useState<Record<string, number>>({});
  const [combatBadge, setCombatBadge] = useState<TCombatBadge>({
    enabled: false,
    turn: 0,
    hpRatio: null,
  });

  const value = useMemo(
    () => ({
      onlineBadges,
      setOnlineBadges,
      unreadByPeer,
      setUnreadByPeer,
      chatTarget,
      setChatTarget,
      combatBadge,
      setCombatBadge,
    }),
    [onlineBadges, unreadByPeer, chatTarget, combatBadge]
  );

  return <PresenceUIContext.Provider value={value}>{props.children}</PresenceUIContext.Provider>;
}

export function usePresenceUI() {
  const ctx = useContext(PresenceUIContext);
  if (!ctx) throw new Error("usePresenceUI must be used inside PresenceUIProvider");
  return ctx;
}
