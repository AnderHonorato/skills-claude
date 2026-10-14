import { describe, expect, it } from 'vitest';
import { ARMAS, nivelPorXp, XP_NIVEIS } from '../../src/dados/armas';
import { DIALOGOS } from '../../src/dados/dialogos';
import { MISSOES } from '../../src/dados/missoes';
import {
  alemDaFronteira,
  FRONTEIRA,
  INICIO,
  MENSAGEM_FRONTEIRA,
  montarSolidos,
  PONTO_CHECKPOINT,
  RAMPAS,
} from '../../src/dados/mundo';
import { NPCS } from '../../src/dados/npcs';
import { EstadoProgresso } from '../../src/nucleo/estado';
import { MundoFisico } from '../../src/nucleo/fisica';
import {
  migrar,
  posicaoSegura,
  salvamentoVazio,
  VERSAO_SALVAMENTO,
} from '../../src/nucleo/salvamento';
import type { Fronteira } from '../../src/nucleo/tipos';

function mundo(flags: string[] = []) {
  const f = new Set(flags);
  return new MundoFisico(montarSolidos(), RAMPAS, (x) => f.has(x));
}

describe('fronteira', () => {
  it('tem a mensagem exata pedida', () => {
    expect(MENSAGEM_FRONTEIRA).toBe(
      'Esta região está em desenvolvimento. A aventura continua nas próximas atualizações.'
    );
    expect(FRONTEIRA.mensagem).toBe(MENSAGEM_FRONTEIRA);
  });

  it('bloqueia quem anda contra ela (colisão real)', () => {
    const m = mundo();
    const p = { x: FRONTEIRA.x, z: FRONTEIRA.z + 0.3 };
    const r = m.resolver(p, 0, 0.42, 1.1);
    expect(r.fronteira).toBe(true);
    expect(p.z).toBeGreaterThan(FRONTEIRA.z + FRONTEIRA.d / 2);
  });

  it('não dá para pular por cima nem atravessar com esquiva rápida', () => {
    const m = mundo();
    // mesmo a 8 m de altura a parede ainda bloqueia
    const p = { x: FRONTEIRA.x, z: FRONTEIRA.z };
    expect(m.resolver(p, 8, 0.42, 1.1).fronteira).toBe(true);
    // movimento em passos de 1/60 s a 16 m/s nunca termina do outro lado
    const q = { x: FRONTEIRA.x, z: FRONTEIRA.z + 3 };
    for (let i = 0; i < 60; i++) {
      q.z -= 16 / 60;
      m.resolver(q, 0, 0.42, 1.1);
    }
    expect(alemDaFronteira(q)).toBe(false);
  });

  it('bloqueia a linha das habilidades (Conectar, projéteis)', () => {
    const m = mundo();
    expect(m.linhaLivre(FRONTEIRA.x, FRONTEIRA.z + 3, FRONTEIRA.x, FRONTEIRA.z - 3, 1)).toBe(false);
  });
});

describe('salvamento', () => {
  it('migra o formato v1 (protótipo 2D) para o atual', () => {
    const v1 = {
      versao: 1,
      criadoEm: 5,
      jogador: { armas: ['galho', 'espadaMadeira', 'inexistente'], vidaMaxima: 7 },
      configuracoes: { volumeGeral: 0.3 },
    };
    const d = migrar(v1)!;
    expect(d.versao).toBe(VERSAO_SALVAMENTO);
    expect(Object.keys(d.armas).sort()).toEqual(['espada', 'galho']);
    expect(d.vidaMaxima).toBe(7);
    expect(d.configuracoes.volumeGeral).toBe(0.3);
  });

  it('recusa lixo e versões futuras', () => {
    expect(migrar(null)).toBeNull();
    expect(migrar({ versao: 99 })).toBeNull();
    expect(migrar('texto')).toBeNull();
  });

  it('posição além da fronteira volta para um lugar seguro', () => {
    const m = mundo();
    const r = posicaoSegura(m, FRONTEIRA, alemDaFronteira, { x: -2, z: -136 }, [INICIO]);
    expect(r.corrigida).toBe(true);
    expect(alemDaFronteira(r)).toBe(false);
    expect(m.pontoValido(r.x, r.z)).toBe(true);
  });

  it('expansão: mover a fronteira mantém salvamentos antigos válidos', () => {
    const m = mundo();
    const nova: Fronteira = { ...FRONTEIRA, z: -150 };
    const alemNova = (p: { z: number }, f: Fronteira) => p.z < f.z;
    // quem estava antes da fronteira antiga continua onde estava
    const r = posicaoSegura(m, nova, alemNova, { x: 0, z: 3 }, [INICIO]);
    expect(r.corrigida).toBe(false);
    expect(r.x).toBe(0);
  });

  it('posição no vazio ou dentro de parede é corrigida', () => {
    const m = mundo();
    const vazio = posicaoSegura(m, FRONTEIRA, alemDaFronteira, { x: 100, z: 100 }, [
      PONTO_CHECKPOINT['pedra-jardim'],
    ]);
    expect(vazio.corrigida).toBe(true);
    expect(m.pontoValido(vazio.x, vazio.z)).toBe(true);
  });

  it('salvamento vazio passa pela validação', () => {
    expect(migrar(salvamentoVazio())?.versao).toBe(2);
  });
});

describe('armas e níveis', () => {
  it('sobe de nível com experiência e avisa', () => {
    const e = new EstadoProgresso();
    const avisos: string[] = [];
    e.aoAviso = (a) => avisos.push(a.tipo);
    e.darArma('galho');
    e.ganharXp(XP_NIVEIS[1]);
    expect(e.nivelArma()).toBe(2);
    expect(avisos).toContain('nivel');
    e.ganharXp(10000);
    expect(nivelPorXp(e.armas.galho!.xp)).toBe(5);
  });

  it('toda arma tem especial e descrição de níveis', () => {
    for (const a of Object.values(ARMAS)) {
      expect(a.niveis).toHaveLength(5);
      expect(a.especial.nome.length).toBeGreaterThan(3);
    }
  });
});

describe('diálogos e missões', () => {
  it('todos os nós e opções apontam para nós existentes', () => {
    for (const [id, no] of Object.entries(DIALOGOS)) {
      if (no.proximo) expect(DIALOGOS[no.proximo], `${id} → ${no.proximo}`).toBeDefined();
      for (const o of no.opcoes ?? [])
        if (o.proximo) expect(DIALOGOS[o.proximo], `${id} → ${o.proximo}`).toBeDefined();
      for (const ef of [
        ...(no.efeitos ?? []),
        ...(no.opcoes ?? []).flatMap((o) => o.efeitos ?? []),
      ]) {
        if (ef.tipo === 'iniciarMissao' || ef.tipo === 'concluirMissao')
          expect(MISSOES[ef.id], ef.id).toBeDefined();
      }
    }
  });

  it('cada NPC tem conversa de entrada e de desculpas', () => {
    for (const n of NPCS) {
      for (const c of n.conversas) expect(DIALOGOS[c.inicio], c.inicio).toBeDefined();
      expect(n.conversas.some((c) => c.quando?.flag === `bravo_${n.id}`)).toBe(true);
    }
  });

  it('escolhas mudam o resultado (Bento dá as duas ferramentas só com afinidade)', () => {
    const e = new EstadoProgresso();
    const opcoes = DIALOGOS.bento_escolha.opcoes!;
    const visiveis = () => opcoes.filter((o) => e.avaliar(o.quando)).map((o) => o.proximo);
    expect(visiveis()).toContain('bento_nao_dois');
    e.afinidade.bento = 2;
    expect(visiveis()).toContain('bento_dois');
    expect(visiveis()).not.toContain('bento_nao_dois');
  });

  it('nenhuma fala é texto de teste ou vazia', () => {
    for (const no of Object.values(DIALOGOS)) {
      expect(no.fala.trim().length).toBeGreaterThan(10);
      expect(no.fala.toLowerCase()).not.toMatch(/\b(teste|lorem|placeholder|xxx)\b/);
    }
  });
});
