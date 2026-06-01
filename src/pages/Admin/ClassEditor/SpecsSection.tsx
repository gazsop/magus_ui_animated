import { useState } from "preact/compat";
import { Dispatch, StateUpdater } from "preact/hooks";
import { Character } from "@shared/contracts";
import { ButtonUnq, InputUnq, TextAreaUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";

export default function SpecsSection({
  selectedClass,
  setSelectedClass,
}: {
  selectedClass: Character.TClass;
  setSelectedClass: Dispatch<StateUpdater<Character.TClass>>;
}) {
  const [selectedSpec, setSelectedSpec] = useState<{
    name: string;
    description: string;
  }>({
    name: "",
    description: "",
  });

  return (
    <FlexCol>
      <label>Specs</label>
      <FlexRow className="grow">
        <InputUnq
          id={`char-input-spec-name-${selectedSpec.name}`}
          label="Name"
          value={selectedSpec.name || ""}
          onBlur={(e) => {
            const target = e.target as HTMLInputElement;
            const value = target.value;
            setSelectedSpec((prev) => ({ ...prev, name: value }));
          }}
          layout="flex-col"
        />
        <TextAreaUnq
          id={`char-input-spec-descr-${selectedSpec.name}`}
          label="description"
          value={selectedSpec.description || ""}
          onSave={(e) => {
            if (e === selectedSpec.description) return;
            setSelectedSpec((prev) => ({ ...prev, description: e }));
          }}
          layout="flex-col"
          element="editor"
          className="grow"
        />
        <ButtonUnq
          id="char-add-spec"
          onClick={() => {
            setSelectedClass((prev) => {
              const prevSpecs = prev.specs || [];
              return { ...prev, specs: [...prevSpecs, selectedSpec] };
            });
          }}
        >
          Add
        </ButtonUnq>
      </FlexRow>
      <hr className="fancy my-2" />
      <FlexCol>
        {selectedClass.specs.map((spec) => (
          <FlexCol key={`char-spec-block-${spec.name}-${spec.description}`}>
            <FlexRow>
              <InputUnq
                id={`char-input-spec-${spec.name}`}
                label="Name"
                value={spec.name}
                disabled={false}
                onBlur={(e) => {
                  const target = e.target as HTMLInputElement;
                  const value = target.value;
                  setSelectedClass((prev) => ({
                    ...prev,
                    specs: prev.specs.map((s) =>
                      s === spec ? { ...s, name: value } : s
                    ),
                  }));
                }}
                layout="flex-col"
              />
              <TextAreaUnq
                id={`char-input-spec-descr-${spec.name}`}
                label="Description"
                value={spec.description || ""}
                disabled={false}
                onSave={(e) => {
                  if (e === spec.description) return;
                  setSelectedClass((prev) => ({
                    ...prev,
                    specs: prev.specs.map((s) =>
                      s === spec ? { ...s, description: e } : s
                    ),
                  }));
                }}
                layout="flex-col"
                element="editor"
                className="grow"
              />
              <ButtonUnq
                id={`char-remove-spec-${spec.name}`}
                onClick={() => {
                  setSelectedClass((prev) => ({
                    ...prev,
                    specs: prev.specs.filter((s) => s !== spec),
                  }));
                }}
              >
                Remove
              </ButtonUnq>
            </FlexRow>
            <hr className="fancy my-2" />
          </FlexCol>
        ))}
      </FlexCol>
    </FlexCol>
  );
}
