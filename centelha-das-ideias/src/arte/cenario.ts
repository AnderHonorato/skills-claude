/**
 * Cenário procedural (RESPONSÁVEL: agente de Arte de Cenário).
 * Versão provisória do orquestrador: formas simples só para validar o motor.
 * As assinaturas exportadas são contrato — não mude sem passar pelo orquestrador.
 */
import { BLOCO } from '../configuracao';
import type { CameraVisao, ConsultaMapa, Luz, VisualMecanismo } from '../contratos/arte';
import type { IdTema } from '../contratos/base';
import { PALETA, ajustarCor } from './paleta';

/** Cor sólida de fundo de tela por tema (vazio). */
export function corFundo(tema: IdTema): string {
  switch (tema) {
    case 'oficina':
      return PALETA.vazioNoite;
    case 'farol':
      return PALETA.mar;
    case 'vale':
      return '#3B3549';
    case 'construcao':
      return '#2C3550';
    default:
      return '#2E4A3C';
  }
}

/**
 * Fundo em coordenadas de TELA (px CSS), desenhado antes do mundo. Ex.: céu estrelado,
 * mar com reflexos, névoa distante — com leve paralaxe usando `camera`.
 */
export function desenharFundo(
  ctx: CanvasRenderingContext2D,
  tema: IdTema,
  camera: CameraVisao,
  tempo: number,
  larguraTela: number,
  alturaTela: number
): void {
  ctx.fillStyle = corFundo(tema);
  ctx.fillRect(0, 0, larguraTela, alturaTela);
}

/**
 * Pinta o chão estático de um pedaço retangular de blocos (em coordenadas do mundo).
 * Chamado raramente (cache). Deve desenhar: grama, trilhas, água (base), pedras de travessia,
 * pontes, bordas de ilhas sobre o vazio (espessura de terra), detalhes determinísticos.
 * NÃO desenhe aqui o que tem volume (paredes, árvores, plataformas): isso é desenharBlocoAlto.
 * Vazio deve ficar transparente (o fundo aparece).
 */
export function pintarPedaco(
  ctx: CanvasRenderingContext2D,
  consulta: ConsultaMapa,
  tx0: number,
  ty0: number,
  largura: number,
  altura: number
): void {
  for (let ty = ty0; ty < ty0 + altura; ty++) {
    for (let tx = tx0; tx < tx0 + largura; tx++) {
      const c = consulta.bloco(tx, ty);
      if (c === ' ' || c === 'w') {
        if (c === 'w') {
          ctx.fillStyle = PALETA.aguaFunda;
          ctx.fillRect(tx * BLOCO, ty * BLOCO, BLOCO, BLOCO);
        }
        continue;
      }
      const tema = consulta.tema(tx, ty);
      let cor: string = PALETA.grama;
      if (c === ':') cor = PALETA.trilha;
      else if (c === '=' || c === 'b') cor = PALETA.madeira;
      else if (c === '_' || c === 's') cor = PALETA.pedra;
      else if (c === '+') cor = PALETA.cobre;
      else if (c === '~') cor = PALETA.agua;
      else if (tema === 'oficina') cor = PALETA.madeira;
      else if (tema === 'farol') cor = PALETA.pedraClara;
      const v = consulta.semente(tx, ty) * 0.06 - 0.03;
      ctx.fillStyle = ajustarCor(cor, v);
      ctx.fillRect(tx * BLOCO, ty * BLOCO, BLOCO + 0.5, BLOCO + 0.5);
      // espessura de terra em bordas sobre o vazio
      const sul = consulta.bloco(tx, ty + 1);
      if (sul === ' ') {
        ctx.fillStyle = PALETA.terraEscura;
        ctx.fillRect(tx * BLOCO, (ty + 1) * BLOCO, BLOCO + 0.5, 14);
      }
    }
  }
}

/** Animações sobre o chão (brilho da água, ondulações). Área em blocos, contexto no mundo. */
export function desenharAnimacoesChao(
  ctx: CanvasRenderingContext2D,
  consulta: ConsultaMapa,
  area: { tx0: number; ty0: number; tx1: number; ty1: number },
  tempo: number
): void {
  // provisório: nada
}

/**
 * Blocos com volume (paredes, árvores, rochas, cercas, plataformas, paredes rachadas,
 * espinhos de Ruído e a FRONTEIRA 'F'). Desenhado na passada ordenada por profundidade.
 * `transparente` = 0..1 quando Claude está atrás (copas ficam translúcidas).
 */
export function desenharBlocoAlto(
  ctx: CanvasRenderingContext2D,
  codigo: string,
  tx: number,
  ty: number,
  consulta: ConsultaMapa,
  tempo: number,
  transparente: number
): void {
  const x = tx * BLOCO;
  const y = ty * BLOCO;
  switch (codigo) {
    case '#': {
      const h = 40;
      ctx.fillStyle = PALETA.pedraEscura;
      ctx.fillRect(x, y + BLOCO - h, BLOCO, h);
      ctx.fillStyle = PALETA.pedraClara;
      ctx.fillRect(x, y - h, BLOCO, BLOCO);
      break;
    }
    case 'T': {
      ctx.fillStyle = PALETA.madeiraEscura;
      ctx.fillRect(x + 12, y + 6, 8, 22);
      ctx.globalAlpha = 1 - transparente * 0.55;
      ctx.fillStyle = PALETA.gramaEscura;
      ctx.beginPath();
      ctx.arc(x + 16, y - 10, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'o':
      ctx.fillStyle = PALETA.pedra;
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 18, 13, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'h':
      ctx.fillStyle = PALETA.madeira;
      ctx.fillRect(x, y + 10, BLOCO, 4);
      ctx.fillRect(x, y + 18, BLOCO, 4);
      break;
    case 'P':
    case 'Q': {
      const h = codigo === 'P' ? 24 : 48;
      ctx.fillStyle = PALETA.terra;
      ctx.fillRect(x, y + BLOCO - h, BLOCO, h);
      ctx.fillStyle = PALETA.gramaClara;
      ctx.fillRect(x, y - h, BLOCO + 0.5, BLOCO + 0.5);
      break;
    }
    case 'X':
      ctx.fillStyle = PALETA.pedra;
      ctx.fillRect(x, y - 40 + BLOCO, BLOCO, 40);
      ctx.strokeStyle = PALETA.ardosia;
      ctx.beginPath();
      ctx.moveTo(x + 8, y - 4);
      ctx.lineTo(x + 18, y + 14);
      ctx.lineTo(x + 12, y + 24);
      ctx.stroke();
      break;
    case 'r':
      ctx.fillStyle = PALETA.ruido;
      ctx.beginPath();
      ctx.arc(x + 16, y + 14, 13, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'F':
      ctx.fillStyle = PALETA.rascunho;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y - 56 + BLOCO, BLOCO, 56);
      ctx.globalAlpha = 1;
      break;
  }
}

/** Objetos decorativos posicionados por dados (`tipo: 'decoracao'`). */
export function desenharDecoracao(
  ctx: CanvasRenderingContext2D,
  modelo: string,
  x: number,
  ySolo: number,
  tempo: number,
  escala: number
): void {
  ctx.fillStyle = PALETA.areia;
  ctx.fillRect(x - 4 * escala, ySolo - 12 * escala, 8 * escala, 12 * escala);
}

/** Mecanismos e objetos interativos (fontes, portas, placas, baús...). */
export function desenharMecanismo(ctx: CanvasRenderingContext2D, v: VisualMecanismo): void {
  ctx.fillStyle = v.energizado ? PALETA.luz : PALETA.energiaDesligada;
  ctx.fillRect(v.x - 6, v.ySolo - 14, 12, 14);
}

/**
 * Atmosfera em coordenadas de TELA (px CSS) depois do mundo: névoa do Ruído (0..1),
 * vinheta, luz ambiente e as `luzes` pontuais convertidas por `paraTela`.
 */
export function desenharAtmosfera(
  ctx: CanvasRenderingContext2D,
  tema: IdTema,
  camera: CameraVisao,
  tempo: number,
  luzes: readonly Luz[],
  ruido: number,
  larguraTela: number,
  alturaTela: number,
  paraTela: (x: number, y: number) => { x: number; y: number }
): void {
  if (ruido > 0) {
    ctx.fillStyle = `rgba(110, 100, 130, ${0.18 * ruido})`;
    ctx.fillRect(0, 0, larguraTela, alturaTela);
  }
}

/**
 * Chave de profundidade de um bloco alto. Padrão: borda superior do bloco (ty * BLOCO);
 * árvores usam o meio do bloco. Ver docs/contratos.md (ordenação).
 */
export function profundidadeBloco(codigo: string, tx: number, ty: number): number {
  return ty * BLOCO + (codigo === 'T' ? BLOCO / 2 : 0);
}
