# LiBok

O LiBok é um aplicativo para Windows que organiza uma **biblioteca pequena**, como a de uma escola ou de um local de trabalho. Ele substitui a planilha do Excel: você cadastra livros e exemplares, pesquisa o acervo, registra leitores (alunos e professores) e controla os empréstimos. Funciona **offline**, sem servidor, e guarda tudo em um único arquivo no seu computador.

Versão atual: **2.0.0**, uma reescrita da v1 (Python/CustomTkinter) com Tauri, React e SQLite.

## O que ele faz

- **Dashboard:** total de livros (títulos) e de exemplares, gráfico por categoria, últimos livros cadastrados e totais de empréstimos ativos e atrasados.
- **Acervo:** busca única por título, autor, categoria, assunto ou código de registro (não diferencia maiúsculas nem acentos), filtro por categoria e por disponibilidade, ordenação, edição, exclusão e empréstimo de exemplares.
- **Cadastro de livro:** título, autor, categoria (com criação rápida), assunto e a lista de códigos de registro dos exemplares. Títulos e códigos repetidos são bloqueados.
- **Circulação:** turmas (com professor responsável), alunos, professores, empréstimo por exemplar, devolução (com a opção "marcar como lido") e resumo de cada leitor com livros emprestados, atrasos e livros lidos.
- **Importar/Exportar:** troca de dados do acervo com o Excel por arquivos CSV, com prévia antes de importar e relatório no final.
- **Configurações:** tema claro, escuro ou do sistema; backup e restauração do banco de dados; categorias e suas cores.

## Instalação

Na pasta de distribuição há dois instaladores. Use **um** deles:

| Arquivo | Quando usar |
|---|---|
| `LiBok_2.0.0_x64-setup.exe` (NSIS) | Recomendado. Instala só para o usuário atual e não pede senha de administrador. |
| `LiBok_2.0.0_x64_pt-BR.msi` (Windows Installer) | Para instalação gerenciada pela TI ou implantação em várias máquinas. |

Os dois instaladores estão em português. Depois de instalar, abra o **LiBok** pelo Menu Iniciar.

O Windows pode exibir o aviso "O Windows protegeu o computador" porque o instalador não tem assinatura digital. Clique em **Mais informações** e depois em **Executar assim mesmo**.

### WebView2

O LiBok usa o **Microsoft Edge WebView2** para desenhar a interface. Ele já vem no Windows 11 e na maioria das instalações atualizadas do Windows 10. Se ele não estiver presente, o instalador baixa e instala o WebView2 automaticamente, e para isso **é preciso estar conectado à internet durante a instalação**. Depois de instalado, o LiBok funciona sem internet.

Em computadores que nunca ficam online, instale antes o "Evergreen Standalone Installer" do WebView2, baixado em outra máquina no site da Microsoft (https://developer.microsoft.com/microsoft-edge/webview2/), e depois rode o instalador do LiBok.

## Onde ficam os dados

| O quê | Onde |
|---|---|
| Banco de dados (todo o acervo, leitores e empréstimos) | `%APPDATA%\com.libok.app\libok.db` |
| Cópias automáticas feitas antes de restaurar um backup | `%APPDATA%\com.libok.app\backups\libok-pre-restore-AAAAMMDD-HHMMSS.db` |
| Logs | `%LOCALAPPDATA%\com.libok.app\logs\LiBok.log` |

Para abrir uma dessas pastas, digite o caminho (por exemplo, `%APPDATA%\com.libok.app`) na barra de endereço do Explorador de Arquivos.

Junto do `libok.db` podem aparecer os arquivos `libok.db-wal` e `libok.db-shm`. Eles fazem parte do banco enquanto o app está aberto. **Não os apague.**

Desinstalar o LiBok não apaga essa pasta, então os dados continuam lá se você reinstalar. A exceção é o desinstalador do `setup.exe`, que oferece a opção de apagar os dados do aplicativo. Ela vem desmarcada; só marque se quiser mesmo perder o banco.

### Backup

1. Abra **Configurações** e clique em **Fazer backup**.
2. Escolha onde salvar (o nome sugerido é `libok-backup-<data>.db`). Prefira um pendrive, outra unidade ou uma pasta sincronizada com a nuvem.

O backup é um arquivo `.db` único e completo. Ele pode ser feito com o app em uso.

### Restaurar um backup

1. Abra **Configurações** e clique em **Restaurar backup**.
2. Selecione o arquivo `.db` e confirme.

Antes de substituir os dados, o LiBok verifica se o arquivo é um backup válido e **guarda uma cópia automática do banco atual** em `%APPDATA%\com.libok.app\backups\`. Se você restaurou o arquivo errado, restaure essa cópia `libok-pre-restore-...db` para voltar ao estado anterior.

Um backup gerado por uma versão mais nova do LiBok é recusado.

### Backup manual (alternativa)

Com o LiBok **fechado**, copie o arquivo `libok.db` da pasta de dados para outro lugar. Para restaurar manualmente, feche o app, apague `libok.db-wal` e `libok.db-shm` (se existirem) e coloque a cópia no lugar de `libok.db`.

## Formato do CSV (importar e exportar)

O CSV contém **somente o acervo** (livros e códigos de exemplares). Turmas, leitores e empréstimos não entram no CSV; para eles, use o backup do banco.

- Codificação: **UTF-8 com BOM**, para que o Excel mostre os acentos corretamente.
- Separador de colunas: **ponto e vírgula (`;`)**.
- Primeira linha: cabeçalho.
- Uma linha por livro:

```csv
titulo;autor;categoria;assunto;codigos
Dom Casmurro;Machado de Assis;Romance;Literatura brasileira;0001|0002|0003
O Pequeno Príncipe;Antoine de Saint-Exupéry;Infantil;Fábula;0101
```

| Coluna | Conteúdo |
|---|---|
| `titulo` | Título do livro (obrigatório) |
| `autor` | Autor (obrigatório) |
| `categoria` | Nome da categoria (obrigatório). Se ela ainda não existir, é criada na importação. |
| `assunto` | Assunto (obrigatório) |
| `codigos` | Códigos de registro dos exemplares, separados por `\|` (pelo menos um). A quantidade de exemplares é o número de códigos. |

Na **importação**:

- Os nomes das colunas não diferenciam maiúsculas nem acentos (`Título` e `titulo` valem igual), e a ordem das colunas não importa.
- Também são aceitos o CSV exportado pela v1 (`Nome do livro;Autor;Categoria;Assunto;Quantidade;Codigos de registro`, com códigos separados por vírgula) e arquivos salvos pelo Excel em Windows-1252. Se houver a coluna `Quantidade`, ela precisa bater com o número de códigos.
- Antes de gravar, o app mostra uma prévia com o status de cada linha: **pronta**, **duplicada** (título ou código já cadastrado, ou repetido no próprio arquivo) ou **com erro** (campo obrigatório vazio, sem código, código repetido na linha). Só as linhas prontas são importadas. No final aparece o relatório com o número de livros importados, ignorados por duplicidade e com erro.

Na **exportação**, células que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo (`'`) na frente, para que o Excel não as trate como fórmulas. A importação remove esse apóstrofo.

---

## Para desenvolvedores

### Stack

Tauri v2 (Rust) + React 19 + Vite + TypeScript + Tailwind CSS v4 + SQLite (`rusqlite`, `bundled`). Todo o acesso ao banco acontece no Rust; o frontend chama os commands Tauri por `invoke()`. O escopo, o modelo de dados e o contrato IPC estão em [`docs/BRIEFING.md`](docs/BRIEFING.md).

### Pré-requisitos (Windows)

- **Node.js** 20 ou mais recente, com npm.
- **Rust** estável, instalado pelo `rustup` com o toolchain `x86_64-pc-windows-msvc`.
- **Visual Studio Build Tools** com a carga de trabalho "Desenvolvimento para desktop com C++" (MSVC) e o **Windows SDK** (10/11).
- **WebView2 Runtime** (já vem no Windows 11).

> **Use o PowerShell (ou o Prompt de Comando), não o Git Bash**, para rodar `cargo` e `npm run tauri ...`. No Git Bash, o comando `link` do coreutils aparece antes do `link.exe` do MSVC no `PATH`, e a linkagem do Rust falha.

### Comandos

```powershell
npm install                 # dependências do frontend e a CLI do Tauri
npm run tauri dev           # app em modo de desenvolvimento (Vite com hot reload)

# Testes e verificações
npm test                    # testes do frontend (Vitest)
npm run lint                # ESLint
npx tsc                     # checagem de tipos (o tsconfig já usa noEmit)
cd src-tauri
cargo test                  # testes do Rust (repositórios e commands, com banco em memória ou temporário)
cargo clippy -- -D warnings
cargo fmt --check
cd ..

# Build de release + instaladores
npm run tauri build
```

O `npm run tauri build` gera:

- `src-tauri/target/release/libok.exe` (executável sem instalador)
- `src-tauri/target/release/bundle/msi/LiBok_2.0.0_x64_pt-BR.msi`
- `src-tauri/target/release/bundle/nsis/LiBok_2.0.0_x64-setup.exe`

No primeiro build, o Tauri baixa o WiX e o NSIS, então é preciso estar com internet.

Para trocar o ícone, substitua `src-tauri/icons/app-icon-source.png` (PNG quadrado, de preferência com 1024×1024 px e fundo transparente) e rode `npx tauri icon src-tauri/icons/app-icon-source.png -o src-tauri/icons`. Depois apague as pastas `android/` e `ios/` que o comando cria.

### Detalhes do Windows

- `src-tauri/build.rs` embute `src-tauri/windows-app-manifest.xml` (Common Controls v6, DPI PerMonitorV2) pelo linker do MSVC em todos os binários, inclusive nos de `cargo test`. Sem isso, os testes morrem com `STATUS_ENTRYPOINT_NOT_FOUND`.
- O identificador `com.libok.app` define a pasta de dados (`%APPDATA%\com.libok.app`). **Não o altere**: os usuários perderiam o acesso ao banco existente.

### Estrutura de pastas

```text
LiBok/
├── docs/
│   ├── BRIEFING.md            # fonte da verdade: escopo, modelo de dados, contrato IPC, fases
│   ├── design/                # links do Figma e tokens exportados
│   └── reviews/               # relatórios de revisão
├── src/                       # frontend React
│   ├── app/                   # rotas, layout, providers
│   ├── pages/                 # telas (Dashboard, Acervo, Cadastro, Importar/Exportar, Configurações, Turmas, Leitores, Empréstimos)
│   ├── features/              # hooks e componentes por domínio
│   ├── components/ui/         # biblioteca de componentes
│   ├── lib/                   # wrapper do invoke (api.ts), tipos do contrato (types.ts)
│   └── styles/                # tokens Tailwind (@theme) e CSS global
└── src-tauri/                 # backend Rust / Tauri
    ├── src/commands/          # handlers IPC
    ├── src/db/                # conexão, migrations, repositórios, normalização, CSV, backup
    ├── migrations/            # migrations SQL versionadas
    ├── capabilities/          # permissões do Tauri (menor privilégio)
    ├── icons/                 # ícones gerados (fonte: app-icon-source.png)
    ├── tauri.conf.json        # janela, bundle e instaladores
    └── Cargo.toml
```

A v1 em Python está no histórico do git (commit `914c65a`) como referência das regras de negócio.
