import { JSX } from "preact";
import {
  TWindowDescriptor,
  TWindowLauncherGroup,
  TWindowRegistration,
} from "./windowTypes";
import { PageState } from "@/app/navigation";

export type TWindowRegistrationInput = {
  id: string;
  kind: string;
  title: string;
  icon: string;
  iconElement?: JSX.Element;
  params?: Record<string, string>;
  name?: string;
  hasNotification?: boolean;
  defaultOpen?: boolean;
  allowedPages?: PageState[];
  keepStateAcrossPages?: boolean;
  persistentLauncher?: boolean;
  launcherGroup?: TWindowLauncherGroup;
  launcherVisible?: boolean;
};

export const makeTextIcon = (text: string) => <>{text}</>;

export const defineWindowRegistration = (
  input: TWindowRegistrationInput
): TWindowRegistration => {
  const descriptor: TWindowDescriptor = {
    id: input.id,
    kind: input.kind,
    title: input.title,
    icon: input.icon,
    params: input.params,
    defaultOpen: input.defaultOpen,
    allowedPages: input.allowedPages,
    keepStateAcrossPages: input.keepStateAcrossPages,
    persistentLauncher: input.persistentLauncher,
    launcherGroup: input.launcherGroup,
    launcherVisible: input.launcherVisible,
  };

  return {
    name: input.name ?? input.id,
    icon: input.iconElement ?? makeTextIcon(input.icon),
    hasNotification: input.hasNotification,
    defaultOpen: input.defaultOpen,
    allowedPages: input.allowedPages,
    keepStateAcrossPages: input.keepStateAcrossPages,
    persistentLauncher: input.persistentLauncher,
    launcherGroup: input.launcherGroup,
    launcherVisible: input.launcherVisible,
    descriptor,
  };
};
