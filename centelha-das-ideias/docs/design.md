# Claude — A Centelha das Ideias · Documento de Design

> Documento vivo. Mudanças estruturais passam pelo orquestrador e são registradas em `docs/registro.md`.

## 1. Visão

Aventura 2D de ação, exploração e pequenos enigmas, com câmera elevada (vista 3/4, semelhante à leitura espacial de jogos MOBA), em um mundo onde **ideias viram lugares vivos**. A tempestade de **Ruído** fragmentou o mundo: pontes de pensamento caíram, fios de energia apagaram e criaturas ficaram confusas. **Claude**, o mascote terracota de corpo geométrico, reconecta as regiões **observando, conectando e criando**.

A mensagem nasce do que o jogador faz: entender antes de agir, experimentar, errar sem punição pesada e tentar de novo com mais força. Sem palestras e sem diálogos longos.

A história **não tem final definitivo**: cada atualização acrescenta regiões ao mesmo mundo. A primeira entrega fecha objetivos locais (o Farol volta a brilhar) e termina numa fronteira física "em desenvolvimento".

## 2. Pilares

1. **Conectar ideias transforma o ambiente** — toda habilidade muda o mundo, não só causa dano.
2. **Personalidade visível** — Claude reage com olhos, postura e ritmo ao que acontece.
3. **Novidade a cada 1–2 minutos** — regra, inimigo, ferramenta, segredo ou consequência visual.
4. **Errar ensina** — falhas geram frustração breve e depois determinação (bônus leve explicado).

## 3. Controles

| Ação | Teclado + mouse | Toque |
| --- | --- | --- |
| Mover | WASD / setas | Joystick virtual (esquerda); empurrar até a borda corre |
| Correr | Shift (segurar) | Joystick no limite |
| Pular | Espaço | Botão Pular |
| Esquivar | C ou botão direito | Botão Esquivar |
| Atacar | Clique esquerdo ou J (mira no mouse) | Botão Atacar (mira automática) |
| Interagir / falar | E | Botão contextual (aparece perto de algo) |
| Observar | Q | Botão Olho |
| Conectar | R (alvo sob o mouse ou mais próximo à frente) | Botão Fio (toque = mira automática; arrastar = mirar) |
| Criar | F | Botão Molde |
| Trocar arma | 1–4 / roda do mouse | Toque no ícone da arma |
| Usar Caldo (cura) | H | Botão do item |
| Mapa | M ou Tab | Botão Mapa |
| Pausa | Esc ou P | Botão Pausa |

Avançar falas: E, Espaço, Enter, clique ou toque. Pular conversa: botão "Pular" ou Esc.

## 4. Claude

- Vida: 3 corações (até 6 com melhorias). Inspiração (barra): 3 cargas iniciais (até 5).
- Movimento: andar 90 px/s, correr 150 px/s, aceleração suave, oito direções.
- Pulo: impulso 260 px/s, gravidade 900 px/s² → ápice ≈ 37 px, ≈ 0,58 s no ar. Andando atravessa 1 bloco de vão; correndo, 2. Plataformas de 24 px exigem pulo. Botas de Mola elevam o impulso para 330 px/s (alcança 48 px).
- Esquiva: impulso curto (0,22 s), invulnerável por 0,25 s, recarga 0,6 s. Não atravessa paredes nem a fronteira.
- Queda em vão: animação de queda e retorno ao último chão seguro com 1 de dano (nunca fatal). Humor: frustrado → determinado.
- Derrota: tela curta "Tentar de novo" → volta à última Pedra-Memória com vida cheia. Enigmas resolvidos permanecem resolvidos.

### Humor (expressões)

| Humor | Gatilhos reais | Sinais visuais |
| --- | --- | --- |
| Neutro | padrão | olhos retos, piscar periódico |
| Curioso | Observar revela algo, segredo próximo, nova região, objeto desconhecido | olhos maiores, leve inclinação, faísca de dúvida desenhada |
| Concentrado | dentro de zona de enigma, mirando Conectar | olhos semicerrados, corpo levemente abaixado, ritmo lento |
| Alegre | ajudar NPC, enigma resolvido, item obtido, missão concluída | olhos em arco, saltinho, brilho; animação de comemoração |
| Assustado | inimigo percebe Claude, chefe aparece, dano com vida baixa | olhos arregalados, recuo, tremor curto |
| Frustrado (breve) | conexão errada, queda em vão, derrota | olhos inclinados, ombros caídos, nuvenzinha |
| Determinado | logo após frustração/derrota, antes do chefe | sobrancelha firme (borda superior reta), postura ereta |

Efeito mecânico leve e explicado: **Determinação** — após falhar (queda, derrota, enigma errado), habilidades recarregam 25% mais rápido por 10 s. Texto no jogo: "Aprender com o erro: recarga mais rápida".

Transições: interpolação de forma dos olhos em ~0,25 s; prioridade por evento; volta ao neutro após duração. O retrato no HUD espelha o humor.

## 5. Habilidades (núcleo)

### Observar (Q) — Jardim
Onda que se expande (raio 6 blocos; 9 com Lente Ampla). Por 6 s revela: runas e símbolos ocultos, prismas e caminhos invisíveis, pontos fracos de inimigos (dano ×2 enquanto revelado), pegadas de investigação, ligações sugeridas entre nós (linhas tracejadas). Recarga 2 s. Gera 0,25 de inspiração ao revelar algo novo.

### Conectar (R) — Oficina
Lança um **Fio de Ideia** do nó mais próximo ao alvo (alcance 7 blocos, linha de visão obrigatória — paredes e a fronteira bloqueiam). Primeiro toque seleciona a origem; segundo liga ao destino. Máximo de 2 conexões simultâneas (3 com Carretel Duplo); a mais antiga se desfaz ao exceder.

Pares e efeitos:
- Fonte ↔ Receptor/Prisma: energiza (cadeias por prismas). Receptor energizado ativa seus alvos (porta, ponte retrátil, plataforma móvel, lâmpada, engrenagem).
- Fonte ↔ Inimigo: choque — atordoa 2,5 s e causa 1 de dano; escudos caem. Consome a conexão.
- Inimigo ↔ Inimigo: amarra por 5 s (ambos lentos; dano em um repercute 50% no outro).
- Conexão errada (tipos incompatíveis) falha com faísca cinza e humor frustrado breve.

### Criar (F) — Vale
Gasta 1 carga de inspiração. Resultado depende do contexto:
1. **Ponte de Luz** — perto de uma Âncora com par: ponte entre as âncoras por 10 s (pisca nos 2 s finais).
2. **Escudo Refletor** — sem âncora por perto: bolha de 3 s que bloqueia e devolve projéteis.
3. **Aliado de Luz** (após resgatar os vagalumes) — segurando Criar perto de uma placa de pressão ou de inimigos: vagalume que fica sobre a placa ou distrai e ataca por 8 s.

Inspiração: recarrega 1 carga a cada 12 s, +0,25 por acerto em inimigo, +0,25 por descoberta com Observar, +1 por Centelha coletada.

### Combinações (introduzidas em ordem)
1. Observar revela prisma oculto → Conectar cadeia (Oficina).
2. Conectar Fonte ↔ Inimigo derruba escudo do Casco → ataque com arma (Vale).
3. Observar revela ponto fraco → golpe de Martelo (Vale).
4. Conectar ativa plataforma móvel → pular sobre ela no tempo certo (Oficina).
5. Criar Ponte de Luz + pular vão + Conectar do outro lado (Farol).
6. Chefe: Conectar lentes ao núcleo, pular ondas de choque, Criar ponte até o núcleo exposto, Observar ponto fraco.

## 6. Armas

| Arma | Onde | Alcance | Velocidade | Dano | Impacto | Uso especial |
| --- | --- | --- | --- | --- | --- | --- |
| Espada de Madeira | Jardim (tronco) | arco 110°, 30 px | 0,32 s, combo de 3 | 1 | leve | corta espinhos de Ruído |
| Colher Gigante | Oficina (Seu Caldo) | arco 140°, 26 px | 0,48 s | 1,5 | arremessa pequenos para cima | rebate projéteis no golpe |
| Martelo de Borracha | Vale | círculo 34 px à frente | 0,8 s | 3 | onda de choque, quica | quebra escudos e paredes rachadas |
| Cajado de Ideias | Oficina (segredo opcional) | projétil 6 blocos | 0,55 s | 1 | faísca | ativa fontes/cristais à distância |

Sons fofos com variação de tom; acerto, erro (whoosh) e dano recebido sempre distintos.

## 7. Inimigos (criaturas de Ruído)

Todos: patrulha → percepção (cone 5 blocos + audição 2 blocos) → alerta (pequeno "!" desenhado, 0,4 s) → perseguição → ataque telegrafado → retorno à área (coleira 8 blocos). Recompensa: centelhas de inspiração e às vezes coração.

- **Chiado** (corpo a corpo, vida 3): agacha e pisca 0,5 s, depois dá um bote curto. Pode ser esquivado ou interrompido com golpe forte.
- **Eco** (distância, vida 3): mantém distância, carrega anel 0,7 s e dispara onda lenta (3 ondas em leque no Vale). Foge se Claude chega perto. Ondas podem ser refletidas pelo Escudo ou rebatidas pela Colher.
- **Casco** (defensivo, vida 6): escudo frontal bloqueia golpes frontais. Golpe de pancada com círculo telegrafado no chão por 0,9 s. Estratégias: atacar pelas costas, quebrar escudo com Martelo, choque com Conectar, ponto fraco revelado por Observar.
- **Cortador** (suporte, vida 2): procura conexões ativas e corta fios; foge da luz. Aparece na Oficina e no Farol.
- **Chefe — O Rumor** (Farol): núcleo dentro de nuvem de estática. Fase 1: escudo; conectar 3 lentes ao núcleo enquanto desvia de rajadas. Fase 2: invoca Chiados e Ecos; ondas de choque circulares que exigem pulo. Fase 3: recua sobre o vão; Criar Ponte de Luz entre âncoras, Observar ponto fraco e golpear. Derrota → o Farol reacende.

## 8. Mundo e roteiro (primeira entrega)

Disposição (blocos de 32 px):

```
             [Farol das Ideias] ──► [Fronteira: região em desenvolvimento]
                    ▲
[Oficina] ───► [Vale do Ruído]
    ▲
[Jardim]
```

Duração-alvo da primeira partida: 12–18 min de jogo ativo (mínimo 10).

### 8.1 Jardim das Perguntas (~3,5 min) — descoberta
1. Despertar na clareira; trilha de pegadas ensina mover e correr.
2. Riacho com pedras: ensina pulo (dica contextual).
3. Espada de Madeira presa num tronco → espinhos de Ruído bloqueiam a trilha (ensina ataque).
4. **Sálvia** (tartaruga jardineira, fala por perguntas) — flores fechadas. Missão **Flores Fechadas** (investigação/enigma). Santuário da Pergunta desbloqueia **Observar**.
5. Observar revela 3 runas e o padrão das pétalas → ordem das runas abre a Raiz-Mãe. Dicas graduais: cenário (pétalas), depois Sálvia.
6. Clareira com 2 Chiados (combate e esquiva). **Pipo** (faísca agitada) preso numa gaiola de estática → libertar. Missão opcional **Faíscas Perdidas** (3 irmãos escondidos no mundo).
7. Fonte das Perguntas: Observar a fonte reabre as flores (consequência visual: cor volta ao Jardim). Recompensa: +1 coração. Pedra-Memória. Caminho ao norte para a Oficina.

### 8.2 Oficina das Conexões (~4 min) — enigmas e combinações
1. Entrada por plataformas suspensas sobre o vazio estrelado (pulo + plataformas elevadas).
2. **Bia Bobina** (lontra inventora, fala rápido, erra e tenta de novo) — oficina sem energia. Carretel de Ideias desbloqueia **Conectar**. Enigma 1: Fonte → Receptor abre porta.
3. Enigma 2: fonte longe demais; prisma oculto (Observar) faz cadeia Fonte → Prisma → Receptor.
4. Enigma 3: empurrar caixa-prisma até a marca e conectar; placa de pressão segura porta.
5. Enigma 4: plataforma móvel energizada atravessa vão (tempo + pulo).
6. Ecos e um Cortador: Conectar Fonte ↔ Eco atordoa.
7. **Seu Caldo** (panela falante, cozinheiro) — missão **Sopa de Ideias** (investigação): pegadas reveladas por Observar levam ao Chiado que levou a concha; fogão exige duas conexões simultâneas. Recompensa: **Colher Gigante** + 2 Caldos.
8. Grande Engrenagem: três receptores ligados reiniciam a engrenagem (engrenagens giram, luzes acendem) e abrem a estrada leste. Pedra-Memória.
9. Segredo: sala do Cajado de Ideias (enigma opcional com cadeia longa).

### 8.3 Vale do Ruído (~4 min) — combate, resgates e escolhas
1. Névoa de Ruído, Claude assustado. **Capitã Lume** (vagalume batedora, corajosa e dramática) — esquadrão capturado. Missão **Luzes do Esquadrão** (resgate). Molde de Luz desbloqueia **Criar**. Tutorial: Ponte de Luz sobre o rio.
2. Escolha de percurso: **Trilha Alta** (plataformas, pontes de luz, segredo com Faísca) ou **Trilha da Ponte** (combate com Casco; baú com **Martelo de Borracha**). Ambos levam às gaiolas; o Martelo também é recompensa garantida do resgate.
3. Três gaiolas, três situações: matilha de Chiados; Ecos em terreno alto (Escudo Refletor); Casco (costas, Martelo, choque ou ponto fraco).
4. Resgate concluído → **Aliado de Luz**. Portão final com duas placas de pressão: Claude numa, Aliado na outra.
5. **Ressoa** (Eco que não se corrompeu) — falas curtas sobre a origem do Ruído (ideias abandonadas). Missão opcional **Paredes que Falam**: paredes rachadas com murais (Martelo + Observar).
6. Pedra-Memória antes do Farol.

### 8.4 Farol das Ideias (~3 min + chefe) — clímax local
1. Subida em espiral: plataformas invisíveis (Observar), cadeia de lentes (Conectar), ponte de luz (Criar), pulos.
2. Topo: chefe **O Rumor** (3 fases).
3. Vitória: cena pulável — o feixe do Farol varre o mundo; regiões restauradas (cores, flores, luzes, NPCs comemoram). Claude comemora.
4. O feixe revela um caminho para leste: **fronteira em desenvolvimento**.

### 8.5 Depois do Farol (opcional)
- Faíscas Perdidas (3) → cada uma dá +1 de inspiração máxima.
- Desafio do Jardim: corrida das pegadas (tempo).
- Arena de Ecos no Vale (desafio de combate com placar curto, opcional).
- Enigmas extras e baús escondidos (Lente Ampla, Carretel Duplo, Botas de Mola).
- Diálogos dos NPCs mudam após a vitória.

## 9. Fronteira em desenvolvimento

- Definida **somente** em `src/dados/mundo.ts` (`fronteira`): retângulo em blocos, região futura e mensagem.
- Parede física: andaimes de luz e blocos de rascunho sendo desenhados (animação discreta), colisão de altura infinita, bloqueia caminhada, pulo, esquiva, projéteis, conexões (linha de visão) e criações.
- Ao se aproximar (raio 4 blocos): balão/aviso "Esta região está em desenvolvimento. A aventura continua nas próximas atualizações."
- Nunca encerra a partida nem mostra créditos. No mapa: área hachurada "Região em construção".
- Expansão: cadastrar a nova região em `MUNDO.regioes`, mover a fronteira para o novo limite e registrar a antiga em `fronteirasAnteriores` (usada pela migração para reposicionar jogadores com segurança).

## 10. Progressão e salvamento

- Pedras-Memória: salvam, restauram vida e servem de retorno após derrota.
- Salvamento automático: Pedra-Memória, conclusão de etapa de missão, entrada em região, a cada 30 s de jogo.
- Formato versionado (`versao`) com migrações sequenciais; nunca apaga conquistas, inventário ou progresso.
- Ao carregar: valida posição (chão andável, fora de fronteiras atuais e anteriores, região existente); se inválida, volta à última Pedra-Memória.

## 11. Ritmo (minuto a minuto, alvo)

| Min | Novidade |
| --- | --- |
| 0–1 | Despertar, mover, correr, pulo |
| 1–2 | Espada, espinhos, Sálvia |
| 2–3 | Observar, runas |
| 3–4 | Primeiro combate, esquiva, resgate do Pipo |
| 4–5 | Consequência visual no Jardim, plataformas sobre o vazio |
| 5–6 | Conectar, porta, prisma oculto |
| 6–7 | Caixa e placa, plataforma móvel |
| 7–8 | Ecos e Cortador, Sopa de Ideias, Colher |
| 8–9 | Grande Engrenagem, Vale, Criar, ponte de luz |
| 9–11 | Escolha de trilha, Casco, Martelo, gaiolas |
| 11–12 | Aliado de Luz, portão de placas |
| 12–14 | Subida do Farol |
| 14–16 | Chefe O Rumor |
| 16+ | Restauração do mundo, fronteira, atividades opcionais |
