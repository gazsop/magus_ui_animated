import { useEffect, useState } from "preact/hooks";
import useRequest from "@hooks/request";
import { IWindowsLayerWindowProps, useWindowsLayer } from "@pages/WindowsLayer";
import { FlexCol } from "@components/Flex";
import { SelectUnq } from "@components/GeneralElements";
import { Application, Character, ServerApi } from "@shared/contracts";
import useError from "@hooks/error";
import { debugLog } from "@/core/logger";
import { defineWindowRegistration } from "@/windows/windowFactory";

function CharacterHandling({ advId }: { advId: string }) {
  const { addWindow } = useWindowsLayer();
  const [characters, setCharacters] = useState<
    { name: string; uid: string; json: Character.TCharacter }[]
  >([]);

  const [selectedCharacter, setSelectedCharacter] = useState<number>(-1);
  const { setError } = useError();

  const reportRequestError = (message: string, error: unknown) => {
    setError(`${message}: ${error}`);
    debugLog(message, error);
  };
  const [requestCharacter] = useRequest(
    Application.REQUEST_CONTROLLER.USERS
  );
  const hasValidAdventure = !!advId && advId !== "0" && advId !== "-1";
  const hasCharacters = characters.length > 0;
  const hasSelectedCharacter =
    selectedCharacter >= 0 && selectedCharacter < characters.length;

  const buildCharacterWindow = (characterIndex: number): IWindowsLayerWindowProps => {
    const character = characters[characterIndex];
    const windowName = `Character-${advId}-${character?.uid || characterIndex}`;
    return defineWindowRegistration({
      id: windowName,
      name: windowName,
      kind: "admin-character-viewer",
      title: windowName,
      icon: "CH",
      params: {
        advId,
        uid: character?.uid || String(characterIndex),
      },
    });
  };

  useEffect(() => {
    if (!hasValidAdventure) {
      setCharacters([]);
      setSelectedCharacter(-1);
      return;
    }
    requestCharacter<ServerApi.UserRoutes.GetAllUsersAndCharactersResponse>({
      endPoint: "/getAllUsersAndCharacters",
    })
      .then((response) => {
        const mappedCharacters: { name: string; uid: string; json: Character.TCharacter }[] =
          response.data
            .map((user) => {
              const selectedAdv = user.json.advsAndChars.find((adv) => adv.id === advId);
              if (!selectedAdv || !selectedAdv.character) return null;
              return {
                name: user.name,
                uid: user.uid,
                json: selectedAdv.character.json,
              };
            })
            .filter(Boolean) as { name: string; uid: string; json: Character.TCharacter }[];

        if (mappedCharacters.length === 0) {
          setCharacters([]);
          setSelectedCharacter(-1);
          return;
        }
        setCharacters(mappedCharacters);
        setSelectedCharacter(0);
      })
      .catch((error) => {
        reportRequestError("Failed to fetch characters", error);
        setCharacters([]);
        setSelectedCharacter(-1);
      });
  }, [advId, hasValidAdventure]);

  return (
    <>
      <FlexCol>
        <SelectUnq
          id={"charSelect"}
          label={"Characters"}
          optionData={
            hasCharacters
              ? characters.map((char, index) => ({
                  label:
                    `${char.name} - ` +
                    (char.json.rp ? char.json.rp.name : "New"),
                  value: index.toString(),
                }))
              : []
          }
          value={
            !hasSelectedCharacter
              ? {
                  label: "",
                  value: "",
                }
              : {
                  label:
                    `${characters[selectedCharacter].name} - ` +
                    (characters[selectedCharacter].json &&
                    characters[selectedCharacter].json.rp
                      ? characters[selectedCharacter].json.rp.name
                      : "New"),
                  value: selectedCharacter.toString(),
                }
          }
          onChange={(e) => {
            if (!e) return;
            const charIndex = parseInt(e.value);
            if (Number.isNaN(charIndex) || !characters[charIndex]) return;
            setSelectedCharacter(charIndex);
            addWindow(buildCharacterWindow(charIndex));
          }}
          className="m-1"
          disabled={!hasValidAdventure}
        />
      </FlexCol>
    </>
  );
}

export default CharacterHandling;






