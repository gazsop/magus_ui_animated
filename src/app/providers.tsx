import { JSX } from "preact/jsx-runtime";
import { ErrorProvider } from "../hooks/error";
import { PopupProvider } from "../hooks/popup";
import { UtilContextProvider } from "../contexts/utilContext";
import { DataContextProvider } from "../contexts/dataContext";
import { SseContextProvider } from "../contexts/sseContext";

export default function AppProviders(props: {
  children: JSX.Element | JSX.Element[];
}) {
  return (
    <ErrorProvider>
      <PopupProvider>
        <UtilContextProvider>
          <DataContextProvider>
            <SseContextProvider>{props.children}</SseContextProvider>
          </DataContextProvider>
        </UtilContextProvider>
      </PopupProvider>
    </ErrorProvider>
  );
}
