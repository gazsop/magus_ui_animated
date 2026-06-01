import RndContainer from "@components/RndContainer";
import { FlexCol } from "@components/Flex";
import { TabComponent } from "@components/GeneralElements";
import { TCloseProps, TRestRequest, TSetError } from "./types";
import { useNamedRestDataset } from "./useNamedRestDataset";

type TRestHandlingWindowProps = TCloseProps & {
  requestData: TRestRequest;
  setError: TSetError;
};

export default function RestHandlingWindow({
  close,
  requestData,
  setError,
}: TRestHandlingWindowProps) {
  const religions = useNamedRestDataset({
    requestData,
    setError,
    getEndPoint: "getAllReligions",
    updateEndPoint: "updateReligions",
    deleteEndPoint: "deleteReligions",
    labelPlural: "religions",
    labelSingular: "religion",
  });
  const personalities = useNamedRestDataset({
    requestData,
    setError,
    getEndPoint: "getAllPersonalities",
    updateEndPoint: "updatePersonalities",
    deleteEndPoint: "deletePersonalities",
    labelPlural: "personalities",
    labelSingular: "personality",
  });

  const Religions = () => (
    <TabComponent
      tabs={[...religions.entries]}
      label="Vallás"
      layout="row"
      editor={true}
      onSave={(tab) => {
        religions.saveEntry(tab);
      }}
      onDelete={(tabName) => {
        religions.deleteEntry(tabName);
      }}
      addNewTab={(name: string) => {
        religions.addLocalEntry(name);
      }}
    />
  );

  const Personalities = () => (
    <TabComponent
      tabs={[...personalities.entries]}
      label="Személyiség"
      layout="row"
      editor={true}
      onSave={(tab) => {
        personalities.saveEntry(tab);
      }}
      onDelete={(tabName) => {
        personalities.deleteEntry(tabName);
      }}
      addNewTab={(name: string) => {
        personalities.addLocalEntry(name);
      }}
    />
  );

  return (
    <RndContainer
      id="rest-handling"
      aditionalIcons={null}
      close={close}
      label="rest-handling"
    >
      <FlexCol className="grow w-full">
        <Religions />
        <Personalities />
      </FlexCol>
    </RndContainer>
  );
}
