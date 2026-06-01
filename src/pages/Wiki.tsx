import { FlexCol, FlexRow } from "@components/Flex";

const DEFAULT_KEYWORDS = [
  "Világ",
  "Rendek",
  "Mágia",
  "Vallások",
  "Fajok",
  "Kasztok",
  "Helyszínek",
];

const DEFAULT_ENTRIES = [
  { title: "Bevezető", text: "Wiki tartalom helye." },
  { title: "Fogalom 1", text: "Később bővítendő leírás." },
  { title: "Fogalom 2", text: "Később bővítendő leírás." },
];

export default function Wiki() {
  return (
    <FlexRow className="w-full h-full min-h-0 min-w-0 gap-2 p-2 flex-col sm:flex-row overflow-auto">
      <FlexCol className="w-full sm:w-[220px] sm:max-w-[40%] shrink-0 fancy-container p-2 gap-1 overflow-y-auto max-h-[35vh] sm:max-h-none">
        <p className="font-bold text-sm">Kulcsszavak</p>
        {DEFAULT_KEYWORDS.map((keyword) => (
          <div key={keyword} className="fancy-container px-2 py-1 text-sm">
            {keyword}
          </div>
        ))}
      </FlexCol>

      <FlexCol className="grow min-w-0 fancy-container p-2 gap-2 overflow-y-auto">
        <p className="font-bold text-sm">Lista</p>
        {DEFAULT_ENTRIES.map((entry) => (
          <div key={entry.title} className="fancy-container p-2">
            <p className="font-semibold">{entry.title}</p>
            <p className="text-sm">{entry.text}</p>
          </div>
        ))}
      </FlexCol>
    </FlexRow>
  );
}
