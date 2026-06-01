import { JSX, createContext, useContext, useMemo, useState } from "preact/compat";
import { Dispatch, StateUpdater } from "preact/hooks";
import { Change, PageState, Visibility, pathToPageState } from "@/app/navigation";

interface IPageFlowContext {
  pSt: PageState;
  setPst: Dispatch<StateUpdater<PageState>>;
  returnPage: PageState | null;
  setReturnPage: Dispatch<StateUpdater<PageState | null>>;
  transitioning: { state: Visibility; direction: Change };
  setTransitioning: Dispatch<StateUpdater<{ state: Visibility; direction: Change }>>;
}

const PageFlowContext = createContext<IPageFlowContext | null>(null);

export function PageFlowProvider(props: { children: JSX.Element | JSX.Element[] }) {
  const [pSt, setPst] = useState<PageState>(() =>
    typeof window !== "undefined" ? pathToPageState(window.location.pathname) : PageState.LOGIN
  );
  const [returnPage, setReturnPage] = useState<PageState | null>(null);
  const [transitioning, setTransitioning] = useState<{
    state: Visibility;
    direction: Change;
  }>({
    state: Visibility.DISPLAY,
    direction: Change.INC,
  });

  const value = useMemo(
    () => ({ pSt, setPst, returnPage, setReturnPage, transitioning, setTransitioning }),
    [pSt, returnPage, transitioning]
  );

  return <PageFlowContext.Provider value={value}>{props.children}</PageFlowContext.Provider>;
}

export function usePageFlow() {
  const ctx = useContext(PageFlowContext);
  if (!ctx) throw new Error("usePageFlow must be used inside PageFlowProvider");
  return ctx;
}
