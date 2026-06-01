export enum PageState {
  INIT,
  LOGIN,
  ADMIN,
  CHAR_SELECTION,
  CHAR_SHEET,
  DEV,
}

export const PST_LENGTH = Object.keys(PageState).length / 2;

export enum Change {
  INC,
  DEC,
  STILL,
}

export enum Visibility {
  DISPLAY,
  HIDDEN,
}

export const getNextPageState = (
  prev: PageState,
  direction: Change
): PageState => {
  if (direction === Change.STILL) return prev;

  if (prev === PageState.LOGIN) return PageState.LOGIN;
  if (prev === PageState.CHAR_SELECTION) {
    return direction === Change.DEC ? PageState.LOGIN : PageState.CHAR_SHEET;
  }
  if (prev === PageState.CHAR_SHEET) {
    return direction === Change.DEC ? PageState.CHAR_SELECTION : PageState.CHAR_SHEET;
  }
  return prev;
};

export const PAGE_PATH: Record<PageState, string> = {
  [PageState.INIT]: "/login",
  [PageState.LOGIN]: "/login",
  [PageState.ADMIN]: "/admin",
  [PageState.CHAR_SELECTION]: "/adventures",
  [PageState.CHAR_SHEET]: "/character",
  [PageState.DEV]: "/dev",
};

export const normalizePath = (path: string) => {
  const clean = (path || "/").trim().toLowerCase();
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean;
};

export const pathToPageState = (path: string): PageState => {
  const normalized = normalizePath(path);
  switch (normalized) {
    case "/admin":
      return PageState.ADMIN;
    case "/adventures":
      return PageState.CHAR_SELECTION;
    case "/character":
    case "/character/new":
      return PageState.CHAR_SHEET;
    case "/dev":
      return PageState.DEV;
    case "/login":
    default:
      return PageState.LOGIN;
  }
};
