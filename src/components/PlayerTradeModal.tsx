import { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import AppModal from "@components/AppModal";
import { MoneyAddInput, MoneyDisplay } from "@components/Money";
import useRequest from "@hooks/request";
import { parseCharacterPayload } from "@pages/Character/utils/characterPayload";
import { Application, Character, ServerApi } from "@shared/contracts";
import {
  DEFAULT_STORAGE_ID,
  inventoryMoneyToCopper,
  slotToIndex,
} from "@shared/game";

const EQUIPMENT_SLOT_IDS = [
  "hands",
  "mainHand",
  "head",
  "neck",
  "chest",
  "legs",
  "feet",
  "rings1",
  "rings2",
  "cloak",
  "shoulder",
  "trinket",
  "offHand",
  "bracer",
  "bag",
  "satchel",
] as const;

type TTradeItemRow = {
  key: string;
  source: ServerApi.CharacterRoutes.ItemActionSource;
  name: string;
  location: string;
  amount: number;
};

const sourceKey = (source: ServerApi.CharacterRoutes.ItemActionSource) =>
  `${source.from}:${source.storageId || ""}:${source.index}`;

const flattenTradeItems = (
  inventory?: Character.Item.TInventory
): TTradeItemRow[] => {
  const rows: TTradeItemRow[] = [];
  (inventory?.backpacks || []).forEach((backpack, backpackIndex) => {
    const storageId = String(backpack.id || (backpack.isDefault ? DEFAULT_STORAGE_ID : ""));
    const storageLabel = backpack.label || (backpack.isDefault ? "Default storage" : `Storage ${backpackIndex + 1}`);
    const width = Math.max(1, Number(backpack.size?.sizeX || 1));
    (backpack.items || []).forEach((entry, itemIndex) => {
      const equippedSlotId = entry.placement?.equippedSlotId;
      if (equippedSlotId) {
        const equipmentIndex = EQUIPMENT_SLOT_IDS.indexOf(
          equippedSlotId as (typeof EQUIPMENT_SLOT_IDS)[number]
        );
        if (equipmentIndex < 0) return;
        const source = { from: "equipment" as const, index: equipmentIndex };
        rows.push({
          key: sourceKey(source),
          source,
          name: entry.item?.name || "Item",
          location: `Equipped: ${equippedSlotId}`,
          amount: Math.max(1, Number(entry.amount || 1)),
        });
        return;
      }
      const slot = entry.placement?.slot;
      const index = slot ? slotToIndex(slot, width) : itemIndex;
      const source = {
        from: "storage" as const,
        index,
        storageId: storageId || DEFAULT_STORAGE_ID,
      };
      rows.push({
        key: sourceKey(source),
        source,
        name: entry.item?.name || "Item",
        location: storageLabel,
        amount: Math.max(1, Number(entry.amount || 1)),
      });
    });
  });
  return rows;
};

export default function PlayerTradeModal({
  advId,
  selfUid,
  peerName,
  trade,
  onUpdateOffer,
  onAccept,
  onClose,
}: {
  advId: string;
  selfUid: string;
  peerName: string;
  trade: ServerApi.CharacterRoutes.PlayerTradeState;
  onUpdateOffer: (
    tradeId: string,
    offer: ServerApi.CharacterRoutes.PlayerTradeOffer
  ) => Promise<void>;
  onAccept: (tradeId: string) => Promise<void>;
  onClose: (tradeId: string) => Promise<void>;
}) {
  const [characterRequest] = useRequest(Application.REQUEST_CONTROLLER.CHARACTERS);
  const [character, setCharacter] = useState<Character.TCharacter | null>(null);
  const [moneyCopper, setMoneyCopper] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selfParticipant = trade.participants[selfUid];
  const peerParticipant = Object.values(trade.participants).find((row) => row.uid !== selfUid);
  const isOpen = trade.status === "pending";

  useEffect(() => {
    const offer = selfParticipant?.offer || { items: [], moneyCopper: 0 };
    setMoneyCopper(Math.max(0, Math.floor(Number(offer.moneyCopper || 0))));
    setSelectedKeys(new Set((offer.items || []).map(sourceKey)));
  }, [selfParticipant?.offer]);

  useEffect(() => {
    if (!advId || !selfUid) return;
    characterRequest<Character.TCharacterServer | Character.TCharacter>({
      endPoint: "/get",
      body: { advId, uid: selfUid },
      errorMode: "quiet",
    })
      .then((response) => setCharacter(parseCharacterPayload(response.data).json))
      .catch(() => setCharacter(null));
  }, [advId, selfUid]);

  const rows = useMemo(() => flattenTradeItems(character?.inventory), [character?.inventory]);
  const rowByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows]);
  const currentMoney = inventoryMoneyToCopper(character?.inventory?.money);
  const selectedSources = Array.from(selectedKeys)
    .map((key) => rowByKey.get(key)?.source)
    .filter(Boolean) as ServerApi.CharacterRoutes.ItemActionSource[];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const actions: JSX.Element = (
    <>
      <button
        type="button"
        className="fancy-container px-2 py-1"
        disabled={busy}
        onClick={() => void run(() => onClose(trade.id))}
      >
        Close
      </button>
      {isOpen ? (
        <>
          <button
            type="button"
            className="fancy-container px-2 py-1"
            disabled={busy}
            onClick={() =>
              void run(() =>
                onUpdateOffer(trade.id, {
                  items: selectedSources,
                  moneyCopper,
                })
              )
            }
          >
            Update offer
          </button>
          <button
            type="button"
            className="fancy-container px-2 py-1"
            disabled={busy}
            onClick={() => void run(() => onAccept(trade.id))}
          >
            Accept
          </button>
        </>
      ) : null}
    </>
  );

  return (
    <AppModal
      id={`player-trade-${trade.id}`}
      label={`Trade with ${peerName}`}
      widthClass="w-[min(760px,96vw)]"
      actions={actions}
    >
      <div className="flex flex-col gap-2 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="fancy-container p-2 flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              <p className="font-bold">A te felajánlásod</p>
              <p className={selfParticipant?.accepted ? "text-green-300" : "opacity-70"}>
                {selfParticipant?.accepted ? "Accepted" : "Not accepted"}
              </p>
            </div>
            <MoneyDisplay copper={currentMoney} className="text-xs" />
            <MoneyAddInput
              id={`trade-money-${trade.id}`}
              label="Átadandó pénz"
              valueCopper={moneyCopper}
              onChange={setMoneyCopper}
            />
            <div className="max-h-[42vh] overflow-auto flex flex-col gap-1 pr-1">
              {rows.length === 0 ? (
                <p className="opacity-70 italic">Nincs tárgy.</p>
              ) : (
                rows.map((row) => (
                  <label
                    key={row.key}
                    className="fancy-container p-1 flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(row.key)}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setSelectedKeys((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(row.key);
                          else next.delete(row.key);
                          return next;
                        });
                      }}
                      disabled={!isOpen || busy}
                    />
                    <span className="min-w-0 grow">
                      <span className="font-semibold">{row.name}</span>
                      <span className="opacity-70"> | {row.location}</span>
                      {row.amount > 1 ? <span className="opacity-70"> | x{row.amount}</span> : null}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="fancy-container p-2 flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              <p className="font-bold">{peerName}</p>
              <p className={peerParticipant?.accepted ? "text-green-300" : "opacity-70"}>
                {peerParticipant?.accepted ? "Accepted" : "Not accepted"}
              </p>
            </div>
            <p>Items offered: {peerParticipant?.offer.items.length || 0}</p>
            <MoneyDisplay copper={peerParticipant?.offer.moneyCopper || 0} className="text-xs" />
            <p className="opacity-70">
              Final validation happens when both sides accept. If an item or money is no longer
              available, the trade is rejected by the server.
            </p>
            <p className="opacity-70">Status: {trade.status}</p>
          </div>
        </div>
        {error ? <p className="text-red-300">{error}</p> : null}
      </div>
    </AppModal>
  );
}
