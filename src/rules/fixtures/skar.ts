// Personagem de referência: Skar Lionet (jogador Thainan), nível 2, Humano Pugilista.
// Fonte: C:\RPG KRAIO\Players\Thainan\Skar.xlsx, aba Combate.
// Os valores esperados são os da planilha.

import type { FichaRegras } from '../caldronis';

export const SKAR: FichaRegras = {
  nivel: 2,
  atributos: {
    FOR: { base: 8 },
    DES: { base: 2 },
    CON: { base: 5 },
    INT: { base: 2 },
    SAB: { base: 3 },
    CAR: { base: 2 },
  },
};

export const SKAR_ESPERADO = {
  CORPO: 5,
  MENTE: 7 / 3,
  VIDA: 45,
  STA: 20,
  MANA: 12,
  PA: 4,
  DESLOCAMENTO: 9,
  DEF_NATURAL: 7.5,
  DEF_MAGICA_NATURAL: 23 / 6,
  CONTRABALANCO: 1,
};
