import { Character } from "@shared/contracts";
import { Dispatch, StateUpdater } from "preact/hooks";
import { useState } from "preact/hooks";
import { SingleValue } from "react-select";
import { ButtonUnq, CheckBoxUnq, HTMLOptionData, SelectUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";

export default function AllowedClassesSection({
  selectedDescent,
  setSelectedDescent,
  classList,
}: {
  selectedDescent: Character.TDescent;
  setSelectedDescent: Dispatch<StateUpdater<Character.TDescent>>;
  classList?: { id: string; name: Character.CLASSES }[];
}) {
  const [selectedClassId, setSelectedClassId] = useState<string>("0");
  const [selectedPermission, setSelectedPermission] = useState<boolean>(false);

  return (
    <FlexCol className="gap-1 shrink-0 !min-h-fit">
      <FlexRow className="grow justify-between flex-wrap gap-1 shrink-0 !min-h-fit">
        <SelectUnq<string, SingleValue<HTMLOptionData<string>>>
          id={`DescentHandling-${selectedDescent.id}-classes`}
          label="Classes"
          optionData={
            classList ? classList.map((c) => ({ value: c.id, label: c.name })) : []
          }
          value={
            selectedClassId
              ? {
                  label: classList?.find((cl) => cl.id === selectedClassId)?.name || "",
                  value: selectedClassId,
                }
              : { label: "Select", value: "0" }
          }
          onChange={(e) => {
            if (!e) return;
            setSelectedClassId(e.value);
          }}
        />
        <CheckBoxUnq
          id={`DescentHandling-${selectedDescent.id}-permission`}
          label="KM engedély"
          className="shrink-0"
          onChange={(e) => {
            setSelectedPermission((e.target as HTMLInputElement).checked);
          }}
          value={selectedPermission}
        />
        <ButtonUnq
          id={`DescentHandling-${selectedDescent.id}-addAllowedClass`}
          className="shrink-0"
          onClick={() => {
            if (!selectedClassId || selectedClassId === "0") return;
            setSelectedDescent((prev) => {
              const prevAllowed = prev.allowedClasses || [];
              if (prevAllowed.some((cl) => cl.id === selectedClassId)) return prev;
              return {
                ...prev,
                allowedClasses: [
                  ...prevAllowed,
                  { id: selectedClassId, permission: selectedPermission },
                ],
              };
            });
          }}
        >
          Add
        </ButtonUnq>
      </FlexRow>
      {selectedDescent.allowedClasses?.map((c) => (
        <FlexRow
          key={`allowed-class-${c.id}`}
          className="grow justify-between flex-wrap gap-1 shrink-0 !min-h-fit"
        >
          <label className="w-[120px] shrink-0 truncate">
            {classList?.find((cl) => cl.id === c.id)?.name || ""}
          </label>
          <CheckBoxUnq
            id={`DescentHandling-${selectedDescent.id}-permission-${c.id}`}
            label="Permission"
            className="shrink-0"
            onChange={(e) => {
              const val = (e.target as HTMLInputElement).checked;
              setSelectedDescent((prev) => ({
                ...prev,
                allowedClasses: prev.allowedClasses?.map((cl) =>
                  cl.id === c.id ? { ...cl, permission: val } : cl
                ),
              }));
            }}
            value={c.permission}
          />
          <ButtonUnq
            id={`DescentHandling-${selectedDescent.id}-removeAllowedClass`}
            className="shrink-0"
            onClick={() => {
              setSelectedDescent((prev) => ({
                ...prev,
                allowedClasses: prev.allowedClasses?.filter((cl) => cl.id !== c.id),
              }));
            }}
          >
            X
          </ButtonUnq>
        </FlexRow>
      ))}
    </FlexCol>
  );
}
