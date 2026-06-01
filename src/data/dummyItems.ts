import { Character } from "@shared/contracts";

const items: Character.Item.TItem[] = [
  {
    name: "Tüzes Almabor",
    description:
      "Egy forró, fűszeres almabor, amely felmelegíti a tested és növeli a bátorságod.",
    size: { sizeX: 1, sizeY: 1, weight: 0.5 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 0,
      INI: 0,
      AIM: 0,
    },
  },
  {
    name: "Fénytörő Pikkelyvért",
    description:
      "Egy pikkelyvért, amely eltöri a fényt, így megnehezíti, hogy meglássanak.",
    size: { sizeX: 3, sizeY: 3, weight: 10 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 5,
      INI: -1,
      AIM: 0,
    },
  },
  {
    name: "Hollócsőr Dárda",
    description:
      "Egy éles dárda, melynek hegye úgy néz ki, mint egy holló csőre.",
    size: { sizeX: 1, sizeY: 4, weight: 3 },    equipable: null,
    hm: {
      ATK: 4,
      DEF: 0,
      INI: 1,
      AIM: 2,
    },
  },
  {
    name: "Holdfény Kenyér",
    description:
      "Egy különleges kenyér, amely világít a sötétben, és kis mennyiségben regenerálja az energiád.",
    size: { sizeX: 1, sizeY: 1, weight: 0.2 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 0,
      INI: 0,
      AIM: 0,
    },
  },
  {
    name: "Fekete Penge Gyűrű",
    description:
      "Egy gyűrű, amely egy apró fekete pengét rejt, titkos támadásokhoz.",
    size: { sizeX: 1, sizeY: 1, weight: 0.1 },    equipable: null,
    hm: {
      ATK: 1,
      DEF: 0,
      INI: 2,
      AIM: 1,
    },
  },
  {
    name: "Lángoló Paprikás Kolbász",
    description:
      "Egy tüzes kolbász, amely még az ellenségeidet is megperzseli egy harapással.",
    size: { sizeX: 1, sizeY: 1, weight: 0.5 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 0,
      INI: 0,
      AIM: 0,
    },
  },
  {
    name: "Árnyékcsuklya",
    description:
      "Egy csuklya, amely segít eltűnni az árnyékban, így nehezebben találnak el.",
    size: { sizeX: 1, sizeY: 2, weight: 0.7 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 2,
      INI: 1,
      AIM: 0,
    },
  },
  {
    name: "Tűzpikkely Pajzs",
    description: "Egy pajzs, amely pikkelyekből készült és tűz ellen véd.",
    size: { sizeX: 2, sizeY: 2, weight: 6 },    equipable: null,
    hm: {
      ATK: 1,
      DEF: 6,
      INI: -1,
      AIM: 0,
    },
  },
  {
    name: "Elátkozott Démoncsont",
    description:
      "Egy csont, amely egy bukott démon lordból származik. Viselője fokozott erőt, de átkot is érez.",
    size: { sizeX: 1, sizeY: 3, weight: 2 },    equipable: null,
    hm: {
      ATK: 3,
      DEF: 0,
      INI: -1,
      AIM: 2,
    },
  },
  {
    name: "Rúnás Vértcsizma",
    description:
      "Egy csizma, amely rúnákkal van tele, növeli a védelmet és stabilitást a harcban.",
    size: { sizeX: 2, sizeY: 2, weight: 5 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 4,
      INI: 1,
      AIM: 0,
    },
  },
  {
    name: "Méregcsepp Nyaklánc",
    description:
      "Egy nyaklánc, amelyben egy apró méregcsepp lapul, készen arra, hogy használója gyorsan végezzen az ellenfelével.",
    size: { sizeX: 1, sizeY: 1, weight: 0.3 },    equipable: null,
    hm: {
      ATK: 2,
      DEF: 0,
      INI: 2,
      AIM: 1,
    },
  },
  {
    name: "Óriáskönny Üvegcséje",
    description:
      "Egy apró üvegcse, amely egy legendás óriás könnyét tartalmazza. Fogyasztása ideiglenes erőnövekedést biztosít.",
    size: { sizeX: 1, sizeY: 1, weight: 0.1 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 0,
      INI: 0,
      AIM: 0,
    },
  },
  {
    name: "Szellemtűz Lant",
    description:
      "Ez a lant kísérteties dallamokat játszik, amelyek képesek elcsendesíteni az ellenség szívét.",
    size: { sizeX: 2, sizeY: 3, weight: 4 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 1,
      INI: 1,
      AIM: 3,
    },
  },
  {
    name: "Titáncsont Karkötő",
    description:
      "Egy titánok csontjából készült karkötő, amely erőt és védelmet ad viselőjének.",
    size: { sizeX: 1, sizeY: 1, weight: 1 },    equipable: null,
    hm: {
      ATK: 1,
      DEF: 3,
      INI: 0,
      AIM: 0,
    },
  },
  {
    name: "Kardnyelő Tok",
    description:
      "Ez a különleges tok képes egy egész kardot elnyelni és azt pillanatok alatt előhúzni.",
    size: { sizeX: 1, sizeY: 2, weight: 1.5 },    equipable: null,
    hm: {
      ATK: 1,
      DEF: 0,
      INI: 3,
      AIM: 0,
    },
  },
  {
    name: "Fagyott Mézeskalács",
    description:
      "Egy jeges mézeskalács, amely elfogyasztása után felgyorsítja a reflexeket és a mozgást.",
    size: { sizeX: 1, sizeY: 1, weight: 0.2 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 0,
      INI: 2,
      AIM: 0,
    },
  },
  {
    name: "Festett Árnyékköpeny",
    description:
      "Egy köpeny, amely különböző festményekkel van díszítve, és képes összekeverni viselőjét az árnyakkal.",
    size: { sizeX: 2, sizeY: 3, weight: 2 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 3,
      INI: 2,
      AIM: 0,
    },
  },
  {
    name: "Lángkarmok",
    description:
      "Egy pár kesztyű, amely lángoló karmokat idéz meg viselője kezén, nagy sebzést okozva közelharcban.",
    size: { sizeX: 1, sizeY: 1, weight: 1 },    equipable: null,
    hm: {
      ATK: 4,
      DEF: 0,
      INI: 1,
      AIM: 0,
    },
  },
  {
    name: "Varázsvértköpeny",
    description:
      "Ez a köpeny bármilyen támadás energiáját képes elnyelni, és mágikus védelmet nyújt viselőjének.",
    size: { sizeX: 2, sizeY: 3, weight: 4 },    equipable: null,
    hm: {
      ATK: 0,
      DEF: 5,
      INI: 0,
      AIM: 0,
    },
  },
  {
    name: "Égiek Szelencéje",
    description:
      "Egy apró szelence, amely az égi világ egy darabját rejti magában, és különleges erőt ad annak, aki megnyitja.",
    size: { sizeX: 1, sizeY: 1, weight: 0.5 },    equipable: null,
    hm: {
      ATK: 1,
      DEF: 1,
      INI: 1,
      AIM: 1,
    },
  },
];

export default items;

