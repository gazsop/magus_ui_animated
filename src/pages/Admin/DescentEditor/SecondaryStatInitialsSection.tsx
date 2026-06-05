import { Character } from "@shared/contracts";
import { Dispatch, StateUpdater } from "preact/hooks";
import SecondaryStatListEditor from "@pages/Admin/components/SecondaryStatListEditor";

export default function SecondaryStatInitialsSection({
  selectedDescent,
  setSelectedDescent,
  toInt,
}: {
  selectedDescent: Character.TDescent;
  setSelectedDescent: Dispatch<StateUpdater<Character.TDescent>>;
  toInt: (value: string, fallback?: number) => number;
}) {
  return (
    <SecondaryStatListEditor
      title="Kezdő képzettségpont"
      idPrefix="descent-secondary-initial"
      stats={selectedDescent.modifiers.secondaryStatScalings}
      toInt={toInt}
      onChange={(next) =>
        setSelectedDescent((prev) => ({
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

