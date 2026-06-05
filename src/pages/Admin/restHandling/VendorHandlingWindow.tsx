import { useEffect, useMemo, useState } from "preact/compat";
import { Character, ServerApi, Vendor } from "@shared/contracts";
import { TCloseProps, TRestRequest, TSetError, toErrorMessage } from "./types";
import RndContainer from "@components/RndContainer";
import { MoneyAddInput } from "@components/Money";

type TVendorResponse = {
  vendors: Vendor.TVendor[];
  hash: string;
};

type TProps = TCloseProps & {
  requestData: TRestRequest;
  setError: TSetError;
};

const emptyVendor = (): Vendor.TVendor => ({
  id: "",
  name: "",
  sellRate: 1,
  buyRate: 0.5,
  items: [],
});

export default function VendorHandlingWindow({ close, requestData, setError }: TProps) {
  const [vendors, setVendors] = useState<Vendor.TVendor[]>([]);
  const [items, setItems] = useState<Character.Item.TItem[]>([]);
  const [hash, setHash] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Vendor.TVendor>(emptyVendor);
  const [selectedItemName, setSelectedItemName] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === selectedId) || null,
    [vendors, selectedId]
  );

  const load = async () => {
    const [vendorResponse, itemResponse] = await Promise.all([
      requestData<TVendorResponse>({ endPoint: "/getAllVendors" }),
      requestData<{ items: Character.Item.TItem[]; hash?: string }>({ endPoint: "/getAllItems" }),
    ]);
    setVendors(vendorResponse.data?.vendors || []);
    setHash(vendorResponse.data?.hash || "");
    setItems(itemResponse.data?.items || []);
  };

  useEffect(() => {
    load().catch((error) => setError("Failed to load vendors: " + toErrorMessage(error)));
  }, []);

  useEffect(() => {
    if (!selectedVendor) return;
    setDraft(JSON.parse(JSON.stringify(selectedVendor)) as Vendor.TVendor);
  }, [selectedVendor]);

  const save = async () => {
    if (!hash || !draft.name.trim()) return;
    setBusy(true);
    try {
      const patch: ServerApi.PatchOperation[] = [
        { op: "replace", path: "/id", value: draft.id },
        { op: "replace", path: "/name", value: draft.name },
        { op: "replace", path: "/sellRate", value: Number(draft.sellRate || 1) },
        { op: "replace", path: "/buyRate", value: Number(draft.buyRate || 0.5) },
        { op: "replace", path: "/items", value: draft.items || [] },
      ];
      const response = await requestData<TVendorResponse, ServerApi.RestRoutes.UpdateVendorBody>({
        endPoint: "/updateVendor",
        body: { expectedHash: hash, patch },
      });
      setVendors(response.data?.vendors || []);
      setHash(response.data?.hash || "");
      setSelectedId((response.data as TVendorResponse & { vendor?: Vendor.TVendor })?.vendor?.id || draft.id);
    } catch (error) {
      setError("Failed to save vendor: " + toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteVendor = async () => {
    if (!draft.id) return;
    setBusy(true);
    try {
      const response = await requestData<TVendorResponse, ServerApi.RestRoutes.DeleteBody>({
        endPoint: "/deleteVendor",
        body: { name: draft.id },
      });
      setVendors(response.data?.vendors || []);
      setHash(response.data?.hash || "");
      setSelectedId("");
      setDraft(emptyVendor());
    } catch (error) {
      setError("Failed to delete vendor: " + toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const addSelectedItem = () => {
    const item = items.find((entry) => entry.name === selectedItemName);
    if (!item) return;
    setDraft((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          item,
          priceCopper: Math.max(0, Math.floor(Number(item.priceCopper || 0))),
          stock: 1,
        },
      ],
    }));
  };

  return (
    <RndContainer
      id="vendor-handling"
      aditionalIcons={null}
      close={close}
      label="vendor-handling"
    >
    <div className="grow w-full min-w-0 min-h-0 fancy-container p-2 flex flex-col gap-2 overflow-hidden text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Kalmárok</h2>
        <button className="fancy-container px-2 py-1" onClick={() => { setSelectedId(""); setDraft(emptyVendor()); }}>
          New
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 min-h-0 grow">
        <div className="fancy-container p-1 overflow-y-auto">
          {vendors.map((vendor) => (
            <button
              type="button"
              className={`w-full text-left px-2 py-1 mb-1 fancy-container ${vendor.id === selectedId ? "bg-black/10" : ""}`}
              onClick={() => setSelectedId(vendor.id)}
            >
              {vendor.name}
            </button>
          ))}
        </div>
        <div className="fancy-container p-2 min-h-0 overflow-y-auto flex flex-col gap-2">
          <input className="border rounded text-black p-1" placeholder="NJK kereskedő neve" value={draft.name} onInput={(e) => setDraft((p) => ({ ...p, name: e.currentTarget.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">Eladási szorzó<input type="number" step="0.01" min={0} className="border rounded text-black p-1" value={draft.sellRate} onInput={(e) => setDraft((p) => ({ ...p, sellRate: Number(e.currentTarget.value || 0) }))} /></label>
            <label className="flex flex-col gap-1">Vételi szorzó<input type="number" step="0.01" min={0} className="border rounded text-black p-1" value={draft.buyRate} onInput={(e) => setDraft((p) => ({ ...p, buyRate: Number(e.currentTarget.value || 0) }))} /></label>
          </div>
          <div className="flex gap-1 flex-wrap">
            <select className="border rounded text-black p-1 min-w-[220px]" value={selectedItemName} onChange={(e) => setSelectedItemName(e.currentTarget.value)}>
              <option value="">Tárgy kiválasztása</option>
              {items.map((item) => <option value={item.name}>{item.name}</option>)}
            </select>
            <button className="fancy-container px-2 py-1" type="button" onClick={addSelectedItem}>Tárgy hozzárendelése</button>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead><tr><th className="text-left">Tárgy</th><th>Ár / érték</th><th>Készlet</th><th></th></tr></thead>
            <tbody>
              {(draft.items || []).map((entry, index) => (
                <tr>
                  <td className="pr-2">{entry.item.name}</td>
                  <td><MoneyAddInput id={`vendor-item-price-${index}`} valueCopper={entry.priceCopper} onChange={(nextCopper) => setDraft((p) => ({ ...p, items: p.items.map((x, i) => i === index ? { ...x, priceCopper: nextCopper } : x) }))} /></td>
                  <td><input type="number" min={0} className="w-20 border rounded text-black p-1" value={entry.stock} onInput={(e) => setDraft((p) => ({ ...p, items: p.items.map((x, i) => i === index ? { ...x, stock: Math.max(0, Number(e.currentTarget.value || 0)) } : x) }))} /></td>
                  <td><button className="fancy-container px-2 py-1" type="button" onClick={() => setDraft((p) => ({ ...p, items: p.items.filter((_, i) => i !== index) }))}>Eltávolítás</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-1">
            <button className="fancy-container px-2 py-1" type="button" disabled={busy || !draft.id} onClick={deleteVendor}>Törlés</button>
            <button className="fancy-container px-2 py-1" type="button" disabled={busy || !draft.name.trim()} onClick={save}>Mentés</button>
          </div>
        </div>
      </div>
    </div>
    </RndContainer>
  );
}
