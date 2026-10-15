/**
 * Vozes: falas reais em português com a síntese de voz do navegador (cada personagem
 * com tom e ritmo próprios) e, quando ela não existe, bipes sintetizados que imitam a
 * entonação. Inimigos resmungam com vozes de formante geradas na hora.
 */
import type { ApiAudio } from '../audio/contrato';
import type { Voz } from './dados/personagens';

export class Vozes {
  ativo = true;
  private ultimo = 0;
  private vozPt: SpeechSynthesisVoice | null = null;
  private disponivel: boolean;

  constructor(private audio: ApiAudio) {
    this.disponivel = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (this.disponivel) {
      const escolher = () => {
        const vozes = window.speechSynthesis.getVoices();
        this.vozPt =
          vozes.find((v) => v.lang === 'pt-BR') ??
          vozes.find((v) => v.lang.startsWith('pt')) ??
          null;
      };
      escolher();
      window.speechSynthesis.addEventListener?.('voiceschanged', escolher);
    }
  }

  /** Fala uma linha (com intervalo mínimo para não encavalar). */
  falar(texto: string, voz: Voz, prioridade = false, volume = 1): void {
    if (!this.ativo) return;
    const agora = performance.now();
    if (!prioridade && agora - this.ultimo < 3500) return;
    this.ultimo = agora;
    if (this.disponivel && this.vozPt) {
      try {
        if (prioridade) window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(texto);
        u.voice = this.vozPt;
        u.lang = 'pt-BR';
        u.pitch = voz.tom;
        u.rate = voz.ritmo;
        u.volume = Math.min(
          1,
          this.audio.volume('efeitos') * this.audio.volume('geral') * 1.3 * volume
        );
        window.speechSynthesis.speak(u);
        return;
      } catch {
        /* cai para os bipes */
      }
    }
    // bipes com entonação, uma sílaba a cada ~70 ms
    const silabas = Math.min(14, Math.max(3, Math.round(texto.length / 3)));
    for (let i = 0; i < silabas; i++) {
      window.setTimeout(
        () => this.audio.tocar('falaClaude', { voz: voz.bipe, volume: 0.8 * volume }),
        i * 75
      );
    }
  }

  /** Resmungo curto de inimigo (formantes). */
  resmungar(voz: string, x: number, z: number): void {
    if (!this.ativo) return;
    this.audio.tocar('falaNpc', { voz, x, y: z, volume: 0.7 });
  }

  silenciar(): void {
    if (this.disponivel) window.speechSynthesis.cancel();
  }
}
