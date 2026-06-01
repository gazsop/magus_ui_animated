import { JSX } from "preact/jsx-runtime";
import { ErrorProvider } from "../hooks/error";
import { UtilContextProvider } from "../contexts/utilContext";
import { DataContextProvider } from "../contexts/dataContext";
import { SseContextProvider } from "../contexts/sseContext";

export default function AppProviders(props: {
  children: JSX.Element | JSX.Element[];
}) {
  return (
    <ErrorProvider>
      <UtilContextProvider>
        <DataContextProvider>
          <SseContextProvider>{props.children}</SseContextProvider>
        </DataContextProvider>
      </UtilContextProvider>
    </ErrorProvider>
  );
}
