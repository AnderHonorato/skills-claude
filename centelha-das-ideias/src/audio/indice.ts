/**
 * Áudio procedural (RESPONSÁVEL: agente de Música e Efeitos Sonoros).
 * Versão provisória do orquestrador: silenciosa.
 */
import type { ApiAudio } from '../contratos/audio';

export function criarAudio(): ApiAudio {
  const volumes = { geral: 0.8, musica: 0.6, efeitos: 0.8 };
  return {
    desbloquear() {},
    tocar() {},
    musica() {},
    definirIntensidade() {},
    definirVolume(canal, valor) {
      volumes[canal] = valor;
    },
    volume: (canal) => volumes[canal],
    suspender() {},
    definirOuvinte() {},
  };
}
