import React from "react";
import { Col, InputGroup, Row } from "react-bootstrap";
import { Id } from "../../../utils/getId";
import { IChar, ISecStatScaling, ISecondaryStatVal } from '../../../types/common';

const secondaryStatVal: (
  val: number,
  scaling?: ISecStatScaling[]
) => ISecondaryStatVal = (val = 1, scaling = []) => {
  return {
    val: val,
    scaling: null,
  }
}

const secondaryStats: {
  id: number;
  name: string;
  val: ISecondaryStatVal;
}[] = [
  {
    id: 1,
    name: "Álcázás/Álruhaviselés",
    val: secondaryStatVal(10, [
      {
        lvl: 6,
        newVal: 150,
      },
    ]),
  },
  // { id: 2, name: "Alkímia", val: secondaryStatVal(10) },
  // { id: 3, name: "Állatismeret", val: secondaryStatVal(10) },
  // { id: 4, name: "Belharc", val: secondaryStatVal(10) },
  // { id: 5, name: "Birkózás", val: secondaryStatVal(10) },
  // { id: 6, name: "Célzás", val: secondaryStatVal(10) },
  // { id: 7, name: "Csapda és titkosajtó keresés", val: secondaryStatVal(10) },
  // { id: 8, name: "Csapdaállítás", val: secondaryStatVal(10) },
  // { id: 9, name: "Csomózás", val: secondaryStatVal(10) },
  // { id: 10, name: "Demonológia", val: secondaryStatVal(10) },
  // { id: 11, name: "Drágakőmágia", val: secondaryStatVal(10) },
  // { id: 12, name: "Élettan", val: secondaryStatVal(10) },
  // { id: 13, name: "Emberismeret", val: secondaryStatVal(10) },
  // { id: 14, name: "Éneklés/Zenélés", val: secondaryStatVal(10) },
  // { id: 15, name: "Építészet", val: secondaryStatVal(10) },
  // { id: 16, name: "Erdőjárás", val: secondaryStatVal(10) },
  // { id: 17, name: "Értékbecslés", val: secondaryStatVal(10) },
  // { id: 18, name: "Esés", val: secondaryStatVal(10) },
  // { id: 19, name: "Etikett", val: secondaryStatVal(10) },
  // { id: 20, name: "Fegyverdobás", val: secondaryStatVal(10) },
  // { id: 21, name: "Fegyverhasználat", val: secondaryStatVal(10) },
  // { id: 22, name: "Fegyverismeret", val: secondaryStatVal(10) },
  // { id: 23, name: "Fegyvertörés", val: secondaryStatVal(10) },
  // { id: 24, name: "Festészet,Rajzolás", val: secondaryStatVal(10) },
  // { id: 25, name: "Földharc", val: secondaryStatVal(10) },
  // { id: 26, name: "Futás", val: secondaryStatVal(10) },
  // { id: 27, name: "Hadrend", val: secondaryStatVal(10) },
  // { id: 28, name: "Hadvezetés", val: secondaryStatVal(10) },
  // { id: 29, name: "Hajózás", val: secondaryStatVal(10) },
  // { id: 30, name: "Hamisítás", val: secondaryStatVal(10) },
  // { id: 31, name: "Hamiskártyázás", val: secondaryStatVal(10) },
  // { id: 32, name: "Hangutánzás", val: secondaryStatVal(10) },
  // { id: 33, name: "Harc helyhez kötve", val: secondaryStatVal(10) },
  // { id: 34, name: "Harci láz", val: secondaryStatVal(10) },
  // { id: 35, name: "Hárítás", val: secondaryStatVal(10) },
  // { id: 36, name: "Hasbeszélés", val: secondaryStatVal(10) },
  // { id: 37, name: "Hátbatámadás(Orvtámadás)", val: secondaryStatVal(10) },
  // { id: 38, name: "Helyismeret", val: secondaryStatVal(10) },
  // { id: 39, name: "Heraldika", val: secondaryStatVal(10) },
  // { id: 40, name: "Herbalizmus", val: secondaryStatVal(10) },
  // { id: 41, name: "Idomítás", val: secondaryStatVal(10) },
  // { id: 42, name: "Időjóslás", val: secondaryStatVal(10) },
  // { id: 43, name: "Ikerharc", val: secondaryStatVal(10) },
  // { id: 44, name: "Írás/Olvasás", val: secondaryStatVal(10) },
  // { id: 45, name: "Jogismeret", val: secondaryStatVal(10) },
  // { id: 46, name: "Kétkezes harc", val: secondaryStatVal(10) },
  // { id: 47, name: "Kétkezes harc - Shien-Su", val: secondaryStatVal(10) },
  // {
  //   id: 48,
  //   name: "Kiegészítő támadás, különleges fegyver",
  //   val: secondaryStatVal(10),
  // },
  // { id: 49, name: "Kínokozás", val: secondaryStatVal(10) },
  // { id: 50, name: "Kocsihajtás", val: secondaryStatVal(10) },
  // { id: 51, name: "Kocsmai Verekedés", val: secondaryStatVal(10) },
  // { id: 52, name: "Kötelekből szabadulás", val: secondaryStatVal(10) },
  // { id: 53, name: "Kötéltánc", val: secondaryStatVal(10) },
  // { id: 54, name: "Lábharc", val: secondaryStatVal(10) },
  // { id: 55, name: "Lefegyvezés", val: secondaryStatVal(10) },
  // { id: 56, name: "Legendaismeret", val: secondaryStatVal(10) },
  // { id: 57, name: "Lopózás", val: secondaryStatVal(10) },
  // { id: 58, name: "Lovaglás", val: secondaryStatVal(10) },
  // { id: 59, name: "Lovas íjászat", val: secondaryStatVal(10) },
  // { id: 60, name: "Mágiahasználat", val: secondaryStatVal(10) },
  // { id: 61, name: "Mágiaismeret", val: secondaryStatVal(10) },
  // { id: 62, name: "Mászás", val: secondaryStatVal(10) },
  // { id: 63, name: "Mechanika", val: secondaryStatVal(10) },
  // { id: 64, name: "Mellébeszélés", val: secondaryStatVal(10) },
  // { id: 65, name: "Méregkeverés/Semlegesítés", val: secondaryStatVal(10) },
  // { id: 66, name: "Nehézvért viselet", val: secondaryStatVal(10) },
  // { id: 67, name: "Nyelvismeret", val: secondaryStatVal(10) },
  // { id: 68, name: "Nyomolvasás/Eltüntetés", val: secondaryStatVal(10) },
  // { id: 69, name: "Ökölharc", val: secondaryStatVal(10) },
  // { id: 70, name: "Ősi nyelv ismerete", val: secondaryStatVal(10) },
  // { id: 71, name: "Pajzs használat", val: secondaryStatVal(10) },
  // { id: 72, name: "Pszi", val: secondaryStatVal(10) },
  // { id: 73, name: "Pusztítás", val: secondaryStatVal(10) },
  // { id: 74, name: "Rejtőzés", val: secondaryStatVal(10) },
  // { id: 75, name: "Rúnamágia", val: secondaryStatVal(10) },
  // { id: 76, name: "Sebgyógyítás", val: secondaryStatVal(10) },
  // { id: 77, name: "Semlegesítés/Működtetés", val: secondaryStatVal(10) },
  // { id: 78, name: "Szájról olvasás", val: secondaryStatVal(10) },
  // { id: 79, name: "Szakma", val: secondaryStatVal(10) },
  // { id: 80, name: "Szexuális kultúra", val: secondaryStatVal(10) },
  // { id: 81, name: "Tánc", val: secondaryStatVal(10) },
  // { id: 82, name: "Térképészet", val: secondaryStatVal(10) },
  // { id: 83, name: "Történelemismeret", val: secondaryStatVal(10) },
  // { id: 84, name: "Ugrás/Akrobatika", val: secondaryStatVal(10) },
  // { id: 85, name: "Úszás", val: secondaryStatVal(10) },
  // { id: 86, name: "Vadászat/Halászat", val: secondaryStatVal(10) },
  // { id: 87, name: "Vakharc", val: secondaryStatVal(10) },
  // { id: 88, name: "Vallásismeret", val: secondaryStatVal(10) },
  // { id: 89, name: "Zárnyitás", val: secondaryStatVal(10) },
  // { id: 90, name: "Zsebmetszés", val: secondaryStatVal(10) },
  // { id: 91, name: "Zsonglőrködés", val: secondaryStatVal(10) },
];
export function SecondaryStats(): React.ReactElement {
  return <></>;
}
