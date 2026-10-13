# LiBok v2 — Design

Fonte da verdade visual do LiBok v2. Mantido pelo agente `libok-figma-designer`.

- **Arquivo Figma:** [LiBok v2 — Wireframes](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut) (`fileKey: VbZ6YOroBB9QfWkppxzkut`, time "Libok")
- **Fluxo de navegação (FigJam):** [LiBok v2 — Fluxo de navegação](https://www.figma.com/board/bhob2cNsVXjSalS8gtAlu1)
- **Tokens exportados:** [`tokens.json`](./tokens.json) (para o `libok-tailwind-ui` gerar o `@theme`)
- **Fase atual:** 0 — wireframes (estrutura + paleta da v1, claro e escuro). As telas finais (Fase 1) vão para a página `04 UI`.
- **Fase 2 (antecipada, só wireframe):** Turmas, Leitores (alunos e professores) e Empréstimos, na seção "Fase 2" da página `02 Wireframes`, abaixo das telas do MVP. Veja [Fase 2](#fase-2--turmas-leitores-e-empréstimos-wireframes).

## Páginas do arquivo

| Página | Conteúdo | Node |
|---|---|---|
| `00 Cover` | Capa | [`10:62`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=10-62) |
| `01 Fluxos` | Tabela de transições + link para o diagrama no FigJam | [`10:2`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=10-2) |
| `02 Wireframes` | As telas do §8, frames 1280×800 — linha de cima clara, linha de baixo escura. Abaixo, separada por um divisor e pelo título "Fase 2 — Turmas, Leitores e Empréstimos", a seção Fase 2 (telas 10–19): linha clara em y = 2120 e linha escura em y = 3080 | [`1:3`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=1-3) |
| `03 Design System` | Ícones, componentes, folhas de paleta (primitivos + tokens semânticos claro/escuro) | [`1:4`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=1-4) |
| `04 UI` | Reservada para a Fase 1 | [`1:5`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=1-5) |

## Telas (02 Wireframes)

O frame escuro é uma cópia do claro com a coleção `Tema` no modo **Escuro**. Todas as cores vêm de variáveis, então trocar o modo de qualquer frame já mostra o outro tema.

| # (§8) | Tela | Claro | Escuro |
|---|---|---|---|
| 1 | Splash / carregamento | [`5:2`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=5-2) | [`9:2174`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2174) |
| 2 | Layout base (sidebar + header + conteúdo) | [`5:12`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=5-12) | [`9:2182`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2182) |
| 3 | Dashboard | [`5:133`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=5-133) | [`9:2196`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2196) |
| 4 | Acervo (busca, filtros, tabela, paginação) — com o padrão da Fase 2: filtro de disponibilidade, coluna "Disponíveis X de Y" e ação Emprestar na linha | [`6:197`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=6-197) | [`9:2294`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2294) |
| 4b | Acervo — sem resultados (estado vazio), com o filtro de disponibilidade e o cabeçalho novo | [`6:561`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=6-561) | [`9:2333`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2333) |
| 5 | Cadastro de livro (códigos dinâmicos + erros de validação) | [`7:684`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=7-684) | [`9:2355`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2355) |
| 5b | Edição de livro — com o padrão da Fase 2: badge de status por código (Emprestado/Disponível/Atrasado + leitor e data), lixeira só nos disponíveis, botão Emprestar no header | [`7:905`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=7-905) | [`9:2410`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2410) |
| 6 | Diálogo de confirmação de exclusão | [`8:940`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=8-940) | [`9:2461`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2461) |
| 7 | Importar / Exportar — seleção de arquivo + prévia | [`8:1024`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=8-1024) | [`9:2502`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2502) |
| 7b | Importar / Exportar — relatório final | [`8:1291`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=8-1291) | [`9:2632`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2632) |
| 8 | Configurações (tema, backup/restauração, categorias e cores) | [`9:1498`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-1498) | [`9:2678`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2678) |
| 9 | Toasts e carregamento (skeleton, botão "Salvando…") | [`9:1757`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-1757) | [`9:2775`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2775) |
| 9b | Erro ao carregar (banco indisponível) | [`9:2012`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2012) | [`9:2898`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2898) |

## Componentes (03 Design System)

Componentes locais com variantes; textos e ícones expostos como propriedades. Ícones: [lucide](https://lucide.dev), os mesmos nomes do `lucide-react`.

| Componente | Variantes / propriedades | Node |
|---|---|---|
| Ícones (`icon/*`, 33) | layout-dashboard, library, book-plus, arrow-down-up, settings, search, plus, trash-2, pencil, x, circle-check, circle-alert, triangle-alert, info, upload, download, sun, moon, monitor, database, rotate-ccw, chevron-*, book-open, copy, loader-circle, file-spreadsheet, arrow-up-down, tag, funnel, clock, palette | [`2:3`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=2-3) |
| Button | Estilo = Primário · Secundário · Fantasma · Perigo × Estado = Padrão · Hover · Foco · Desabilitado; Rótulo, Ícone (swap), Mostrar ícone | [`2:243`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=2-243) |
| Icon button (32×32) | Estilo = Neutro · Perigo × Estado = Padrão · Hover · Foco; Ícone | [`3:79`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-79) |
| Input | Tipo = Texto · Select · Busca × Estado = Padrão · Foco · Erro · Desabilitado; Rótulo, Valor, Ajuda, Mostrar rótulo, Mostrar ajuda | [`3:184`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-184) |
| Badge | Tipo = Categoria · Código · Contagem; Texto | [`2:251`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=2-251) |
| Sidebar item | Estado = Padrão · Hover · Ativo; Rótulo, Ícone | [`2:273`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=2-273) |
| Sidebar | marca + Dashboard, Acervo, Cadastrar · grupo "Circulação" (Empréstimos, Leitores, Turmas) · grupo "Dados" (Importar / Exportar, Configurações) + alternar tema + versão. Usada em todas as telas (MVP e Fase 2) | [`4:154`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=4-154) |
| Stat card | Rótulo, Valor, Detalhe, Ícone | [`3:191`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-191) |
| Toast | Tipo = Sucesso · Erro · Info · Carregando; Título, Mensagem | [`3:247`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-247) |
| Tabela/Cabeçalho | colunas Título ↕ (flexível), Autor ↕ 140, Categoria 130, Assunto 110, Disponíveis ↕ 120, Ações 184 | [`3:248`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-248) |
| Tabela/Linha | Estado = Padrão · Hover; Título, Códigos, Autor, Assunto, Disponíveis ("1 de 3"), Detalhe disp. ("disponível" / "todos emprestados"); ações Emprestar / Editar / Excluir. A propriedade `Exemplares` virou `Disponíveis` (mesma chave `#3:98`) | [`3:317`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-317) |
| Empty state | Título, Mensagem, Ícone, Mostrar ação | [`3:318`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-318) |
| Modal/Confirmação | Título, Mensagem (Cancelar + Excluir) | [`3:330`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-330) |
| Folha de paleta: primitivos | todas as cores da v1, categorias e paleta de novas | [`3:361`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-361) |
| Tokens semânticos — Claro / Escuro | todos os tokens `Tema` com hex resolvido por modo | [`3:630`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-630) / [`3:772`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=3-772) |

## Ícone do app (03 Design System)

Seção [`Ícone do app` — `35:391`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=35-391), abaixo da Sidebar (x = 0, y = 3600). Substitui o `src-tauri/icons/app-icon-source.png` da v1, mantendo a mesma ideia: livro aberto com uma pena.

| Item | Node | Export em `docs/design/icon/` |
|---|---|---|
| `App icon/Completo` (componente, 1024×1024, transparente) | [`35:431`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=35-431) | `app-icon-1024.png`, `app-icon-1024.svg` |
| `App icon/Simplificado` (componente, 1024×1024, para 16/32/48 px) | [`35:430`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=35-430) | `app-icon-small-256.png`, `app-icon-small.svg` |
| `App icon/Antigo (v1)` (só para comparação) | [`35:432`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=35-432) | — |
| Prévias 16/32/48/128/256 px em fundo claro `#F3F3F3` e escuro `#202020`: Antigo, Completo, Simplificado e a combinação recomendada | [`35:13103`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=35-13103) | — |
| Notas de decisão | [`35:13634`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=35-13634) | — |

**Decisões:**

- **Área.** O desenho ocupa cerca de 87,5% da largura (64 → 960 px em 1024) e tem margem lateral de 6,25%. Na v1, ocupava uns 60%.
- **Contraste.**
  - Contorno `#1B1D33` com 24 px no Completo e 40–44 px no Simplificado.
  - Capa areia `#F3D38A` e páginas creme `#F6EBCF` (antes eram quase brancas).
  - Pena coral `#EB9486` + lavanda `#8284BD`, mais larga, com haste e bico escuros.
- **Fundo transparente, sem placa.** Na barra de tarefas clara, o contorno escuro define a silhueta. Na escura, a capa areia e as páginas creme definem a forma, e o contorno passa a funcionar como desenho interno. As prévias mostram que os dois casos ficam legíveis, então a placa arredondada não foi necessária.
- **Simplificado.** Não tem as linhas de texto, os filetes da pena, a linha da lombada nem o brilho da haste. Os traços são quase 2× mais grossos, e a pena é mais larga e mais curta.
- **Uso (para o `libok-tauri-rust`).**
  - Simplificado em 16, 24, 32 e 48 px: ícone da janela, barra de tarefas e atalho.
  - Completo de 64 px para cima: 128, 256, instalador, menu Iniciar e `icon.png`.
  - O `.ico` deve misturar as duas versões. Se a ferramenta só aceitar uma fonte, use o `app-icon-1024.png` (o `tauri icon` gera todos os tamanhos a partir dele), sabendo que em 16/32 px o resultado fica um pouco menos nítido.
- **Como os PNGs foram exportados.** O export de PNG/SVG do MCP do Figma incluía o fundo do canvas (`#F5F5F5`). Por isso:
  1. Os SVGs foram exportados do Figma e o retângulo de fundo foi removido.
  2. Os PNGs foram rasterizados a partir desses SVGs (Chrome headless, fundo transparente).
  3. Resultado conferido: canto com alfa 0; conteúdo de 64 a 958 px no PNG de 1024 e de 16 a 238 px no de 256.

## Variáveis

| Coleção | Modos | Conteúdo |
|---|---|---|
| `Primitivos` | Valor | 63 cores: lavanda, oliva, areia, tinta, neutro, noite (base do tema escuro), vermelho, verde, paleta "divertida", `categoria/*` (seed) e `categoria-nova/1..8` |
| `Tema` | **Claro / Escuro** | 32 tokens semânticos (`bg/*`, `text/*`, `border/*`, `action/*`, `brand/*`, `feedback/*`), todos como alias dos primitivos |
| `Espaçamento` | Valor | `space/0..16` (0–64 px, grade de 4) |
| `Raio` | Valor | `radius/sm 8`, `md 12`, `lg 16`, `full` |
| `Tipografia` | Valor | `font/family` = Inter, `font-size/xs..2xl` |

Estilos de texto (Inter): Display 32/40 Bold · Título 24/32 Semi Bold · Subtítulo 18/26 Semi Bold · Corpo 14/20 · Corpo forte 14/20 Semi Bold · Rótulo 13/18 Medium · Legenda 12/16 · Número 36/44 Bold.

Os escopos das variáveis estão configurados (fills/texto/stroke/gap/raio); o code syntax WEB é `var(--color-…)`, `var(--spacing-…)`, `var(--radius-…)`.

## Decisões de design

1. **Paleta da v1 preservada.** A sidebar é lavanda `#8284BD`, as ações principais são verde-oliva `#68754F` e o areia `#F3D38A` aparece no logo, na contagem de exemplares e em avisos. O texto é `#2D3047` e os fundos `#F1F1F4`/`#F7F7F7`, como no código da v1.
2. **Navegação.** A barra de botões no topo da v1 virou uma sidebar fixa de 240 px (briefing §3). O header tem 80 px, com título e subtítulo à esquerda e as ações da tela à direita.
3. **Tema escuro derivado da tinta `#2D3047`.** Fundos azul-noite (`#17182A` → `#22243A` → `#2D3047`) e sidebar `#2D2F52`; o lavanda passa a ser o fundo do item ativo. Ações e feedback usam versões mais claras da mesma cor (oliva `#9AAA74`, vermelho `#F0907F`, verde `#74C69D`) com texto escuro por cima.
4. **Contraste AA.** Todos os pares texto/fundo usados nas telas foram conferidos:
   - Texto normal ≥ 4.5:1. Os mais baixos são `text/on-sidebar` na sidebar clara (4.71), `text/on-action` no botão oliva (4.95) e no claro `text/muted` (5.09).
   - Bordas de controles (`border/strong`) ≥ 3:1: 3.62 no claro, 3.17 no escuro.
   - O `border/default` (`#DCDCE4`) é só decorativo (divisórias e cards).
5. **Badge de categoria = bolinha colorida + texto neutro.** Várias cores da seed (`#CAE7B9`, `#EB9486`, `#7E7F9A`) não atingem 4.5:1 nem com branco nem com preto. Por isso a cor de categoria nunca fica atrás de texto. O mesmo vale para a legenda do gráfico.
6. **Feedback nunca depende só de cor.** Erros levam ícone, borda de 2 px e mensagem. O formulário tem um resumo de erros no topo. Os toasts têm ícone e título.
7. **Alvos de clique.** Botões e campos têm 40 px de altura; icon buttons e paginação, 32×32. O foco é um anel de 2 px `border/focus` (lavanda escuro/claro).
8. **Cadastro em duas colunas.** "Dados do livro" fica à esquerda e "Exemplares" à direita. A lista de códigos é dinâmica (Enter adiciona, lixeira remove) e a contagem aparece no badge "3 exemplares", calculada a partir dos códigos. Salvar e Limpar ficam no header, sempre visíveis.
9. **Edição em página, não em modal** (`05b`). Usa o mesmo formulário do cadastro, com breadcrumb "Acervo › título" e o botão "Excluir livro".
10. **Importação em 2 passos.** A prévia marca cada linha como pronta, duplicada ou com erro. O relatório mostra importados, ignorados e erros com o número da linha (`ImportReport` do §5).
11. **Erros do banco** (`AppError` `DB`/`IO`) aparecem como estado de página (`09b`) com "Tentar novamente" e "Abrir Configurações", além do toast com a `message`.

## Fase 2 — Turmas, Leitores e Empréstimos (wireframes)

Antecipação da Fase 2 do briefing (§3: empréstimos/devoluções e cadastro de leitores). **É só wireframe**: nada disso entra no MVP, e o contrato IPC (§5) não mudou. Todas as telas usam a `Sidebar` (que agora tem o grupo Circulação) e as mesmas variáveis do tema; o frame escuro é uma cópia com `Tema` = Escuro.

### Telas (02 Wireframes › seção Fase 2)

As telas ficam na página `02 Wireframes` (`1:3`), abaixo das linhas do MVP: separador [`30:3460`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=30-3460) e título [`30:3461`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=30-3461) em y = 1920, linha clara em y = 2120 e linha escura em y = 3080, na mesma coluna x das cópias claras. Os node IDs são os mesmos de quando as telas estavam na antiga página 05 (que foi removida).

| # | Tela | Claro | Escuro |
|---|---|---|---|
| 10 | Turmas — lista (cards, busca, filtros ano/turno) | [`22:9`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=22-9) | [`29:8720`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-8720) |
| 10b | Turmas — estado vazio | [`22:499`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=22-499) | [`29:8741`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-8741) |
| 11 | Turma — detalhe (professor responsável, Trocar professor, tabela de alunos) | [`23:537`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=23-537) | [`29:8752`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-8752) |
| 12 | Nova turma (modal) com criação rápida de professor | [`23:1041`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=23-1041) | [`29:8802`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-8802) |
| 13 | Leitores — aba Alunos (busca, filtro por turma/situação) | [`24:1299`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=24-1299) | [`29:8851`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-8851) |
| 13b | Leitores — aba Professores | [`24:1737`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=24-1737) | [`29:8895`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-8895) |
| 14 | Cadastrar aluno (página) com erro de matrícula duplicada | [`24:2154`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=24-2154) | [`29:8932`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-8932) |
| 15 | Resumo do aluno (indicadores, empréstimos ativos, histórico/lidos) | [`25:2092`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=25-2092) | [`29:8970`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-8970) |
| 15b | Resumo do professor (mesma tela, variação) | [`25:2534`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=25-2534) | [`29:9017`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-9017) |
| 17 | Emprestar exemplar (modal): códigos com status, busca de leitor, datas | [`27:3114`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=27-3114) | [`29:9165`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-9165) |
| 17b | Emprestar exemplar — todos os exemplares emprestados | [`27:3326`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=27-3326) | [`29:9241`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-9241) |
| 18 | Empréstimos — lista (abas Ativos/Atrasados/Devolvidos/Todos, ação Devolver) | [`28:4003`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=28-4003) | [`29:9313`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-9313) |
| 19 | Registrar devolução (modal) com "Marcar como lido" | [`29:4361`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-4361) | [`29:9361`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-9361) |
| 19b | Devolução registrada: lista atualizada + toast de sucesso | [`29:4483`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-4483) | [`29:9442`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=29-9442) |

**Acervo e Edição de livro na Fase 2:** as antigas telas 16 e 16b foram apagadas porque ficaram iguais às telas 4 ([`6:197`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=6-197) / [`9:2294`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2294)) e 5b ([`7:905`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=7-905) / [`9:2410`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=9-2410)) do MVP, que agora seguem esse padrão. As telas 17–19b subiram duas colunas para fechar o espaço (x de 12240 a 17680).

**Fluxo:** Turmas → card → Turma (detalhe) → olho na linha → Resumo do aluno. Leitores → olho → Resumo do aluno/professor → "Novo empréstimo" abre o modal 17 com o leitor já escolhido. Acervo → "Emprestar" (ou Edição → "Emprestar") → modal 17 com o livro já escolhido. Empréstimos / Resumo → "Devolver" → modal 19 → toast (19b).

### Componentes novos (03 Design System, coluna x = 4200)

| Componente | Variantes / propriedades | Node |
|---|---|---|
| Ícones Fase 2 (`icon/*`, 16) | school, users, book-up, book-down, book-check, graduation-cap, presentation, calendar, check, undo-2, clock-alert, user-plus, arrow-left-right, user, eye, mail | [`16:183`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=16-183) |
| Badge/Status empréstimo | Status = Disponível · Emprestado · Atrasado · Devolvido (ícone + texto; Atrasado também com borda); Detalhe, Mostrar detalhe | [`18:206`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=18-206) |
| Badge/Leitor | Tipo = Aluno (graduation-cap) · Professor (presentation) | [`18:219`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=18-219) |
| Tab | Estado = Ativo · Padrão · Hover · Foco; Rótulo, Contagem, Mostrar contagem | [`18:236`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=18-236) |
| Checkbox | Estado = Marcado · Desmarcado · Foco; Rótulo, Descrição, Mostrar descrição | [`18:256`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=18-256) |
| Avatar | Tamanho = P (32) · M (40) · G (64); Iniciais | [`18:263`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=18-263) |
| Textarea | Estado = Padrão · Foco; Rótulo, Valor, Ajuda, Mostrar ajuda | [`18:274`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=18-274) |
| Tabela/Célula cabeçalho | Rótulo, Mostrar ordenação (monta o cabeçalho de qualquer tabela) | [`18:275`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=18-275) |
| Tabela/Linha empréstimo | Estado = Padrão · Hover; Livro, Autor, Leitor, Turma, Emprestado em, Data prevista, Relativo; Mostrar leitor, Mostrar ação, Mostrar relativo; badges Código/Leitor/Status expostos | [`19:274`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=19-274) |
| Tabela/Linha leitor | Estado = Padrão · Hover; Nome, Detalhe, Coluna 2, Emprestados, Lidos; Mostrar coluna 2, Mostrar atraso; Avatar exposto | [`19:363`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=19-363) |
| Card de turma | Estado = Padrão · Hover · Foco; Nome, Ano e turno, Professor, Alunos, Empréstimos, Mostrar atrasos | [`20:412`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=20-412) |
| Exemplar opção | Estado = Disponível · Selecionado · Emprestado; Código, Detalhe; Badge status exposto | [`20:448`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=20-448) |
| Leitor resultado | Estado = Padrão · Hover · Selecionado; Nome, Turma, Info; Avatar e Badge leitor expostos | [`20:493`](https://www.figma.com/design/VbZ6YOroBB9QfWkppxzkut?node-id=20-493) |

Nenhuma variável nova: tudo usa os tokens `Tema`, `Espaçamento` e `Raio` existentes, então o `tokens.json` não mudou. A auditoria das 32 telas e dos componentes novos não encontrou nenhuma cor fixa (as únicas cores fora de variável são as sombras dos modais e do toast, como na Fase 0).

### Decisões de design da Fase 2

12. **Empréstimo por exemplar, nunca por título.** O modal "Emprestar exemplar" lista todos os códigos do livro como opções de rádio. Os códigos emprestados ficam desabilitados e mostram o leitor e a data ("Com Ana Beatriz Souza (Aluno) até 12/10"). O botão principal repete o código escolhido ("Emprestar REG-0013").
13. **Status com ícone + texto + forma.** Disponível (circle-check, verde), Emprestado (book-up, lavanda), Atrasado (clock-alert, vermelho e com borda) e Devolvido (undo-2, neutro). Os pares texto/fundo passam no AA nos dois temas: 5.42/6.92 (Disponível), 4.95/6.57 (Emprestado), 6.59/6.63 (Atrasado), 5.36/5.62 (Devolvido) e 5.54/8.75 (badge Professor).
14. **Disponibilidade escrita, não só colorida.** O Acervo troca "Exemplares" por "Disponíveis: 1 de 3", com "todos emprestados" quando chega a zero. O botão "Emprestar" continua ativo nesse caso e abre o estado 17b, que mostra a próxima devolução prevista.
15. **Leitor = aluno ou professor.** O mesmo badge de tipo aparece em tabelas, busca e resumos. Os dois tipos dividem uma única tela de Leitores (abas) e uma única tela de resumo (15/15b).
16. **Turma com 1 professor responsável.** O professor aparece no card, no detalhe ("Trocar professor") e no cadastro do aluno (texto de apoio abaixo do select de turma). No modal "Nova turma" dá para criar o professor sem sair dele, como a criação rápida de categoria do cadastro de livro.
17. **"Livros lidos" = devoluções marcadas como lidas.** O checkbox "Marcar como lido" vem marcado por padrão na devolução. No histórico, o badge Devolvido ganha o detalhe "· lido".
18. **Prazos.** O padrão é 14 dias (campo editável). A coluna "Devolver até" mostra o prazo relativo ("vence hoje", "7 dias de atraso") e é a ordenação padrão da lista de Empréstimos. A aba Ativos inclui os atrasados.
19. **Cadastro de aluno em página** (mesmo padrão do Cadastro de livro): resumo de erros no topo, erro inline com ícone na matrícula duplicada e Salvar/Limpar no header. Professor, por ser mais simples (nome + contato), pode usar o mesmo formulário com menos campos.
20. **Edição de livro** (tela 5b). Cada código mostra o badge de status. Códigos emprestados não podem ser removidos nem renomeados até a devolução (sem lixeira, com aviso no rodapé).

21. **A navegação e o Acervo da Fase 2 viraram o padrão do arquivo.** A `Sidebar` única já traz o grupo "Circulação", e `Tabela/Cabeçalho` + `Tabela/Linha` já trazem "Disponíveis X de Y" e a ação Emprestar. Os componentes temporários `Sidebar (Fase 2)` e `Tabela/Linha acervo (Fase 2)` foram aposentados (apagados, sem instâncias). O Cadastro de livro (tela 5) continua sem badge de status, porque exemplar novo ainda não tem empréstimo. **Atenção:** o wireframe do MVP agora mostra recursos da Fase 2 (itens de Circulação, coluna Disponíveis e botão Emprestar). Até a Fase 2 ser implementada, o front do MVP deve esconder esses elementos ou deixá-los desabilitados.

## Como usar (para `libok-tailwind-ui` / `libok-react-frontend`)

- Gere o `@theme` a partir de `tokens.json → color.semantic`: `light` vai para `:root` e `dark` para `.dark` / `[data-theme=dark]`. Não use os primitivos direto nos componentes.
- As cores de categoria vêm do banco (`Category.color`). O `tokens.json` só lista a seed e a paleta padrão para novas categorias.
- Para inspecionar um componente ou tela: abra o link do node acima ou use `get_design_context` com o `fileKey` e o `node-id`.
