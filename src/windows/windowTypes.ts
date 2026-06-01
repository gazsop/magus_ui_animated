import { JSX } from "preact";
import { PageState } from "@/app/navigation";

export type TWindowLauncherGroup = "general" | "admin" | "page" | "chat";

export type TWindowRenderProps = {
  close: () => void;
  selectWindow: () => void;
  classes?: string;
};

export type TWindowDescriptor = {
  id: string;
  kind: string;
  title: string;
  icon: string;
  params?: Record<string, string>;
  launcherGroup?: TWindowLauncherGroup;
  allowedPages?: PageState[];
  keepStateAcrossPages?: boolean;
  persistentLauncher?: boolean;
  launcherVisible?: boolean;
  defaultOpen?: boolean;
};

type TWindowRegistrationCommon = {
  defaultOpen?: boolean;
  name?: string;
  icon?: JSX.Element;
  hasNotification?: boolean;
  persistentLauncher?: boolean;
  allowedPages?: PageState[];
  keepStateAcrossPages?: boolean;
  launcherGroup?: TWindowLauncherGroup;
  launcherVisible?: boolean;
};

export type TDescriptorWindowRegistration = TWindowRegistrationCommon & {
  descriptor: TWindowDescriptor;
};

export type TWindowRegistration = TDescriptorWindowRegistration;

export type TWindowState = {
  name: string;
  icon: JSX.Element;
  descriptor: TWindowDescriptor;
  defaultOpen?: boolean;
  hasNotification?: boolean;
  persistentLauncher?: boolean;
  allowedPages?: PageState[];
  keepStateAcrossPages?: boolean;
  launcherGroup?: TWindowLauncherGroup;
  launcherVisible?: boolean;
  isOpen: boolean;
  basePersistentLauncher: boolean;
};
