import { Adventure } from "@shared/contracts";
import { ButtonUnq, InputUnq, SelectUnq } from "./GeneralElements";
import { FlexRow } from "./Flex";
import { useEffect, useState } from "preact/hooks";

function RollItem(props: {
  id: string;
  addRoll: (roll: Adventure.TRollElements) => void;
  buttonText?: string;
  initialValues?: Adventure.TRollElements;
  hideButton?: boolean;
}) {
  const [rollState, setRollState] = useState<Adventure.TRollElements>({
    nrOfRolls: props.initialValues?.nrOfRolls ?? 1,
    nrOfDices: props.initialValues?.nrOfDices ?? 1,
    dice: props.initialValues?.dice ?? 6,
    constant: props.initialValues?.constant ?? 0,
  });
  useEffect(() => {
    if (!props.initialValues) return;
    setRollState({
      nrOfRolls: props.initialValues.nrOfRolls ?? 1,
      nrOfDices: props.initialValues.nrOfDices ?? 1,
      dice: props.initialValues.dice ?? 6,
      constant: props.initialValues.constant ?? 0,
    });
  }, [
    props.initialValues?.nrOfRolls,
    props.initialValues?.nrOfDices,
    props.initialValues?.dice,
    props.initialValues?.constant,
  ]);

  const emitRoll = (next: Adventure.TRollElements) => {
    setRollState(next);
    if (props.hideButton) props.addRoll(next);
  };

  return (
    <FlexRow>
      <InputUnq
        id={`${props.id}-nrOfRolls`}
        label="nrOfRolls"
        type="number"
        onChange={(e) => {
          emitRoll({
            ...rollState,
            nrOfRolls: Math.max(0, parseInt(e.currentTarget.value) || 0),
          });
        }}
        value={rollState.nrOfRolls}
        className={"w-auto"}
        widthOverride="w-10"
      />
      <InputUnq
        id={`${props.id}-nrOfDices`}
        label="nrOfDices"
        type="number"
        onChange={(e) => {
          emitRoll({
            ...rollState,
            nrOfDices: Math.max(0, parseInt(e.currentTarget.value) || 0),
          });
        }}
        value={rollState.nrOfDices}
        className={"w-auto"}
        widthOverride="w-10"
      />
      <SelectUnq
        id={`${props.id}-dice`}
        label="Dice"
        optionData={Object.values(Adventure.DICE)
          .filter((value) => typeof value === "number")
          .map((c) => {
            return {
              value: c as Adventure.DICE,
              label: c.toString(),
            };
          })}
        onChange={(e) => {
          const selected = e as { value: Adventure.DICE; label: string };
          emitRoll({
            ...rollState,
            dice: (selected?.value || rollState.dice) as Adventure.DICE,
          });
        }}
        value={{
          label: rollState.dice.toString(),
          value: rollState.dice,
        }}
        widthOverride="w-20"
      ></SelectUnq>
      <InputUnq
        id={`${props.id}-constant`}
        label="Flat"
        type="number"
        onChange={(e) => {
          emitRoll({
            ...rollState,
            constant: parseInt(e.currentTarget.value) || 0,
          });
        }}
        value={rollState.constant}
        widthOverride="w-10"
      />
      {!props.hideButton && (
        <ButtonUnq
          id={`${props.id}-addRoll`}
          onClick={() => {
            props.addRoll(rollState);
          }}
        >
          {props.buttonText || "Add"}
        </ButtonUnq>
      )}
    </FlexRow>
  );
}

export default RollItem;
