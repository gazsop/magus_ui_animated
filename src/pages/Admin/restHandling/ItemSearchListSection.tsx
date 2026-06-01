import { Character } from "@shared/contracts";
import { ButtonUnq, InputUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";
import CheckIcon from "@components/icons/general/CheckIcon";
import SearchIcon from "@components/icons/general/SearchIcon";
import { MoneyDisplay } from "@components/Money";
import { TItemFilter, TItemSort } from "./itemHandlingTypes";

type TItemSearchListSectionProps = {
  search: string;
  setSearch: (value: string) => void;
  sortBy: TItemSort;
  setSortBy: (value: TItemSort) => void;
  filterBy: TItemFilter;
  setFilterBy: (value: TItemFilter) => void;
  listedItems: Character.Item.TItem[];
  selectItemForEdit: (item: Character.Item.TItem) => void;
  onDeleteItem: (item: Character.Item.TItem) => void;
};

export default function ItemSearchListSection({
  search,
  setSearch,
  sortBy,
  setSortBy,
  filterBy,
  setFilterBy,
  listedItems,
  selectItemForEdit,
  onDeleteItem,
}: TItemSearchListSectionProps) {
  return (
    <>
      <FlexRow className="gap-0.5 flex-wrap items-end fancy-container p-0.5 min-w-0 shrink-0">
        <InputUnq
          id="item-search"
          label=""
          svgIcon={<SearchIcon className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          widthOverride="w-full sm:w-64"
        />
        <FlexCol className="w-full sm:w-40 p-1 min-w-0">
          <label className="mb-0.5">Rendezés</label>
          <select
            className="text-black h-[26px] rounded px-1 w-full min-w-0"
            value={sortBy}
            onChange={(e) => setSortBy(e.currentTarget.value as TItemSort)}
          >
            <option value="nameAsc">Név szerint növekvő</option>
            <option value="nameDesc">Név szerint csökkenő</option>
          </select>
        </FlexCol>
        <FlexCol className="w-full sm:w-40 p-1 min-w-0">
          <label className="mb-0.5">Szűrő</label>
          <select
            className="text-black h-[26px] rounded px-1 w-full min-w-0"
            value={filterBy}
            onChange={(e) => setFilterBy(e.currentTarget.value as TItemFilter)}
          >
            <option value="all">Összes</option>
            <option value="consumable">Fogyasztható</option>
            <option value="equippable">Felszerelhető</option>
            <option value="storage">Tároló</option>
          </select>
        </FlexCol>
      </FlexRow>
      <FlexCol className="w-full min-h-[80px] shrink-0 overflow-auto gap-0.5 fancy-container p-0.5">
        {listedItems.length === 0 ? (
          <p>Nincs mentett tárgy.</p>
        ) : (
          listedItems.map((item, index) => (
            <FlexRow
              key={`item-row-${index}-${item.name}`}
              className="items-center justify-between fancy-container px-0.5 py-0.25 gap-0.5 flex-wrap min-w-0"
            >
              <p className="grow min-w-0 break-words">
                {item.name} | felsz.:{item.equipable || "nincs"} | fogy.:
                {item.consumable ? "igen" : "nem"}
              </p>
              <MoneyDisplay copper={Number(item.priceCopper || 0)} className="text-xs" />
              <div
                className="fancy-container p-0.5 cursor-pointer"
                onClick={() => selectItemForEdit(item)}
                title="Kiválasztás szerkesztésre"
              >
                <CheckIcon className="h-4 w-4" />
              </div>
              <ButtonUnq id={`delete-item-${index}`} onClick={() => onDeleteItem(item)}>
                Törlés
              </ButtonUnq>
            </FlexRow>
          ))
        )}
      </FlexCol>
    </>
  );
}
