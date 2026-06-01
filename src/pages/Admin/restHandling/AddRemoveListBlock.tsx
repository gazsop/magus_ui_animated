import { ButtonUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";
import { ComponentChildren } from "preact";

type TAddRemoveListBlockProps<T> = {
  emptyText: string;
  items: T[];
  renderLabel: (item: T, idx: number) => ComponentChildren;
  removeLabel?: string;
  onRemove: (idx: number) => void;
};

export default function AddRemoveListBlock<T>({
  emptyText,
  items,
  renderLabel,
  removeLabel = "Remove",
  onRemove,
}: TAddRemoveListBlockProps<T>) {
  return (
    <FlexCol className="w-full fancy-container p-0.5 gap-0.25 max-h-24 overflow-auto">
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        items.map((item, idx) => (
          <FlexRow key={`list-item-${idx}`} className="items-center justify-between gap-0.5">
            <div className="grow min-w-0 break-words">{renderLabel(item, idx)}</div>
            <ButtonUnq
              id={`remove-list-item-${idx}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(idx);
              }}
            >
              {removeLabel}
            </ButtonUnq>
          </FlexRow>
        ))
      )}
    </FlexCol>
  );
}
