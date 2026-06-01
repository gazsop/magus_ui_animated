import {
  createContext,
  JSX,
  useContext,
  useEffect,
  useState,
} from "preact/compat";
import useRequest from "../hooks/request";
import { Application, Character, User } from "@shared/contracts";
import { Dispatch, StateUpdater } from "preact/hooks";
import { debugLog } from "@/core/logger";

const extractArrayPayload = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload) as unknown;
      return extractArrayPayload<T>(parsed);
    } catch {
      return [];
    }
  }
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as T[];
  if (Array.isArray(obj.rows)) return obj.rows as T[];
  if (Array.isArray(obj.classes)) return obj.classes as T[];
  if (Array.isArray(obj.descents)) return obj.descents as T[];
  if (obj.data && typeof obj.data === "object") {
    const nested = obj.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data as T[];
    if (Array.isArray(nested.rows)) return nested.rows as T[];
    if (Array.isArray(nested.classes)) return nested.classes as T[];
    if (Array.isArray(nested.descents)) return nested.descents as T[];
  }
  const values = Object.values(obj).filter((v) => !!v && typeof v === "object");
  if (values.length > 0) return values as T[];
  return [];
};

interface IDataContext {
  classes: Character.TClass[];
  descents: Character.TDescent[];
  //user: MutableRef<User.IUserDataServer | null>;
  user: User.IUserDataServer | null;
  setUser: Dispatch<StateUpdater<User.IUserDataServer | null>>;
  refreshCharacterBootstrap: () => Promise<void>;
}

const DataContext = createContext<IDataContext>({
  classes: [],
  descents: [],
  //user: { current: null },
  user: null,
  setUser: () => {},
  refreshCharacterBootstrap: async () => {},
});

export function DataContextProvider(props: {
  children: JSX.Element | JSX.Element[];
}) {
  const [descents, setDescents] = useState<Array<Character.TDescent>>([]);
  const [classes, setClasses] = useState<Array<Character.TClass>>([]);
  const [user, setUser] = useState<User.IUserDataServer | null>(null);

  const [characterRequest] = useRequest(
    Application.REQUEST_CONTROLLER.CHARACTERS
  );

  const refreshCharacterBootstrap = async () => {
    if (!user) return;
    try {
      const [respClass, respDesc] = await Promise.all([
        characterRequest<Array<Character.TClass>>({
          endPoint: "/getAllClasses",
          errorMode: "quiet",
        }),
        characterRequest<Array<Character.TDescent>>({
          endPoint: "/getAllDescents",
          errorMode: "quiet",
        }),
      ]);
      const nextClasses = extractArrayPayload<Character.TClass>(respClass.data);
      const nextDescents = extractArrayPayload<Character.TDescent>(respDesc.data);
      setDescents(nextDescents);
      setClasses(nextClasses);
    } catch (error) {
      debugLog("Failed to fetch character bootstrap data", error);
    }
  };

  useEffect(() => {
    if (!user || (descents.length > 0 && classes.length > 0)) return;
    void refreshCharacterBootstrap();
    const retry = window.setTimeout(() => {
      if (classes.length === 0 || descents.length === 0) {
        void refreshCharacterBootstrap();
      }
    }, 1200);
    return () => window.clearTimeout(retry);
  }, [user, classes.length, descents.length]);

  return (
    <DataContext.Provider
      value={{
        classes,
        descents,
        //user: userRef,
        user,
        setUser,
        refreshCharacterBootstrap,
      }}
    >
      {props.children}
    </DataContext.Provider>
  );
}

export function useDataContext() {
  return useContext(DataContext);
}


