import { JSX } from "preact/jsx-runtime";
import { ErrorProvider } from "../hooks/error";
import { PopupProvider } from "../hooks/popup";
import { UtilContextProvider } from "../contexts/utilContext";
import { DataContextProvider } from "../contexts/dataContext";
import { LiveEventsProvider } from "../contexts/liveEventsContext";

export default function AppProviders(props: {
  children: JSX.Element | JSX.Element[];
}) {
  return (
    <ErrorProvider>
      <PopupProvider>
        <UtilContextProvider>
          <DataContextProvider>
            <LiveEventsProvider>{props.children}</LiveEventsProvider>
          </DataContextProvider>
        </UtilContextProvider>
      </PopupProvider>
    </ErrorProvider>
  );
}

