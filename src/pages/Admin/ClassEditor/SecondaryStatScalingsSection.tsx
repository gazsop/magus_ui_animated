import { Character } from "@shared/contracts";
import { Dispatch, StateUpdater } from "preact/hooks";
import SecondaryStatListEditor from "@pages/Admin/components/SecondaryStatListEditor";

export default function SecondaryStatScalingsSection({
  selectedClass,
  setSelectedClass,
  toInt,
}: {
  selectedClass: Character.TClass;
  setSelectedClass: Dispatch<StateUpdater<Character.TClass>>;
  toInt: (value: string, fallback?: number) => number;
}) {
  return (
    <SecondaryStatListEditor
      title="Képzettségpont per szint"
      idPrefix="class-secondary-scaling"
      stats={selectedClass.modifiers.secondaryStatScalings}
      toInt={toInt}
      onChange={(next) =>
        setSelectedClass((prev) => ({
          ...prev,
          modifiers: {
            ...prev.modifiers,
            secondaryStatScalings: next,
          },
        }))
      }
    />
  );
}

