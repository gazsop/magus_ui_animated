import { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import AppModal from "@components/AppModal";
import ItemHoverCard from "@components/ItemHoverCard";
import useRequest from "@hooks/request";
import { Application, ServerApi } from "@shared/contracts";
import { formatSpellCost, formatSpellDuration } from "@shared/game";

type TParsedReference = {
  raw: string;
  label: string;
  kind: ServerApi.ChatRoutes.ChatReferenceKind;
  id: string;
};

type THoveredItem = {
  item: NonNullable<ServerApi.ChatRoutes.ChatReferenceSearchResult["item"]>;
  x: number;
  y: number;
};

const CHAT_REF_PATTERN = /@\[([^\]]+)\]\(chatref:(item|spell|ynev|npc):([^)]+)\)/g;

export const createChatReferenceToken = (
  result: ServerApi.ChatRoutes.ChatReferenceSearchResult
) => {
  const label = result.label.replace(/[\][()]/g, " ").replace(/\s+/g, " ").trim();
  return `@[${label || result.kind}](chatref:${result.kind}:${encodeURIComponent(result.id)})`;
};

const parseChatReferences = (text: string): TParsedReference[] =>
  Array.from(text.matchAll(CHAT_REF_PATTERN)).map((match) => ({
    raw: match[0],
    label: match[1],
    kind: match[2] as ServerApi.ChatRoutes.ChatReferenceKind,
    id: decodeURIComponent(match[3]),
  }));

const refKey = (ref: Pick<TParsedReference, "kind" | "id">) => `${ref.kind}:${ref.id}`;

const NpcDetails = ({
  npc,
}: {
  npc: NonNullable<ServerApi.ChatRoutes.ChatReferenceSearchResult["npc"]>;
}) => (
  <div className="flex flex-col gap-1 text-xs">
    {npc.avatar?.src ? (
      <img
        src={npc.avatar.src}
        className="max-h-44 w-full rounded border border-slate-500 object-contain"
        style={{ objectFit: npc.avatar.fit || "cover" }}
      />
    ) : null}
    <p>{npc.notes || "-"}</p>
    <div className="grid grid-cols-2 gap-1">
      <p>FP: {npc.resource?.health.currentHp || 0}/{npc.resource?.health.maxHp || 0}</p>
      <p>EP: {npc.resource?.health.currentEp || 0}/{npc.resource?.health.maxEp || 0}</p>
      <p>
        {npc.resource?.abilities.name || "Erőforrás"}:{" "}
        {npc.resource?.abilities.current || 0}/{npc.resource?.abilities.max || 0}
      </p>
      <p>
        HM: ATK {npc.hm?.ATK || 0}, DEF {npc.hm?.DEF || 0}, AIM {npc.hm?.AIM || 0}, INI{" "}
        {npc.hm?.INI || 0}
      </p>
    </div>
    {npc.primaryStats?.length ? (
      <p>
        Tulajdonságok:{" "}
        {npc.primaryStats.map((stat) => `${stat.name} ${stat.val}`).join(", ")}
      </p>
    ) : null}
  </div>
);

const SpellDetails = ({
  spell,
}: {
  spell: NonNullable<ServerApi.ChatRoutes.ChatReferenceSearchResult["spell"]>;
}) => (
  <div className="flex flex-col gap-1 text-xs">
    <p>{spell.description || "-"}</p>
    <div className="grid grid-cols-2 gap-1">
      <p>Szint: {spell.lvlReq || 0}</p>
      <p>Típus: {spell.type || "-"}</p>
      <p>Aktiválás: {spell.activation || "-"}</p>
      <p>Spec: {spell.spec || "-"}</p>
    </div>
    <p>Mágiaforma: {spell.schools?.length ? spell.schools.join(", ") : "-"}</p>
    {spell.choice ? <p>Választás: {spell.choice.label}</p> : null}
    <div className="flex flex-col gap-0.5">
      {(spell.upgrades || []).map((upgrade) => (
        <p key={`chat-spell-upgrade-${spell.id}-${upgrade.level}`}>
          Lvl {upgrade.level}:{" "}
          {upgrade.available ? (upgrade.stagnates ? "Stagnál" : upgrade.raw) : "-"} | Költség:{" "}
          {formatSpellCost(upgrade.cost)} | Időtartam: {formatSpellDuration(upgrade.duration)}
        </p>
      ))}
    </div>
  </div>
);

export default function ChatReferenceText({
  text,
  onYnevJump,
}: {
  text: string;
  onYnevJump: (x: number, y: number) => void;
}) {
  const [chatRequest] = useRequest(Application.REQUEST_CONTROLLER.CHAT);
  const references = useMemo(() => parseChatReferences(text), [text]);
  const [detailsByKey, setDetailsByKey] = useState<
    Record<string, ServerApi.ChatRoutes.ChatReferenceSearchResult>
  >({});
  const [hoveredItem, setHoveredItem] = useState<THoveredItem | null>(null);
  const [modalRef, setModalRef] =
    useState<ServerApi.ChatRoutes.ChatReferenceSearchResult | null>(null);

  useEffect(() => {
    const missing = references.filter((ref) => !detailsByKey[refKey(ref)]);
    if (missing.length === 0) return;
    let cancelled = false;
    void Promise.all(
      missing.map(async (ref) => {
        const response = await chatRequest<
          ServerApi.ChatRoutes.ChatReferenceSearchResponse,
          ServerApi.ChatRoutes.ChatReferenceSearchBody
        >({
          endPoint: "/searchReferences",
          body: { query: ref.label, limit: 20 },
          errorMode: "quiet",
        });
        return response.data.results.find(
          (result) =>
            result.kind === ref.kind &&
            (result.id === ref.id || result.label === ref.label)
        );
      })
    )
      .then((results) => {
        if (cancelled) return;
        setDetailsByKey((prev) => {
          const next = { ...prev };
          results.forEach((result) => {
            if (result) next[refKey(result)] = result;
          });
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [references.map(refKey).join("|")]);

  const renderReference = (ref: TParsedReference) => {
    const detail = detailsByKey[refKey(ref)];
    const baseClass = "underline text-sky-300 hover:text-sky-100 cursor-pointer";
    if (ref.kind === "ynev") {
      const x = detail?.x;
      const y = detail?.y;
      return (
        <button
          type="button"
          className={baseClass}
          onClick={() => {
            if (Number.isFinite(x) && Number.isFinite(y)) onYnevJump(Number(x), Number(y));
          }}
        >
          @{ref.label}
        </button>
      );
    }
    if (ref.kind === "item") {
      return (
        <span
          className={baseClass}
          onMouseMove={(event) => {
            if (detail?.item) {
              setHoveredItem({
                item: detail.item,
                x: event.clientX,
                y: event.clientY,
              });
            }
          }}
          onMouseLeave={() => setHoveredItem(null)}
        >
          @{ref.label}
        </span>
      );
    }
    return (
      <button
        type="button"
        className={baseClass}
        onClick={() => {
          if (detail) setModalRef(detail);
        }}
      >
        @{ref.label}
      </button>
    );
  };

  const parts: JSX.Element[] = [];
  let cursor = 0;
  Array.from(text.matchAll(CHAT_REF_PATTERN)).forEach((match, index) => {
    const start = match.index || 0;
    if (start > cursor) parts.push(<>{text.slice(cursor, start)}</>);
    parts.push(
      <span key={`${match[0]}-${index}`}>
        {renderReference({
          raw: match[0],
          label: match[1],
          kind: match[2] as ServerApi.ChatRoutes.ChatReferenceKind,
          id: decodeURIComponent(match[3]),
        })}
      </span>
    );
    cursor = start + match[0].length;
  });
  if (cursor < text.length) parts.push(<>{text.slice(cursor)}</>);

  return (
    <>
      {parts.length ? parts : text}
      {hoveredItem ? (
        <ItemHoverCard
          item={hoveredItem.item}
          x={hoveredItem.x}
          y={hoveredItem.y}
          showEffectHm
          showPrimary
          showWeaponDamages
        />
      ) : null}
      {modalRef?.spell ? (
        <AppModal
          id="chat-spell-reference-modal"
          label={modalRef.label}
          widthClass="w-[min(520px,95vw)]"
          actions={
            <button className="fancy-container px-2 py-1" onClick={() => setModalRef(null)}>
              Bezárás
            </button>
          }
        >
          <SpellDetails spell={modalRef.spell} />
        </AppModal>
      ) : null}
      {modalRef?.npc ? (
        <AppModal
          id="chat-npc-reference-modal"
          label={modalRef.label}
          widthClass="w-[min(520px,95vw)]"
          actions={
            <button className="fancy-container px-2 py-1" onClick={() => setModalRef(null)}>
              Bezárás
            </button>
          }
        >
          <NpcDetails npc={modalRef.npc} />
        </AppModal>
      ) : null}
    </>
  );
}
