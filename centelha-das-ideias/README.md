# Claude — A Centelha das Ideias

Aventura 3D (Three.js) em que o Claude explora ilhas flutuantes onde as ideias viraram lugares.

## Jogar

- **Link:** https://claude.ai/artifact/NNYiRYmQDY8fcm7PwDtSHy
- **Arquivo único (offline):** `pnpm install && pnpm compilar` e abra `dist/index.html` no navegador.

### Controles

| Ação | Teclado/mouse | Celular |
| --- | --- | --- |
| Andar / correr | WASD ou setas / Shift | Arrastar no lado esquerdo (até a borda corre) |
| Pular | Espaço | Pular |
| Atacar / especial | J ou clique / L ou botão direito | Atacar / Especial |
| Esquivar | C ou K | Esquiva |
| Falar / usar | E | Usar |
| Observar / Conectar / Criar | Q / R / F | botões que aparecem ao aprender |
| Trocar arma | 1–6 ou roda do mouse | Arma |
| Mapa / pausa | M / Esc | Mapa / II |

Andar, pular e atacar funcionam ao mesmo tempo (também no toque).

## Desenvolvimento

```bash
pnpm install
pnpm iniciar          # servidor local em http://127.0.0.1:5173
pnpm tipos            # checagem de tipos
pnpm testar           # testes do núcleo (fronteira, salvamento, armas, diálogos)
node testes/e2e/rota.mjs   # joga a história inteira automaticamente (precisa do servidor)
pnpm compilar && node ferramentas/gerar-artefato.mjs   # arquivo único + versão para publicar
```

Documentação: `docs/design.md` (seção 13 descreve a versão 3D), `docs/tecnologia.md` (referências oficiais).
