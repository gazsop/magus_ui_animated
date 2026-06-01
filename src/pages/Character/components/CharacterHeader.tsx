import { memo } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { JSX } from "preact";
import { Character } from "@shared/contracts";
import { FlexCol, FlexRow } from "@components/Flex";
import PlainCircleIcon from "@components/icons/general/PlainCircleIcon";
import CharAstralIcon from "@components/icons/magus/CharAstralIcon";
import CharIntIcon from "@components/icons/magus/CharIntIcon";
import CharPerIcon from "@components/icons/magus/CharPerIcon";
import CharStrIcon from "@components/icons/magus/CharStrIcon";
import CharDexIcon from "@components/icons/magus/CharDexIcon";
import CharSpeIcon from "@components/icons/magus/CharSpeIcon";
import CharWipIcon from "@components/icons/magus/CharWipIcon";
import CharHeaIcon from "@components/icons/magus/CharHeaIcon";
import CharBeaIcon from "@components/icons/magus/CharBeaIcon";
import CharConIcon from "@components/icons/magus/CharConIcon";
import CharHMATKIcon from "@components/icons/magus/CharHMATKIcon";
import CharHMDEFIcon from "@components/icons/magus/CharHMDEFIcon";
import CharHMAIMIcon from "@components/icons/magus/CharHMAIMIcon";
import CharHMINIIcon from "@components/icons/magus/CharHMINIICon";
import CharDefaultAvatarIcon from "@components/icons/magus/CharDefaultAvatarIcon";
import { getPrimaryStatValue } from "@/utils/stats";

type TStatDescriptor = {
  key: string;
  icon: JSX.Element;
  label: string;
  value: number;
};

export interface ICharXp {
  currentLvl: number;
  currentXp: number;
  levelCap: number;
}

export function useHeaderIdentity({
  name,
  descent,
  class: classType,
  lvl,
  avatar,
  selectedCharacter,
  onAvatarClick,
}: {
  name: string;
  descent: string;
  class: string;
  lvl: number;
  avatar?: Character.TImageMeta | null;
  selectedCharacter?: Character.TCharacter;
  onAvatarClick?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(true);
  const healthData = {
    maxHp: Math.max(0, Number(selectedCharacter?.resource?.health?.maxHp || 0)),
    currentHp: Math.max(0, Number(selectedCharacter?.resource?.health?.currentHp || 0)),
    maxEp: Math.max(0, Number(selectedCharacter?.resource?.health?.maxEp || 0)),
    currentEp: Math.max(0, Number(selectedCharacter?.resource?.health?.currentEp || 0)),
    mana: Math.max(0, Number(selectedCharacter?.resource?.abilities?.max || 0)),
    currentMana: Math.max(
      0,
      Number(selectedCharacter?.resource?.abilities?.current || 0)
    ),
  };
  const headerIdentityInfo = HeaderIdentityInfo({
    name: name,
    lvl: lvl,
    descent: descent,
    classType: classType,
    avatar,
    onAvatarClick,
  })
  const headerOrbs = HeaderOrbs({
    black: selectedCharacter?.orbs?.black ?? 0,
    white: selectedCharacter?.orbs?.white ?? 0,
    voidorb: selectedCharacter?.orbs?.voidorb ?? 0,
  });
  const headerResourceBars = HeaderResourceBars({
    showDetails: showDetails,
    setShowDetails: setShowDetails,
    healthData: healthData
  });

  return {headerIdentityInfo, headerOrbs, headerResourceBars};
}

function HeaderIdentityInfo({
  name,
  lvl,
  descent,
  classType,
  avatar,
  onAvatarClick,
}: {
  name: string;
  lvl: number;
  descent: string;
  classType: string;
  avatar?: Character.TImageMeta | null;
  onAvatarClick?: () => void;
}) {
  return (
    <FlexRow className="items-center min-w-0 min-h-0 w-full h-full fancy-container p-1 gap-1 overflow-hidden flex-wrap">
      <FlexRow
        className="fancy-container min-h-[70px] w-[60px] p-1 cursor-pointer shrink-0 overflow-hidden items-center justify-center"
        style={{ borderRadius: "20px" }}
        onClick={onAvatarClick}
      >
        {avatar?.src ? (
          <img
            src={avatar.src}
            className="w-full h-full rounded-full"
            style={{ objectFit: avatar.fit || "cover" }}
          />
        ) : (
          <CharDefaultAvatarIcon className="w-full h-full rounded-full" />
        )}
      </FlexRow>
      <FlexCol className="items-start justify-center px-1 min-w-0 min-h-0 grow basis-0 overflow-hidden">
        <FlexRow className="min-w-0 min-h-0 w-full flex-wrap">
          <p className="whitespace-normal break-words">{lvl}-es szintű&nbsp;</p>
          <p className="break-words whitespace-normal w-full">{name}</p>
        </FlexRow>
        <FlexRow className="min-w-0 min-h-0 w-full flex-wrap">
          <p className="whitespace-normal break-words">
            {descent}
          </p>
          <p className="whitespace-normal break-words min-w-0">
            {classType}
          </p>
        </FlexRow>
      </FlexCol>
    </FlexRow>
  );
}

function HeaderOrbs({
  black,
  white,
  voidorb,
}: {
  black: number;
  white: number;
  voidorb: number;
}) {
  return (
    <FlexCol className="w-auto h-full min-w-0 min-h-0 select-none fancy-container p-0.5 gap-0.5 items-center justify-between overflow-hidden shrink-0 self-stretch">
      <div className="relative shrink-0 w-[18px] h-[18px]">
        <PlainCircleIcon className="w-full h-full black-point" />
        <span className="absolute inset-0 flex items-center justify-center text-[7px] leading-none text-white pointer-events-none">
          {black}
        </span>
      </div>
      <div className="relative shrink-0 w-[18px] h-[18px]">
        <PlainCircleIcon className="w-full h-full white-point" />
        <span className="absolute inset-0 flex items-center justify-center text-[7px] leading-none text-black pointer-events-none">
          {white}
        </span>
      </div>
      <div className="relative shrink-0 w-[18px] h-[18px]">
        <PlainCircleIcon className="w-full h-full void-point" />
        <span className="absolute inset-0 flex items-center justify-center text-[7px] leading-none text-black pointer-events-none">
          {voidorb}
        </span>
      </div>
    </FlexCol>
  );
}

function HeaderResourceBars({
  showDetails,
  setShowDetails,
  healthData,
}: {
  showDetails: boolean;
  setShowDetails: (v: (prev: boolean) => boolean) => void;
  healthData: {
    maxHp: number;
    currentHp: number;
    maxEp: number;
    currentEp: number;
    mana: number;
    currentMana: number;
  };
}) {
  const VerticalBar = ({
    val,
    max,
    color,
  }: {
    val: number;
    max: number;
    color: string;
  }) => {
    const safeMax = Math.max(1, Number(max || 0));
    const safeVal = Math.max(0, Number(val || 0));
    const percentage = Math.min((safeVal / safeMax) * 100, 100);
    return (
      <FlexCol className="items-center h-full justify-between grow basis-1/4 min-w-[25%]">
        {showDetails && <p className="text-[10px] leading-none">{safeMax}</p>}
        <div
          className="relative w-full grow rounded overflow-hidden fancy-container mx-1"
          style={{
            minHeight: showDetails ? "24px" : "56px",
          }}
        >
          <div
            className="absolute top-0 left-0 w-full"
            style={{ height: `${percentage}%`, backgroundColor: color }}
          ></div>
        </div>
        {showDetails && <p className="text-[10px] leading-none">{safeVal}</p>}
      </FlexCol>
    );
  };

  return (
    <FlexRow
      className="justify-between items-stretch gap-0.5 w-full h-full min-w-0 min-h-0 fancy-container p-0.5 overflow-hidden"
      onPointerDown={() => setShowDetails((prev) => !prev)}
    >
      <VerticalBar val={healthData.currentHp} max={healthData.maxHp} color="rgb(186, 96, 0)" />
      <VerticalBar val={healthData.currentEp} max={healthData.maxEp} color="rgb(133, 18, 0)" />
      <VerticalBar val={healthData.currentMana} max={healthData.mana} color="rgb(9, 0, 133)" />
    </FlexRow>
  );
}

function StatIconValueElement({
  icon,
  value,
  label,
  className,
}: {
  icon: JSX.Element;
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <FlexCol className={`${className ? className : ""} relative fancy-container shrink-0 min-w-0 min-h-0 w-full`}>
      <div className="pointer-events-none justify-center items-center flex min-h-[20px] px-0.5 min-w-0">
        {label ? <p className="text-center break-words break-all whitespace-normal leading-tight max-w-full">{label}</p> : icon}
      </div>
      <hr className="fancy mx-1" />
      <p className="text-center">{value}</p>
    </FlexCol>
  );
}

function HeaderStatGrid({
  className,
  items,
  showLabels,
  onToggleLabels,
}: {
  className?: string;
  items: TStatDescriptor[];
  showLabels: boolean;
  onToggleLabels: () => void;
}) {
  return (
    <FlexRow
      className={`${
        className ? className + " " : ""
      } fancy-container w-full h-full min-w-0 min-h-0 overflow-hidden flex flex-wrap gap-0.5 justify-around items-center cursor-pointer select-none`}
      onClick={onToggleLabels}
    >
      {items.map((item) => (
        <StatIconValueElement
          key={item.key}
          className="basis-0 min-w-[40px]"
          icon={item.icon}
          value={item.value}
          label={showLabels ? item.label : ""}
        />
      ))}
    </FlexRow>
  );
}

export function HeaderXp({ lvlData }: { lvlData: ICharXp }) {
  return <HeadeXpBarMemo lvlData={lvlData} />;
}

export function useHeaderStatsPanel({
  selectedCharacter,
}: {
  selectedCharacter?: Character.TCharacter;
}) {
  const [showStatTexts, setShowStatTexts] = useState(false);
    const primaryStatItems: TStatDescriptor[] = [
    {
      key: Character.PRIMARY_STATS.AST,
      icon: <CharAstralIcon className="min-w-8 min-h-8" />,
      label: Character.PRIMARY_STATS.AST,
      value: getPrimaryStatValue(selectedCharacter?.primaryStats, Character.PRIMARY_STATS.AST),
    },
    {
      key: Character.PRIMARY_STATS.INT,
      icon: <CharIntIcon className="min-w-8 min-h-8" />,
      label: Character.PRIMARY_STATS.INT,
      value: getPrimaryStatValue(selectedCharacter?.primaryStats, Character.PRIMARY_STATS.INT),
    },
    {
      key: Character.PRIMARY_STATS.STR,
      icon: <CharStrIcon className="min-w-8 min-h-8" />,
      label: Character.PRIMARY_STATS.STR,
      value: getPrimaryStatValue(selectedCharacter?.primaryStats, Character.PRIMARY_STATS.STR),
    },
    {
      key: Character.PRIMARY_STATS.DEX,
      icon: <CharDexIcon className="min-w-8 min-h-8" />,
      label: Character.PRIMARY_STATS.DEX,
      value: getPrimaryStatValue(selectedCharacter?.primaryStats, Character.PRIMARY_STATS.DEX),
    },
    {
      key: Character.PRIMARY_STATS.SPE,
      icon: <CharSpeIcon className="min-w-8 min-h-8" />,
      label: Character.PRIMARY_STATS.SPE,
      value: getPrimaryStatValue(selectedCharacter?.primaryStats, Character.PRIMARY_STATS.SPE),
    },
    {
      key: Character.PRIMARY_STATS.WIP,
      icon: <CharWipIcon className="min-w-8 min-h-8" />,
      label: Character.PRIMARY_STATS.WIP,
      value: getPrimaryStatValue(selectedCharacter?.primaryStats, Character.PRIMARY_STATS.WIP),
    },
    {
      key: Character.PRIMARY_STATS.CON,
      icon: <CharConIcon className="min-w-8 min-h-8" />,
      label: Character.PRIMARY_STATS.CON,
      value: getPrimaryStatValue(selectedCharacter?.primaryStats, Character.PRIMARY_STATS.CON),
    },
    {
      key: Character.PRIMARY_STATS.HEA,
      icon: <CharHeaIcon className="min-w-8 min-h-8" />,
      label: Character.PRIMARY_STATS.HEA,
      value: getPrimaryStatValue(selectedCharacter?.primaryStats, Character.PRIMARY_STATS.HEA),
    },
    {
      key: Character.PRIMARY_STATS.BEA,
      icon: <CharBeaIcon className="min-w-8 min-h-8" />,
      label: Character.PRIMARY_STATS.BEA,
      value: getPrimaryStatValue(selectedCharacter?.primaryStats, Character.PRIMARY_STATS.BEA),
    },
    {
      key: Character.PRIMARY_STATS.PER,
      icon: <CharPerIcon className="min-w-8 min-h-8" />,
      label: Character.PRIMARY_STATS.PER,
      value: getPrimaryStatValue(selectedCharacter?.primaryStats, Character.PRIMARY_STATS.PER),
    },
  ];
  const hmItems: TStatDescriptor[] = [
    {
      key: Character.HM.ATK,
      icon: <CharHMATKIcon className="min-w-8 min-h-8" />,
      label: Character.HM.ATK,
      value: selectedCharacter?.hm?.ATK ?? 0,
    },
    {
      key: Character.HM.DEF,
      icon: <CharHMDEFIcon className="min-w-8 min-h-8" />,
      label: Character.HM.DEF,
      value: selectedCharacter?.hm?.DEF ?? 0,
    },
    {
      key: Character.HM.AIM,
      icon: <CharHMAIMIcon className="min-w-8 min-h-8" />,
      label: Character.HM.AIM,
      value: selectedCharacter?.hm?.AIM ?? 0,
    },
    {
      key: Character.HM.INI,
      icon: <CharHMINIIcon className="min-w-8 min-h-8" />,
      label: Character.HM.INI,
      value: selectedCharacter?.hm?.INI ?? 0,
    },
  ];

  const PrimaryStats = ({ className }: { className?: string }) => {
    if (!selectedCharacter?.primaryStats) return <></>;
    return (
      <HeaderStatGrid
        className={className}
        items={primaryStatItems}
        showLabels={showStatTexts}
        onToggleLabels={() => setShowStatTexts((prev) => !prev)}
      />
    );
  };

  const HMData = ({ className }: { className?: string }) => {
    if (!selectedCharacter?.hm) return <></>;
    return (
      <HeaderStatGrid
        className={className}
        items={hmItems}
        showLabels={showStatTexts}
        onToggleLabels={() => setShowStatTexts((prev) => !prev)}
      />
    );
  };

  return {
    PrimaryStats,
    HMData,
  };
}

const HeadeXpBarMemo = memo(function XpBar({ lvlData }: { lvlData: ICharXp }) {
  const xpBar = useRef<HTMLDivElement>(null);
  const xpBarFill = useRef<HTMLDivElement>(null);
  const xpBarText = useRef<HTMLDivElement>(null);

  const [showText, setShowText] = useState(true);

  useEffect(() => {
    const safeCap = Math.max(1, Number(lvlData.levelCap || 1));
    const safeXp = Math.max(0, Number(lvlData.currentXp || 0));
    const xpBarWidth = xpBar.current?.clientWidth || 0;
    const fillWidth = Math.min(1, safeXp / safeCap) * xpBarWidth;
    if (xpBarFill.current) xpBarFill.current.style.width = `${fillWidth}px`;
    if (xpBarText.current)
      xpBarText.current.innerText = `${safeXp}/${safeCap}`;
  }, [lvlData, showText]);

  useEffect(() => {
    const resizeEvent = () => {
      const safeCap = Math.max(1, Number(lvlData.levelCap || 1));
      const safeXp = Math.max(0, Number(lvlData.currentXp || 0));
      const xpBarWidth = xpBar.current?.clientWidth || 0;
      const fillWidth = Math.min(1, safeXp / safeCap) * xpBarWidth;
      if (xpBarFill.current) xpBarFill.current.style.width = `${fillWidth}px`;
      if (xpBarText.current)
        xpBarText.current.innerText = `${safeXp}/${safeCap}`;
    };

    window.addEventListener("resize", resizeEvent);

    return () => {
      window.removeEventListener("resize", resizeEvent);
    };
  }, []);

  return (
    <div className="relative fancy-container w-full h-full">
      <div
        className="w-full h-full"
        style={{
          backgroundColor: "rgba(106, 0, 60,.2)",
        }}
        ref={xpBar}
        onPointerDown={() => setShowText((prev) => !prev)}
      >
        <div
          className="h-full bg-blue-500"
          ref={xpBarFill}
          style={{
            backgroundColor: "rgb(1, 79, 9)",
          }}
        ></div>
      </div>
      {showText && (
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          ref={xpBarText}
        ></div>
      )}
    </div>
  );
});


