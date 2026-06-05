import { createContext, JSX } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { Application, Character } from "@shared/contracts";
import RndContainer from "@components/RndContainer";
import useError from "@hooks/error";
import useRequest from "@hooks/request";
import { useAdventureLiveEventSubscription } from "@hooks/liveEvents";
import { IWindowsLayerWindowProps } from "@pages/WindowsLayer";
import { PageState } from "@/app/navigation";
import { parseCharacterPayload } from "@pages/Character/utils/characterPayload";
import { withHmDefaults } from "@/utils/hm";
import { defineWindowRegistration } from "@/windows/windowFactory";

export type CharacterIdentity = {
  id: string;
  name: string;
  race: string;
  className: string;
  level: number;
  primaryStats: Character.TPrimaryStat[];
  hm: Character.THm;
  full: Character.TCharacter | null;
  computed: Character.TComputedCharacter | null;
  hash?: string;
};

export const toCharacterIdentity = (
  uid: string,
  parsed: Character.TCharacter | null,
  computed?: Character.TComputedCharacter | null,
  hash?: string
): CharacterIdentity => ({
  id: uid,
  name: parsed?.rp?.name || "Unnamed",
  race: parsed?.descent || "Unknown",
  className: parsed?.class || "Unknown",
  level: parsed?.level?.current || 1,
  primaryStats: computed?.primaryStats || parsed?.primaryStats || [],
  hm: withHmDefaults(computed?.hm || parsed?.hm),
  full: parsed,
  computed: computed || null,
  hash,
});

export const buildAdventureCharacterDataWindowDescriptor = (
  advId: string,
  entry: CharacterIdentity
): IWindowsLayerWindowProps => defineWindowRegistration({
  id: `ADV-CHAR-DATA-${advId}-${entry.id}`,
  kind: "admin-adventure-character-data",
  title: `Character Data - ${entry.name}`,
  icon: "CH",
  params: {
    advId,
    uid: entry.id,
  },
  defaultOpen: true,
  allowedPages: [PageState.CHAR_SHEET],
  keepStateAcrossPages: true,
});

type TAdminAdventureCharactersContext = {
  characters: CharacterIdentity[];
  setCharacters: (updater: CharacterIdentity[] | ((prev: CharacterIdentity[]) => CharacterIdentity[])) => void;
  isLoading: boolean;
  reloadCharacters: () => Promise<void>;
  applyCharacterServerRow: (row: Character.TCharacterServer) => CharacterIdentity | null;
  commitUpdatedCharacter: (
    entry: CharacterIdentity,
    updated: Character.TCharacter,
    computed?: Character.TComputedCharacter | null,
    hash?: string
  ) => CharacterIdentity;
  mapCharacterServerRows: (rows: Character.TCharacterServer[]) => CharacterIdentity[];
  setCharacterDataRenderer: (
    renderer: ((
      entry: CharacterIdentity,
      close: () => void,
      classes?: string
    ) => JSX.Element) | null
  ) => void;
  renderCharacterDataWindow: (
    advId: string,
    uid: string,
    title: string,
    close: () => void,
    classes?: string
  ) => JSX.Element;
};

const AdminAdventureCharactersContext =
  createContext<TAdminAdventureCharactersContext | null>(null);

export function AdminAdventureCharactersProvider({
  advId,
  children,
}: {
  advId: string;
  children: JSX.Element | JSX.Element[];
}) {
  const { setError } = useError();
  const [requestCharacters] = useRequest(Application.REQUEST_CONTROLLER.CHARACTERS);
  const [characters, setCharacters] = useState<CharacterIdentity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const characterDataRendererRef = useRef<(
    entry: CharacterIdentity,
    close: () => void,
    classes?: string
  ) => JSX.Element>();

  const mapCharacterServerRows = (rows: Character.TCharacterServer[]) =>
    (rows || []).map((entry) => {
      const parsed = parseCharacterPayload(entry.json).json;
      const computed =
        "computed" in (entry as object)
          ? (entry as { computed?: Character.TComputedCharacter | null }).computed || null
          : null;
      return toCharacterIdentity(
        entry.uid,
        parsed,
        computed,
        (entry as { hash?: string }).hash
      );
    });

  const reloadCharacters = async () => {
    if (!advId) {
      setCharacters([]);
      return;
    }
    const response = await requestCharacters<Character.TCharacterServer[]>({
      endPoint: "/getAllDetailed",
      body: { advId },
      errorMode: "quiet",
    });
    setCharacters(mapCharacterServerRows(response.data || []));
  };

  const applyCharacterServerRow = (row: Character.TCharacterServer) => {
    const parsed = parseCharacterPayload(row.json);
    if (!parsed.json) return null;
    const nextEntry = toCharacterIdentity(
      row.uid,
      parsed.json,
      parsed.computed,
      (row as { hash?: string }).hash
    );
    setCharacters((prev) => prev.map((entry) => (entry.id === row.uid ? nextEntry : entry)));
    return nextEntry;
  };

  const commitUpdatedCharacter = (
    entry: CharacterIdentity,
    updated: Character.TCharacter,
    computed?: Character.TComputedCharacter | null,
    hash?: string
  ) => {
    const nextEntry = toCharacterIdentity(
      entry.id,
      updated,
      computed ?? entry.computed,
      hash ?? entry.hash
    );
    setCharacters((prev) => prev.map((p) => (p.id === entry.id ? nextEntry : p)));
    return nextEntry;
  };

  const setCharacterDataRenderer: TAdminAdventureCharactersContext["setCharacterDataRenderer"] = (
    renderer
  ) => {
    characterDataRendererRef.current = renderer || undefined;
  };

  const renderCharacterDataWindow: TAdminAdventureCharactersContext["renderCharacterDataWindow"] = (
    windowAdvId,
    uid,
    title,
    close,
    classes
  ) => {
    const entry = characters.find((character) => character.id === uid);
    if (!entry || !characterDataRendererRef.current) {
      return (
        <RndContainer
          id={`adv_char_data_${windowAdvId}_${uid || "missing"}`}
          close={close}
          label={title}
          aditionalIcons={null}
          className={classes}
        >
          <p className="p-2 text-sm opacity-70">
            Character data is not available in the current adventure context.
          </p>
        </RndContainer>
      );
    }
    return characterDataRendererRef.current(entry, close, classes);
  };

  useEffect(() => {
    if (!advId) {
      setCharacters([]);
      return;
    }

    setIsLoading(true);
    reloadCharacters()
      .catch((error) => {
        setError("Failed to fetch adventure characters: " + error, {
          severity: "quiet",
          context: "admin-adventure-characters:load",
        });
        setCharacters([]);
      })
      .finally(() => setIsLoading(false));
  }, [advId]);

  useAdventureLiveEventSubscription(
    "character:updated",
    advId,
    (payload: {
      uid?: string;
      advId?: string;
      character?: unknown;
    }) => {
      const uid = String(payload.uid || "");
      if (!uid) return;
      const parsed = parseCharacterPayload(payload.character);
      if (!parsed.json) return;
      const nextHash =
        parsed.hash ||
        (typeof (payload as { hash?: unknown }).hash === "string"
          ? (payload as { hash: string }).hash
          : undefined);
      let nextEntry: CharacterIdentity | null = null;
      setCharacters((prev) =>
        prev.map((row) => {
          if (row.id !== uid) return row;
          nextEntry = toCharacterIdentity(uid, parsed.json, parsed.computed, nextHash || row.hash);
          return nextEntry;
        })
      );
    }
  );

  return (
    <AdminAdventureCharactersContext.Provider
      value={{
        characters,
        setCharacters,
        isLoading,
        reloadCharacters,
        applyCharacterServerRow,
        commitUpdatedCharacter,
        mapCharacterServerRows,
        setCharacterDataRenderer,
        renderCharacterDataWindow,
      }}
    >
      {children}
    </AdminAdventureCharactersContext.Provider>
  );
}

export function useAdminAdventureCharacters() {
  const ctx = useContext(AdminAdventureCharactersContext);
  if (!ctx) {
    throw new Error(
      "useAdminAdventureCharacters must be used inside AdminAdventureCharactersProvider"
    );
  }
  return ctx;
}

export function AdminAdventureCharacterDataDescriptorWindow({
  advId,
  uid,
  title,
  close,
  classes,
}: {
  advId: string;
  uid: string;
  title: string;
  close: () => void;
  classes?: string;
}) {
  const { renderCharacterDataWindow } = useAdminAdventureCharacters();
  return renderCharacterDataWindow(advId, uid, title, close, classes);
}

