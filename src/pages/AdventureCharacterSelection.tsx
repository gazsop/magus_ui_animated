import { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { Application, Character } from "@shared/contracts";
import { FlexCol } from "@components/Flex";
import useRequest from "@hooks/request";
import { useUtilContext } from "@contexts/utilContext";
import useError from "@hooks/error";
import { debugLog } from "@/core/logger";
import { formatClientDateTime } from "@/core/datetime";

type TAdventureCharacters = {
  id: string;
  name: string;
  createdAt?: number;
  updatedAt?: number;
  character: Character.TCharacterServer | null;
}[];

function AdventureCharacterSelection({
  isAdmin,
  selectCharacter,
}: {
  isAdmin: boolean;
  selectCharacter: (id: string, hasCharacter: boolean) => void;
}) {
  const [adventureCharacters, setAdventureCharacters] = useState<TAdventureCharacters>([]);
  const [requestAdventure] = useRequest(Application.REQUEST_CONTROLLER.ADVENTURES);
  const { setError } = useError();
  const { setDisableNavArrows } = useUtilContext();

  useEffect(() => {
    requestAdventure<TAdventureCharacters>({
      endPoint: "/getUserAllAdventureCharacters",
    })
      .then((response) => {
        setAdventureCharacters(response.data || []);
      })
      .catch((error) => {
        setError("Nem sikerült lekérni a kaland karaktereket: " + error);
        debugLog("Failed to fetch adventure characters", error);
      });
  }, []);

  useEffect(() => setDisableNavArrows({ left: false, right: true }), []);

  const CharactersElements = () => {
    if (adventureCharacters.length < 1) {
      return (
        <FlexCol className="p-3 m-1 fancy-container text-center">
          <p className="font-bold">Nincs elérhető kaland.</p>
        </FlexCol>
      );
    }

    const elements: JSX.Element[] = [];
    adventureCharacters.forEach((adv) => {
      const characterData = adv.character?.json;
      elements.push(
        <PlayerCard
          key={adv.id}
          id={adv.id}
          name={adv.name}
          level={characterData?.level?.current}
          className={characterData?.class}
          descent={characterData?.descent}
          createdAt={adv.createdAt}
          updatedAt={adv.updatedAt}
          isAdmin={isAdmin}
          hasCharacter={!!adv.character}
          selectCharacter={selectCharacter}
        />
      );
    });
    return <>{elements}</>;
  };

  return (
    <FlexCol className="grow h-full w-full p-1 fancy-container overflow-auto">
      <CharactersElements />
    </FlexCol>
  );
}

export function PlayerCard({
  id,
  name,
  level,
  className,
  descent,
  createdAt,
  updatedAt,
  isAdmin,
  hasCharacter,
  selectCharacter,
}: {
  id: string;
  name: string;
  level?: number;
  className?: string;
  descent?: string;
  createdAt?: number;
  updatedAt?: number;
  isAdmin: boolean;
  hasCharacter: boolean;
  selectCharacter: (char: string, hasCharacter: boolean) => void;
}) {
  const safeName = String(name || "").trim() || "-";
  const safeLevel = typeof level === "number" && Number.isFinite(level) ? String(level) : "-";
  const safeClass = String(className || "").trim() || "-";
  const safeDescent = String(descent || "").trim() || "-";
  const safeCreatedAt =
    typeof createdAt === "number" && Number.isFinite(createdAt) ? formatClientDateTime(createdAt) : "-";
  const safeUpdatedAt =
    typeof updatedAt === "number" && Number.isFinite(updatedAt) ? formatClientDateTime(updatedAt) : "-";

  return (
    <div
      className="player-card p-4 select-none cursor-pointer m-1 fancy-container"
      onClick={() => selectCharacter(id, hasCharacter)}
    >
      {isAdmin ? (
        <FlexCol className="gap-0.25">
          <span className="font-bold">{`Név: ${safeName}`}</span>
          <span>{`Létrehozva: ${safeCreatedAt}`}</span>
          <span>{`Utolsó módosítás: ${safeUpdatedAt}`}</span>
        </FlexCol>
      ) : (
        <FlexCol className="gap-0.25">
          <span className="font-bold">{`Név: ${safeName}`}</span>
          <span>{`Szint: ${safeLevel}`}</span>
          <span>{`Kaszt: ${safeClass}`}</span>
          <span>{`Faj: ${safeDescent}`}</span>
        </FlexCol>
      )}
    </div>
  );
}

export default AdventureCharacterSelection;

