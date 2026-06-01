import { useState } from "preact/hooks";
import RndContainer from "@components/RndContainer";
import { FlexCol, FlexRow } from "@components/Flex";
import { ButtonUnq, InputUnq } from "@components/GeneralElements";
import { TCloseProps, TRestRequest, TSetError } from "./types";
import { useNamedRestDataset } from "./useNamedRestDataset";

type TProfessionHandlingWindowProps = TCloseProps & {
  requestData: TRestRequest;
  setError: TSetError;
};

export default function ProfessionHandlingWindow({
  close,
  requestData,
  setError,
}: TProfessionHandlingWindowProps) {
  const [newProfession, setNewProfession] = useState("");
  const professions = useNamedRestDataset({
    requestData,
    setError,
    getEndPoint: "getAllProfessions",
    updateEndPoint: "updateProfessions",
    deleteEndPoint: "deleteProfessions",
    labelPlural: "professions",
    labelSingular: "profession",
  });

  return (
    <RndContainer
      id="profession-handling"
      aditionalIcons={null}
      close={close}
      label="profession-handling"
    >
      <FlexCol className="grow w-full p-1 gap-0.5">
        <FlexRow className="items-end gap-0.5">
          <InputUnq
            id="new-profession-name"
            label="Új szakma"
            value={newProfession}
            onChange={(e) => setNewProfession(e.currentTarget.value)}
          />
          <ButtonUnq
            id="add-profession"
            onClick={() => {
              const name = newProfession.trim();
              if (!name) return;
              professions.saveEntry({ name, value: "" }, { clear: () => setNewProfession("") });
            }}
          >
            Hozzáadás
          </ButtonUnq>
        </FlexRow>
        <FlexCol className="grow overflow-auto gap-0.5">
          {professions.entries.length === 0 ? (
            <p>Nincs mentett szakma.</p>
          ) : (
            professions.entries.map((entry) => (
              <FlexRow
                key={`profession-${entry.name}`}
                className="items-center justify-between fancy-container px-0.5 py-0.25"
              >
                <p className="grow">{entry.name}</p>
                <ButtonUnq
                  id={`delete-profession-${entry.name}`}
                  onClick={() => {
                    professions.deleteEntry(entry.name);
                  }}
                >
                  Törlés
                </ButtonUnq>
              </FlexRow>
            ))
          )}
        </FlexCol>
      </FlexCol>
    </RndContainer>
  );
}
