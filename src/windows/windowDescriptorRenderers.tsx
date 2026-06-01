import { JSX } from "preact";
import { useCallback, useState } from "preact/hooks";
import { FlexCol } from "@components/Flex";
import RndContainer from "@components/RndContainer";
import TileMap from "@components/TileMap";
import { ChatDescriptorWindow } from "@contexts/chatWindowsContext";
import { AdminAdventureCharacterDataDescriptorWindow } from "@contexts/adminAdventureCharactersContext";
import useError from "@hooks/error";
import useRequest from "@hooks/request";
import AIChat from "@pages/AIChat";
import Admin from "@pages/Admin/Admin";
import CharacterPage from "@pages/Character/Character";
import Dev from "@pages/Dev";
import SharedAdventureNotes from "@pages/SharedAdventureNotes";
import Wiki from "@pages/Wiki";
import { Application } from "@shared/contracts";
import { AdminClassDescriptorWindow } from "@pages/Admin/CharacterClassHandling";
import { AdminDescentDescriptorWindow } from "@pages/Admin/CharacterDescentHandling";
import ItemHandlingWindow from "@pages/Admin/restHandling/ItemHandlingWindow";
import ProfessionHandlingWindow from "@pages/Admin/restHandling/ProfessionHandlingWindow";
import RestHandlingWindow from "@pages/Admin/restHandling/RestHandlingWindow";
import VendorHandlingWindow from "@pages/Admin/restHandling/VendorHandlingWindow";
import XpLevelHandlingWindow from "@pages/Admin/restHandling/XpLevelHandlingWindow";
import {
  TWindowDescriptor,
  TWindowRenderProps,
} from "./windowTypes";

export type TWindowDescriptorRenderer = (
  descriptor: TWindowDescriptor,
  props: TWindowRenderProps
) => JSX.Element;

const descriptorRenderers: Record<string, TWindowDescriptorRenderer> = {};

export const registerWindowDescriptorRenderer = (
  kind: string,
  renderer: TWindowDescriptorRenderer
) => {
  descriptorRenderers[kind] = renderer;
};

export const unregisterWindowDescriptorRenderer = (
  kind: string,
  renderer: TWindowDescriptorRenderer
) => {
  if (descriptorRenderers[kind] === renderer) {
    delete descriptorRenderers[kind];
  }
};

registerWindowDescriptorRenderer("ai-chat", (_descriptor, props) => (
  <AIChat close={props.close} classes={props.classes} />
));

registerWindowDescriptorRenderer("wiki", (descriptor, props) => (
  <RndContainer
    id={descriptor.id}
    aditionalIcons={null}
    close={props.close}
    minimize={props.minimize}
    label={descriptor.title}
    className={props.classes}
  >
    <Wiki />
  </RndContainer>
));

registerWindowDescriptorRenderer("external-frame", (descriptor, props) => (
  <RndContainer
    id={descriptor.id}
    aditionalIcons={null}
    close={props.close}
    minimize={props.minimize}
    label={descriptor.title}
    className={props.classes}
  >
    <iframe
      src={descriptor.params?.src || "about:blank"}
      className="grow"
      title={descriptor.title}
    />
  </RndContainer>
));

const TileMapDescriptorWindow = ({
  descriptor,
  close,
  minimize,
  classes,
}: {
  descriptor: TWindowDescriptor;
  close: () => void;
  minimize: () => void;
  classes?: string;
}) => {
  const [resizeKey, setResizeKey] = useState(0);
  const handleSizeChange = useCallback(() => {
    setResizeKey((prev) => prev + 1);
  }, []);
  return (
    <RndContainer
      id={descriptor.id}
      aditionalIcons={null}
      close={close}
      minimize={minimize}
      label={descriptor.title}
      className={classes}
      onSizeChange={handleSizeChange}
    >
      <TileMap
        resizeKey={resizeKey}
        advId={descriptor.params?.advId || ""}
        jumpX={descriptor.params?.jumpX}
        jumpY={descriptor.params?.jumpY}
        jumpNonce={descriptor.params?.jumpNonce}
      />
    </RndContainer>
  );
};

registerWindowDescriptorRenderer("tile-map", (descriptor, props) => (
  <TileMapDescriptorWindow
    descriptor={descriptor}
    close={props.close}
    minimize={props.minimize}
    classes={props.classes}
  />
));

registerWindowDescriptorRenderer("shared-notes", (descriptor, props) => (
  <RndContainer
    id={descriptor.id}
    close={props.close}
    minimize={props.minimize}
    label={descriptor.title}
    className={props.classes}
    aditionalIcons={null}
  >
    <SharedAdventureNotes advId={descriptor.params?.advId || ""} mode="shared" />
  </RndContainer>
));

registerWindowDescriptorRenderer("private-notes", (descriptor, props) => (
  <RndContainer
    id={descriptor.id}
    close={props.close}
    minimize={props.minimize}
    label={descriptor.title}
    className={props.classes}
    aditionalIcons={null}
  >
    <SharedAdventureNotes advId={descriptor.params?.advId || ""} mode="private" />
  </RndContainer>
));

registerWindowDescriptorRenderer("chat", (descriptor, props) => (
  <ChatDescriptorWindow
    uid={descriptor.params?.uid || ""}
    name={descriptor.params?.name || descriptor.params?.uid || ""}
    close={props.close}
    classes={props.classes}
  />
));

registerWindowDescriptorRenderer("admin-page", (descriptor, props) => (
  <RndContainer
    id={descriptor.id}
    aditionalIcons={null}
    close={props.close}
    minimize={props.minimize}
    label={descriptor.title}
    className={props.classes}
  >
    <Admin />
  </RndContainer>
));

registerWindowDescriptorRenderer("dev-page", (descriptor, props) => (
  <RndContainer
    id={descriptor.id}
    aditionalIcons={null}
    close={props.close}
    minimize={props.minimize}
    label={descriptor.title}
    className={props.classes}
  >
    <Dev />
  </RndContainer>
));

const AdminRestDescriptorWindow = ({
  descriptor,
  close,
}: {
  descriptor: TWindowDescriptor;
  close: () => void;
}) => {
  const [requestData] = useRequest(Application.REQUEST_CONTROLLER.REST);
  const { setError } = useError();

  if (descriptor.kind === "admin-rest") {
    return <RestHandlingWindow close={close} requestData={requestData} setError={setError} />;
  }
  if (descriptor.kind === "admin-professions") {
    return <ProfessionHandlingWindow close={close} requestData={requestData} setError={setError} />;
  }
  if (descriptor.kind === "admin-items") {
    return <ItemHandlingWindow close={close} requestData={requestData} setError={setError} />;
  }
  if (descriptor.kind === "admin-xp-levels") {
    return <XpLevelHandlingWindow close={close} requestData={requestData} setError={setError} />;
  }
  return <VendorHandlingWindow close={close} requestData={requestData} setError={setError} />;
};

const renderAdminRestDescriptor: TWindowDescriptorRenderer = (descriptor, props) => (
  <AdminRestDescriptorWindow descriptor={descriptor} close={props.close} />
);

[
  "admin-rest",
  "admin-professions",
  "admin-items",
  "admin-xp-levels",
  "admin-vendors",
].forEach((kind) => registerWindowDescriptorRenderer(kind, renderAdminRestDescriptor));

registerWindowDescriptorRenderer("admin-character-viewer", (descriptor, props) => (
  <RndContainer
    id={`char_${descriptor.params?.advId || "0"}_${descriptor.params?.uid || "unknown"}`}
    aditionalIcons={<>AI</>}
    close={props.close}
    minimize={props.minimize}
    label={descriptor.title}
    className={props.classes}
  >
    <CharacterPage advId={descriptor.params?.advId || ""} />
  </RndContainer>
));

registerWindowDescriptorRenderer("admin-descent-editor", (descriptor, props) => (
  <AdminDescentDescriptorWindow
    close={props.close}
    descentId={descriptor.params?.descentId || ""}
  />
));

registerWindowDescriptorRenderer("admin-class-editor", (descriptor, props) => (
  <AdminClassDescriptorWindow
    close={props.close}
    classId={descriptor.params?.classId || ""}
  />
));

registerWindowDescriptorRenderer("admin-adventure-character-data", (descriptor, props) => (
  <AdminAdventureCharacterDataDescriptorWindow
    advId={descriptor.params?.advId || ""}
    uid={descriptor.params?.uid || ""}
    title={descriptor.title}
    close={props.close}
    classes={props.classes}
  />
));

export const renderWindowDescriptor = (
  descriptor: TWindowDescriptor,
  props: TWindowRenderProps
) => {
  const renderer = descriptorRenderers[descriptor.kind];
  if (renderer) return renderer(descriptor, props);

  return (
    <RndContainer
      id={descriptor.id}
      aditionalIcons={null}
      close={props.close}
      minimize={props.minimize}
      label={descriptor.title}
      className={props.classes}
    >
      <FlexCol className="p-3 gap-2 min-w-[260px] max-w-[360px]">
        <p className="font-semibold">{descriptor.title}</p>
        <p className="text-sm">
          This window descriptor is registered, but no renderer exists for
          kind `{descriptor.kind}` yet.
        </p>
        <button className="fancy-container px-2 py-1 self-end" onClick={props.close}>
          Close
        </button>
      </FlexCol>
    </RndContainer>
  );
};
