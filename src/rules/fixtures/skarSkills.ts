// Skills do Skar, da aba Combate da planilha (C:\RPG KRAIO\Players\Thainan\Skar.xlsx).

import type { DadosSkill } from '../../dominio/skills';

export const SKAR_SKILLS: DadosSkill[] = [
  {
    categoria: 'tecnica',
    nome: 'Postura Impetuosa',
    atkMod: '--',
    pas: '--',
    gastos: 'Passiva',
    descricao:
      'Skar cresce durante o confronto. Quanto mais troca golpes, resiste e domina fisicamente seus adversários, maior se torna seu ímpeto.\n' +
      'Skar possui 3 de Ímpeto máximo +1 a cada 2 níveis.\n' +
      'Recebe 1 Ímpeto ao: sofrer em um único ataque 20% ou mais da Vida máxima; bloquear ou aparar com sucesso um ataque; acertar uma Técnica de Pugilismo; vencer uma Disputa Física.\n' +
      'O Ímpeto dura até o fim do combate e pode ser consumido por suas Técnicas.',
  },
  {
    categoria: 'tecnica',
    nome: 'Punhos de Pedra',
    atkMod: '2d4+FOR',
    pas: '--',
    gastos: 'Passiva',
    descricao:
      'Graças ao seu treinamento contínuo, Skar se especializou em combate desarmado.\n' +
      'Seus ataques desarmados causam 2d4 de dano, ao invés de 1d4.\n' +
      'Ao acertar um ataque desarmado, Skar pode gastar 1 Ímpeto para causar +1d4 de dano adicional.',
  },
  {
    categoria: 'tecnica',
    nome: 'Guarda de Impacto',
    atkMod: '--',
    pas: 'Reação ou 2 PA',
    gastos: '2 STA',
    custos: [{ recurso: 'STA', valor: 2 }],
    descricao:
      'Contra um ataque corpo a corpo, Skar pode realizar uma Disputa Física contra o atacante.\n' +
      'Se vencer, bloqueia o ataque ao interceptar o braço, arma ou movimento do inimigo.\n' +
      'Não permite bloquear diretamente lâminas, pontas ou outras partes perigosas da arma. (Pode gastar 1 de Ímpeto para receber 1 impulso na Def.)',
  },
  {
    categoria: 'tecnica',
    nome: 'Duro na Queda',
    atkMod: '--',
    pas: 'Ativo',
    gastos: '1 STA',
    custos: [{ recurso: 'STA', valor: 1 }],
    descricao:
      'Graças ao seu intenso treinamento, o corpo de Skar se tornou capaz de suportar impactos violentos.\n' +
      'Uma vez por rodada, ao receber dano físico, Skar pode reduzir o dano sofrido em 10% + 2% por ponto de Constituição. (Caso utilize esta skill em um teste de Constituição, ignora o custo extra de STA.)\n' +
      'Ímpeto: pode gastar 1 Ímpeto para aplicar essa redução a um segundo ataque na mesma rodada.',
  },
  {
    categoria: 'habilidade',
    nome: 'Caminho Digno',
    atkMod: '--',
    pas: '--',
    gastos: '--',
    descricao:
      'A Dama não recompensa oração. Ela recompensa conduta.\n' +
      'Ela não exige joelhos no chão, mas firmeza diante daquilo que corrompe, ameaça ou desvia o caminho digno.\n' +
      'Ela estará sempre observando suas escolhas, não suas palavras.\n' +
      'Cada ato de coragem, disciplina, proteção e integridade fortalece sua ligação com ela. Da mesma forma, cada desvio desse caminho enfraquece sua presença.\n' +
      'A Dama não pede que você diga no que acredita. Ela espera que você prove.',
  },
  {
    categoria: 'talento',
    nome: 'Dupla Empunhadura',
    atkMod: '--',
    pas: '1 PA',
    gastos: '1 STA',
    custos: [{ recurso: 'STA', valor: 1 }],
    descricao:
      'Uma vez por turno, após atacar com uma arma de uma mão, pode gastar 1 PA e 1 STA para atacar com outra arma de uma mão.\n' +
      'O segundo ataque adiciona normalmente o atributo ao dano.',
  },
];
