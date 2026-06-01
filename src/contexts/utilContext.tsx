import {
  createContext,
  JSX,
  useContext,
  useState,
} from "preact/compat";
import { TSetState } from "@/utils/common";

interface IUtil {
  disableNavArrows: {
    left: boolean;
    right: boolean;
  };
  setDisableNavArrows: TSetState<{
    left: boolean;
    right: boolean;
  }>;
}

const UtilContext = createContext<IUtil>({
  disableNavArrows: {
    left: false,
    right: false,
  },
  setDisableNavArrows: () => {},
});

export function UtilContextProvider(props: {
  children: JSX.Element | JSX.Element[];
}) {
  const [disableNavArrows, setDisableNavArrows] = useState<{
    left: boolean;
    right: boolean;
  }>({ left: false, right: false });

  return (
    <UtilContext.Provider
      value={{
        disableNavArrows,
        setDisableNavArrows,
      }}
    >
      {props.children}
    </UtilContext.Provider>
  );
}

export function useUtilContext() {
  return useContext(UtilContext);
}
