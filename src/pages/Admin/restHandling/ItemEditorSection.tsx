import { Adventure, Character } from "@shared/contracts";
import { ComponentChildren } from "preact";
import { ButtonUnq, InputUnq, TextAreaUnq } from "@components/GeneralElements";
import { FlexCol, FlexRow } from "@components/Flex";
import AuraEditor from "@components/AuraEditor";
import AuraDisplay from "@components/AuraDisplay";
import ImageUploadControl from "@components/ImageUploadControl";
import RollItem from "@components/Roll";
import { TItemAuraDraft, TPrimaryStatDraft } from "./itemHandlingTypes";
import AddRemoveListBlock from "./AddRemoveListBlock";
import { MoneyAddInput } from "@components/Money";

type TItemEditorSectionProps = {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  sizeX: string;
  setSizeX: (v: string) => void;
  sizeY: string;
  setSizeY: (v: string) => void;
  weight: string;
  setWeight: (v: string) => void;
  priceCopper: number;
  setPriceCopper: (v: number) => void;
  maxStack: string;
  setMaxStack: (v: string) => void;
  storageSizeX: string;
  setStorageSizeX: (v: string) => void;
  storageSizeY: string;
  setStorageSizeY: (v: string) => void;
  storageSlotAmount: string;
  setStorageSlotAmount: (v: string) => void;
  autoStorageSlotAmount: string;
  img: string;
  imgMeta: Character.TImageMeta | null;
  setImgMeta: (v: Character.TImageMeta | null) => void;
  setImg: (v: string) => void;
  consumable: boolean;
  setConsumable: (v: boolean) => void;
  createsInventorySpace: boolean;
  setCreatesInventorySpace: (v: boolean) => void;
  equipable: Character.Item.ITEM_TYPE_EQUIPPABLE | "";
  setEquipable: (v: Character.Item.ITEM_TYPE_EQUIPPABLE | "") => void;
  auraDraft: TItemAuraDraft;
  setAuraDraft: (next: TItemAuraDraft) => void;
  auras: TItemAuraDraft[];
  addAura: () => void;
  removeAura: (idx: number) => void;
  primaryStatName: Character.PRIMARY_STATS | "";
  setPrimaryStatName: (v: Character.PRIMARY_STATS | "") => void;
  primaryStatValue: string;
  setPrimaryStatValue: (v: string) => void;
  primaryStats: TPrimaryStatDraft[];
  addPrimaryStat: () => void;
  removePrimaryStat: (idx: number) => void;
  hmAtk: string;
  setHmAtk: (v: string) => void;
  hmDef: string;
  setHmDef: (v: string) => void;
  hmAim: string;
  setHmAim: (v: string) => void;
  hmIni: string;
  setHmIni: (v: string) => void;
  weaponRoll: Adventure.TRollElements;
  setWeaponRoll: (v: Adventure.TRollElements) => void;
  weaponDamages: Adventure.TRollElements[];
  addWeaponDamage: () => void;
  removeWeaponDamage: (idx: number) => void;
  addItem: () => void;
  isSavingItem: boolean;
};

const FieldCol = ({ children }: { children: ComponentChildren }) => (
  <FlexCol className="w-full sm:w-40 lg:w-56 p-1 min-w-0">{children}</FlexCol>
);

export default function ItemEditorSection(props: TItemEditorSectionProps) {
  return (
    <FlexCol className="w-full min-w-0 gap-1 fancy-container p-1 shrink-0">
      <FlexRow className="w-full min-w-0 gap-1 flex-wrap items-start">
        <InputUnq
          id="item-name"
          label="Item name"
          value={props.name}
          onChange={(e) => props.setName(e.currentTarget.value)}
          className="min-w-0"
          widthOverride="w-full sm:w-56"
        />
        <InputUnq
          id="item-sizex"
          label="Size X"
          value={props.sizeX}
          onChange={(e) => props.setSizeX(e.currentTarget.value)}
          className="min-w-0"
          widthOverride="w-full sm:w-28"
        />
        <InputUnq
          id="item-sizey"
          label="Size Y"
          value={props.sizeY}
          onChange={(e) => props.setSizeY(e.currentTarget.value)}
          className="min-w-0"
          widthOverride="w-full sm:w-28"
        />
        <InputUnq
          id="item-weight"
          label="Weight"
          value={props.weight}
          onChange={(e) => props.setWeight(e.currentTarget.value)}
          className="min-w-0"
          widthOverride="w-full sm:w-28"
        />
        <MoneyAddInput
          id="item-price"
          label="Price"
          valueCopper={props.priceCopper}
          onChange={props.setPriceCopper}
          className="w-full sm:w-auto"
        />
        <InputUnq
          id="item-maxstack"
          label="Max stack"
          value={props.maxStack}
          onChange={(e) => props.setMaxStack(e.currentTarget.value)}
          className="min-w-0"
          widthOverride="w-full sm:w-32"
        />
      </FlexRow>

      <TextAreaUnq
        id="item-description"
        label="Description"
        value={props.description}
        onChange={(msg) => props.setDescription(msg)}
        className="w-full min-w-0"
        textAreaClassName="w-full min-w-0"
        keepFocusOnChange={false}
      />

      <FlexRow className="w-full min-w-0 gap-1 flex-wrap items-start">
        <FieldCol>
          <label className="mb-0.5">Equipable</label>
          <select
            className="text-black h-[26px] rounded px-1 w-full min-w-0"
            value={props.equipable}
            onChange={(e) =>
              props.setEquipable(
                (e.currentTarget.value as Character.Item.ITEM_TYPE_EQUIPPABLE | "") || ""
              )
            }
          >
            <option value="">None</option>
            {Object.values(Character.Item.ITEM_TYPE_EQUIPPABLE).map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </FieldCol>
        <FieldCol>
          <label className="mb-0.5">Consumable</label>
          <input
            type="checkbox"
            checked={props.consumable}
            onChange={(e) => props.setConsumable(Boolean(e.currentTarget.checked))}
          />
        </FieldCol>
        <FieldCol>
          <label className="mb-0.5">Creates inventory space</label>
          <input
            type="checkbox"
            checked={props.createsInventorySpace}
            onChange={(e) => props.setCreatesInventorySpace(Boolean(e.currentTarget.checked))}
          />
        </FieldCol>
        {props.equipable === Character.Item.ITEM_TYPE_EQUIPPABLE.STORAGE ||
        props.createsInventorySpace ? (
          <>
            <InputUnq
              id="item-storage-sizex"
              label="Storage X"
              value={props.storageSizeX}
              onChange={(e) => props.setStorageSizeX(e.currentTarget.value)}
              className="min-w-0"
              widthOverride="w-full sm:w-32"
            />
            <InputUnq
              id="item-storage-sizey"
              label="Storage Y"
              value={props.storageSizeY}
              onChange={(e) => props.setStorageSizeY(e.currentTarget.value)}
              className="min-w-0"
              widthOverride="w-full sm:w-32"
            />
            <InputUnq
              id="item-storage-slots"
              label={`Storage slots (auto: ${props.autoStorageSlotAmount})`}
              value={props.storageSlotAmount}
              onChange={(e) => props.setStorageSlotAmount(e.currentTarget.value)}
              className="min-w-0"
              widthOverride="w-full sm:w-52"
            />
          </>
        ) : null}
      </FlexRow>

      <ImageUploadControl
        id="item-img-upload"
        label="Item image"
        value={props.imgMeta}
        fallbackSrc={props.img || "/imgs/item_default.svg"}
        onChange={(meta) => {
          props.setImgMeta(meta);
          props.setImg(meta?.src || "/imgs/item_default.svg");
        }}
      />

      <FlexCol className="w-full min-w-0 gap-1 items-start">
        <div className="w-full min-w-0 fancy-container p-1">
          <p className="mb-1 font-semibold text-sm">Item Aura</p>
          <label className="text-xs flex flex-col gap-0.5 mb-1">
            Apply when
            <select
              className="text-black h-[26px] rounded px-1 w-full sm:w-56"
              value={props.auraDraft.applyWhen || "equipped"}
              onChange={(e) =>
                props.setAuraDraft({
                  ...props.auraDraft,
                  applyWhen: (e.currentTarget.value as Character.Item.TItemAuraApplyWhen) || "equipped",
                })
              }
            >
              <option value="equipped">Equipped only</option>
              <option value="carried">Carried or equipped</option>
            </select>
          </label>
          <AuraEditor
            draft={props.auraDraft}
            onChange={props.setAuraDraft}
            showName={false}
            showColor={false}
          />
        </div>
        <ButtonUnq
          id="add-item-aura"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.addAura();
          }}
          className="w-full sm:w-auto"
        >
          Add aura
        </ButtonUnq>
      </FlexCol>
      <AddRemoveListBlock
        emptyText="No aura."
        items={props.auras}
        renderLabel={(aura) => (
          <AuraDisplay aura={aura} showName={false} showColorDot={false} />
        )}
        removeLabel="Remove"
        onRemove={props.removeAura}
      />

      <FlexRow className="w-full min-w-0 gap-1 flex-wrap items-start">
        <FieldCol>
          <label className="mb-0.5">Primary stat</label>
          <select
            className="text-black h-[26px] rounded px-1 w-full min-w-0"
            value={props.primaryStatName}
            onChange={(e) =>
              props.setPrimaryStatName((e.currentTarget.value as Character.PRIMARY_STATS | "") || "")
            }
          >
            <option value="">None</option>
            {Object.values(Character.PRIMARY_STATS).map((stat) => (
              <option key={stat} value={stat}>
                {stat}
              </option>
            ))}
          </select>
        </FieldCol>
        <InputUnq
          id="item-primary-stat-value"
          label="Primary value"
          value={props.primaryStatValue}
          onChange={(e) => props.setPrimaryStatValue(e.currentTarget.value)}
          className="min-w-0"
          widthOverride="w-full sm:w-40"
        />
        <ButtonUnq id="add-item-primary-stat" onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.addPrimaryStat(); }}>
          Add primary stat
        </ButtonUnq>
      </FlexRow>
      <AddRemoveListBlock
        emptyText="No primary stat modifier."
        items={props.primaryStats}
        renderLabel={(entry) => `${entry.name} | ${entry.value}`}
        removeLabel="Remove"
        onRemove={props.removePrimaryStat}
      />

      <FlexRow className="w-full min-w-0 gap-1 flex-wrap items-start">
        <InputUnq id="item-hm-atk" label="HM ATK" value={props.hmAtk} onChange={(e) => props.setHmAtk(e.currentTarget.value)} className="min-w-0" widthOverride="w-full sm:w-28" />
        <InputUnq id="item-hm-def" label="HM DEF" value={props.hmDef} onChange={(e) => props.setHmDef(e.currentTarget.value)} className="min-w-0" widthOverride="w-full sm:w-28" />
        <InputUnq id="item-hm-aim" label="HM AIM" value={props.hmAim} onChange={(e) => props.setHmAim(e.currentTarget.value)} className="min-w-0" widthOverride="w-full sm:w-28" />
        <InputUnq id="item-hm-ini" label="HM INI" value={props.hmIni} onChange={(e) => props.setHmIni(e.currentTarget.value)} className="min-w-0" widthOverride="w-full sm:w-28" />
      </FlexRow>

      <FlexRow className="w-full min-w-0 gap-1 flex-wrap items-start">
        <RollItem id="item-weapon-damage-roll" hideButton initialValues={props.weaponRoll} addRoll={(roll) => props.setWeaponRoll(roll)} />
        <ButtonUnq id="add-item-weapon-damage" onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.addWeaponDamage(); }}>
          Add weapon/shield damage
        </ButtonUnq>
      </FlexRow>
      <AddRemoveListBlock
        emptyText="No weapon/shield damage."
        items={props.weaponDamages}
        renderLabel={(roll) =>
          `${roll.nrOfDices}k${roll.dice}${
            roll.constant > 0 ? `+${roll.constant}` : roll.constant < 0 ? `${roll.constant}` : ""
          }`
        }
        removeLabel="Remove"
        onRemove={props.removeWeaponDamage}
      />

      <FlexRow className="w-full justify-end">
        <ButtonUnq id="add-item-local" onClick={props.addItem}>
          {props.isSavingItem ? "Saving..." : "Save item"}
        </ButtonUnq>
      </FlexRow>
    </FlexCol>
  );
}
