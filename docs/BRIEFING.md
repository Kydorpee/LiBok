# LiBok — Briefing do Projeto

> Documento-fonte para todos os agentes. Em caso de dúvida, este arquivo vence. Mudanças de escopo ou de contrato passam pelo orquestrador (Claude principal) antes de serem implementadas.

## 1. Visão

O LiBok é um app desktop para organizar uma **biblioteca pequena** (ex.: biblioteca de uma escola ou de um local de trabalho). Ele nasceu para substituir uma planilha do Excel: cadastrar, pesquisar e administrar livros e seus exemplares de forma rápida, offline e sem servidor.

Esta é a **v2**, uma reescrita da versão Python/CustomTkinter (histórico no git, commit `914c65a`) para uma stack moderna.

- **Usuário principal:** bibliotecária(o) ou responsável pelo acervo, não técnico(a).
- **Plataforma alvo:** Windows (instalador `.msi`/`.exe`); macOS/Linux são bônus.
- **Idioma da interface:** Português (Brasil).
- **Princípios:** simples, rápido, funciona offline, dados nunca se perdem.

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Shell desktop | **Tauri v2** (Rust) |
| Frontend | **React 19 + Vite + TypeScript** |
| Estilo | **Tailwind CSS v4** (`@tailwindcss/vite`), tokens em CSS (`@theme`) |
| Banco | **SQLite** via `rusqlite` (feature `bundled`) no lado Rust |
| Migrations | `rusqlite_migration` |
| Dados no front | TanStack Query sobre `invoke()` |
| Formulários | react-hook-form + zod |
| Rotas | React Router |
| Gráficos | Recharts |
| Ícones | lucide-react |
| Arquivos | `tauri-plugin-dialog` + crate `csv` |
| Design | Figma (wireframes → design system → telas) |

O banco fica em `app_data_dir()/libok.db` (no Windows: `%APPDATA%\com.libok.app\libok.db`). Todo acesso ao SQLite acontece **no Rust**; o frontend nunca fala SQL.

## 3. Escopo

### MVP (v2.0) — paridade com a v1 + melhorias

**Dashboard**
- Total de livros (títulos) e total de exemplares.
- Gráfico de rosca/pizza por categoria, com legenda (quantidade e %).
- Cores de categoria persistidas no banco (paleta padrão para novas).
- Últimos livros cadastrados.

**Cadastro de livro**
- Campos: título*, autor*, categoria* (select com criação rápida), assunto*, exemplares (lista dinâmica de códigos de registro, mínimo 1).
- Quantidade = número de códigos (não é digitada à parte).
- Validação de obrigatórios e de códigos duplicados (no formulário e no banco).
- Bloqueio de título duplicado ignorando maiúsculas, acentos e espaços externos.
- Limpa o formulário após salvar e mostra toast de sucesso.

**Acervo / Pesquisa**
- Busca única por título, autor, categoria, assunto ou código de registro, sem diferenciar maiúsculas/acentos (debounce 250 ms).
- Filtro por categoria e ordenação por título/autor/data.
- Tabela com paginação (ou virtualização) e estado vazio.
- Editar livro (mesmo formulário do cadastro, em modal ou página).
- Excluir com diálogo de confirmação.

**Importar / Exportar**
- Exportar todo o acervo para CSV compatível com Excel (UTF-8 com BOM, separador `;`).
- Importar CSV no mesmo formato, com prévia, e relatório final (importados / ignorados por duplicidade / com erro).

**Geral**
- Sidebar com navegação: Dashboard, Acervo, Cadastrar, Importar/Exportar, Configurações + grupo "Circulação" (Empréstimos, Leitores, Turmas).
- Tema claro/escuro.
- Backup e restauração do arquivo `.db` (Configurações).

### Circulação (incluída na v2.0 por decisão do usuário em 2026-10-12)
Telas no Figma: seção "Fase 2" da página `02 Wireframes` (telas 10–19b) e Acervo/Edição atualizados — ver `docs/design/README.md`.

**Turmas**
- Lista em cards (busca, filtro por ano letivo e turno, estado vazio); detalhe com professor responsável ("Trocar professor") e tabela de alunos.
- Nova/editar turma em modal: nome*, ano letivo*, turno* (manhã/tarde/noite/integral), professor* (select com criação rápida). Nome + ano únicos.
- Excluir turma só se não tiver alunos (`IN_USE`).

**Leitores**
- Abas Alunos | Professores, busca (sem acento), filtro por turma e "só com atraso".
- Cadastrar/editar aluno em página: nome*, matrícula* (única → `DUPLICATE_REGISTRATION`), turma*, responsável, contato, observações.
- Professor: nome*, contato. Excluir professor bloqueado se for responsável por turma (`IN_USE`).
- Excluir leitor bloqueado com empréstimo ativo (`HAS_ACTIVE_LOANS`); sem ativos, apaga junto o histórico (com confirmação).
- Resumo do leitor (aluno ou professor): indicadores (emprestados agora, atrasados, livros lidos), empréstimos ativos com datas e histórico/lidos. Botão "Novo empréstimo".

**Empréstimos**
- Empréstimo é **por exemplar (código)** para um aluno **ou** professor. Um exemplar só tem um empréstimo ativo (`COPY_UNAVAILABLE`).
- Modal "Emprestar exemplar" (a partir do Acervo, da Edição do livro ou do Resumo do leitor): códigos com status, busca de leitor, data do empréstimo (hoje) e devolução prevista (padrão +14 dias, editável).
- Lista com abas Ativos (inclui atrasados) / Atrasados / Devolvidos / Todos, busca por livro, código ou leitor, ordenação padrão por "devolver até".
- Devolução em modal: data (hoje), "Marcar como lido" marcado por padrão.
- Status calculado (não gravado): Devolvido se `returned_at`; Atrasado se `due_at < hoje`; senão Ativo.
- Acervo mostra "Disponíveis X de Y", filtro de disponibilidade e ação Emprestar; Edição mostra status por código. Códigos com empréstimo ativo não podem ser removidos/renomeados nem o livro excluído (`HAS_ACTIVE_LOANS`).
- Dashboard ganha os totais de empréstimos ativos e atrasados.

### Fora da v2.0 (não implementar agora)
Relatórios por período, etiquetas/código de barras, multas, reservas.


## 4. Modelo de dados

```sql
CREATE TABLE categories (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  name_norm   TEXT NOT NULL UNIQUE,      -- minúsculo, sem acento, trim
  color       TEXT NOT NULL              -- hex, ex. '#4F6D7A'
);

CREATE TABLE books (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  title_norm  TEXT NOT NULL UNIQUE,
  author      TEXT NOT NULL,
  author_norm TEXT NOT NULL,
  subject     TEXT NOT NULL,
  subject_norm TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE copies (
  id                INTEGER PRIMARY KEY,
  book_id           INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  registration_code TEXT NOT NULL UNIQUE
);

CREATE INDEX idx_books_category ON books(category_id);
CREATE INDEX idx_copies_book    ON copies(book_id);

-- Circulação
CREATE TABLE teachers (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  name_norm  TEXT NOT NULL,
  contact    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE classes (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,                 -- "5º ano A"
  name_norm   TEXT NOT NULL,
  school_year INTEGER NOT NULL,              -- 2026
  shift       TEXT NOT NULL CHECK (shift IN ('morning','afternoon','evening','fullday')),
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  UNIQUE (name_norm, school_year)
);

CREATE TABLE students (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  name_norm    TEXT NOT NULL,
  registration TEXT NOT NULL UNIQUE,         -- matrícula (trim)
  class_id     INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  guardian     TEXT,
  contact      TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE loans (
  id          INTEGER PRIMARY KEY,
  copy_id     INTEGER REFERENCES copies(id) ON DELETE SET NULL,      -- NULL se o exemplar for apagado depois
  student_id  INTEGER REFERENCES students(id) ON DELETE CASCADE,
  teacher_id  INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  book_id     INTEGER REFERENCES books(id) ON DELETE SET NULL,      -- mantém o vínculo mesmo se o código for removido
  copy_code   TEXT NOT NULL,                 -- snapshot p/ histórico
  book_title  TEXT NOT NULL,                 -- snapshot p/ histórico
  book_author TEXT NOT NULL,                 -- snapshot p/ histórico
  book_norm   TEXT NOT NULL DEFAULT '',      -- título + autor normalizados (busca após apagar o livro)
  loaned_at   TEXT NOT NULL,                 -- 'YYYY-MM-DD' (data local)
  due_at      TEXT NOT NULL,
  returned_at TEXT,                          -- NULL = ativo
  marked_read INTEGER NOT NULL DEFAULT 0,
  CHECK ((student_id IS NULL) <> (teacher_id IS NULL))
);

CREATE UNIQUE INDEX idx_loans_active_copy ON loans(copy_id) WHERE returned_at IS NULL;
CREATE INDEX idx_loans_student ON loans(student_id);
CREATE INDEX idx_loans_teacher ON loans(teacher_id);
CREATE INDEX idx_loans_due     ON loans(due_at) WHERE returned_at IS NULL;
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_loans_book    ON loans(book_id);   -- migration 0002 (book_id + backfill por copies.book_id)
```

- Bloqueios por regra de negócio (no repositório, antes do SQL): excluir livro, remover/renomear código ou excluir leitor com empréstimo ativo → `HAS_ACTIVE_LOANS`; excluir turma com alunos ou professor responsável por turma → `IN_USE`.
- `update_book` faz **diff** dos códigos (mantém o `copies.id` dos códigos que continuam), para não perder vínculo dos empréstimos.
- "Hoje" é a data local da máquina (`chrono::Local`), calculada no Rust.

- Colunas `*_norm` são preenchidas no Rust (minúsculas + remoção de diacríticos + trim) e usadas em busca e unicidade.
- `PRAGMA foreign_keys = ON` e `journal_mode = WAL` em toda conexão.
- Seed: categorias da v1 com suas cores (ver §7).

## 5. Contrato IPC (Tauri commands)

Este contrato permite que frontend e backend trabalhem **em paralelo**. Os tipos TypeScript ficam em `src/lib/types.ts` e espelham as structs Rust (`serde(rename_all = "camelCase")`). Alterações no contrato exigem aprovação do orquestrador.

```ts
type Category = { id: number; name: string; color: string; bookCount: number };
type Book = {
  id: number; title: string; author: string; subject: string;
  category: { id: number; name: string; color: string };
  codes: string[]; quantity: number; availableCount: number; createdAt: string; updatedAt: string;
};
type BookInput = { title: string; author: string; subject: string; categoryId: number; codes: string[] };
type BookQuery = { text?: string; categoryId?: number; availability?: 'all' | 'available' | 'unavailable'; sort?: 'title' | 'author' | 'createdAt'; dir?: 'asc' | 'desc'; page?: number; pageSize?: number };
type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
type Stats = { totalBooks: number; totalCopies: number; byCategory: Category[]; recent: Book[]; activeLoans: number; overdueLoans: number };
type ImportReport = { imported: number; skippedDuplicates: string[]; errors: { line: number; message: string }[] };
type AppError = {
  code: 'VALIDATION' | 'DUPLICATE_TITLE' | 'DUPLICATE_CODE' | 'DUPLICATE_REGISTRATION' | 'COPY_UNAVAILABLE' | 'HAS_ACTIVE_LOANS' | 'IN_USE' | 'NOT_FOUND' | 'IO' | 'DB';
  message: string; field?: string;
};

// Circulação — datas sempre 'YYYY-MM-DD'
type Shift = 'morning' | 'afternoon' | 'evening' | 'fullday';
type ReaderKind = 'student' | 'teacher';
type LoanStatus = 'active' | 'overdue' | 'returned';
type Ref = { id: number; name: string };
type Reader = { kind: ReaderKind; id: number; name: string; classLabel?: string; activeLoans: number; overdueLoans: number };
type Teacher = { id: number; name: string; contact?: string; classes: Ref[]; activeLoans: number; overdueLoans: number; readCount: number };
type TeacherInput = { name: string; contact?: string };
type ClassRoom = { id: number; name: string; schoolYear: number; shift: Shift; teacher: Ref; studentCount: number; activeLoans: number; overdueLoans: number };
type ClassInput = { name: string; schoolYear: number; shift: Shift; teacherId: number };
type ClassQuery = { text?: string; schoolYear?: number; shift?: Shift };
type Student = {
  id: number; name: string; registration: string; classRoom: Ref & { teacher: Ref };
  guardian?: string; contact?: string; notes?: string;
  activeLoans: number; overdueLoans: number; readCount: number; createdAt: string;
};
type StudentInput = { name: string; registration: string; classId: number; guardian?: string; contact?: string; notes?: string };
type StudentQuery = { text?: string; classId?: number; overdueOnly?: boolean; page?: number; pageSize?: number };
type Loan = {
  id: number; copyId: number | null; code: string; book: { id: number | null; title: string; author: string };
  reader: Reader; loanedAt: string; dueAt: string; returnedAt?: string; markedRead: boolean; status: LoanStatus;
};
type LoanInput = { copyId: number; readerKind: ReaderKind; readerId: number; loanedAt: string; dueAt: string };
type LoanQuery = { status?: 'active' | 'overdue' | 'returned' | 'all'; text?: string; classId?: number; readerKind?: ReaderKind; page?: number; pageSize?: number };
type LoanPage = Page<Loan> & { counts: { active: number; overdue: number; returned: number; all: number } };
type CopyStatus = { copyId: number; code: string; status: 'available' | 'loaned' | 'overdue'; loan?: { id: number; reader: Reader; dueAt: string } };
type ReaderSummary = { reader: Reader; student?: Student; teacher?: Teacher; activeLoans: Loan[]; history: Loan[]; counts: { active: number; overdue: number; read: number } };
```

| Command | Entrada | Saída |
|---|---|---|
| `list_books` | `BookQuery` | `Page<Book>` |
| `get_book` | `{ id }` | `Book` |
| `create_book` | `BookInput` | `Book` |
| `update_book` | `{ id, input: BookInput }` | `Book` |
| `delete_book` | `{ id }` | `void` |
| `list_categories` | — | `Category[]` |
| `create_category` | `{ name, color? }` | `Category` |
| `update_category` | `{ id, name, color }` | `Category` |
| `get_stats` | — | `Stats` |
| `export_csv` | `{ path }` | `{ rows: number }` |
| `preview_csv` | `{ path }` | `CsvPreview` |
| `import_csv` | `{ path }` | `ImportReport` |
| `backup_db` | `{ path }` | `void` |
| `restore_db` | `{ path }` | `void` |
| `list_classes` | `ClassQuery` | `ClassRoom[]` |
| `get_class` | `{ id }` | `{ classRoom: ClassRoom; students: Student[] }` |
| `create_class` / `update_class` | `ClassInput` / `{ id, input: ClassInput }` | `ClassRoom` |
| `delete_class` | `{ id }` | `void` (`IN_USE` se tiver alunos) |
| `list_teachers` | `{ text? }` | `Teacher[]` |
| `create_teacher` / `update_teacher` | `TeacherInput` / `{ id, input: TeacherInput }` | `Teacher` |
| `delete_teacher` | `{ id }` | `void` (`IN_USE`, `HAS_ACTIVE_LOANS`) |
| `list_students` | `StudentQuery` | `Page<Student>` |
| `get_student` | `{ id }` | `Student` |
| `create_student` / `update_student` | `StudentInput` / `{ id, input: StudentInput }` | `Student` |
| `delete_student` | `{ id }` | `void` (`HAS_ACTIVE_LOANS`) |
| `search_readers` | `{ text, limit? }` | `Reader[]` (alunos e professores) |
| `get_reader_summary` | `{ kind: ReaderKind, id }` | `ReaderSummary` |
| `list_copy_status` | `{ bookId }` | `CopyStatus[]` |
| `create_loan` | `LoanInput` | `Loan` (`COPY_UNAVAILABLE`) |
| `return_loan` | `{ id, returnedAt, markedRead }` | `Loan` |
| `list_loans` | `LoanQuery` | `LoanPage` |

Erros: todo command retorna `Result<T, AppError>`; o front mostra `message` em toast e destaca `field` no formulário quando houver.

**Convenções (decididas pelo orquestrador em 2026-10-12):**
- Nomes dos argumentos do `invoke` (camelCase, padrão do Tauri): structs de consulta entram como `{ query }` e de entrada como `{ input }` — `list_books {query}`, `create_book {input}`, `update_book {id, input}`, `list_classes {query}`, `create_class {input}`, `update_class {id, input}`, `create_teacher {input}`, `update_teacher {id, input}`, `list_students {query}`, `create_student {input}`, `update_student {id, input}`, `list_loans {query}`, `create_loan {input}`. Parâmetros soltos ficam soltos: `list_teachers {text}`, `search_readers {text, limit}`, `get_reader_summary {kind, id}`, `list_copy_status {bookId}`, `return_loan {id, returnedAt, markedRead}`, `create_category {name, color}`, `update_category {id, name, color}`, `get_*`/`delete_* {id}`, CSV/backup `{path}`.
- `CsvPreview = { rows: { line: number; title: string; author: string; subject: string; categoryName: string; codes: string[]; status: 'ready' | 'duplicate' | 'error'; message?: string }[]; counts: { ready: number; duplicate: number; error: number } }`. Na importação, categoria inexistente é **criada** (cor da paleta de novas). Linhas `duplicate`/`error` são ignoradas e vão para o `ImportReport`.
- Duplicidade de nome de turma (nome + ano) e de categoria: `VALIDATION` com `field: "name"`.
- Código de exemplar duplicado: `DUPLICATE_CODE` com `field: "codes.<índice no input>"` e o código na `message`.
- `Reader.classLabel` só existe para aluno (`"5º ano A"`); para professor fica ausente — o front usa `Teacher.classes`.
- `Teacher.classes[].name` e `classLabel` trazem só o nome da turma (sem ano); o front formata se quiser o ano.
- `Loan.book` mostra o título/autor **atuais** enquanto o livro existir (`book_id` não nulo); o snapshot só aparece depois que o livro é apagado. A busca de empréstimos segue a mesma regra.
- `createdAt`/`updatedAt` saem em ISO 8601 UTC com `Z` (`2026-10-12T17:03:00Z`); o front converte para a hora local. Datas de empréstimo continuam `YYYY-MM-DD` locais.
- `list_loans` sem `status` = `active`. `search_readers` com texto vazio devolve os primeiros `limit` (padrão 20) em ordem alfabética.
- Busca: texto normalizado com NFKD (sem diacríticos, minúsculo, espaços colapsados), dividido em palavras, todas obrigatórias (AND). Códigos vazios no input são descartados antes da validação.
- "Livros lidos" = número de **livros distintos** com devolução marcada como lida.
- Antes de `restore_db`, o banco atual é copiado automaticamente para `app_data_dir()/backups/libok-pre-restore-<data-hora>.db`. `export_csv`, `backup_db` e `restore_db` recusam o caminho do banco em uso (`VALIDATION`, `field: "path"`).
- CSV exportado neutraliza fórmulas: células que começam com `= + - @` (ou tab/CR) recebem `'` na frente.

## 6. Estrutura de pastas e responsabilidade

```text
LiBok/
├── docs/
│   ├── BRIEFING.md            # este arquivo (orquestrador)
│   ├── design/                # links Figma, tokens exportados (figma-designer)
│   └── reviews/               # relatórios de revisão (gemini-reviewer)
├── src/                       # React
│   ├── app/                   # rotas, layout, providers (react-frontend)
│   ├── pages/                 # Dashboard, Acervo, Cadastro, ImportExport, Config, Turmas, Leitores, Empréstimos (react-frontend)
│   ├── features/              # hooks e componentes por domínio (react-frontend)
│   ├── lib/api.ts, types.ts   # wrapper do invoke + mocks (react-frontend)
│   ├── components/ui/         # Button, Input, Select, Table, Modal, Toast... (tailwind-ui)
│   └── styles/                # tokens @theme, globals.css (tailwind-ui)
└── src-tauri/
    ├── src/commands/          # handlers IPC (tauri-rust)
    ├── src/db/                # conexão, migrations, repositórios, normalização (sqlite-db)
    ├── migrations/            # .sql versionados (sqlite-db)
    ├── capabilities/          # permissões Tauri (tauri-rust)
    └── tauri.conf.json, Cargo.toml (tauri-rust)
```

**Regra de ouro:** cada agente só edita os arquivos da sua área. Precisa de algo fora dela? Registre o pedido no relatório final e o orquestrador repassa.

## 7. Identidade visual (ponto de partida)

Herdada da v1, refinada no Figma:

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#8284BD` | lavanda — sidebar, destaques |
| `secondary` | `#68754F` | verde-oliva — botões de ação |
| `secondary-hover` | `#7D8B5F` | |
| `accent` | `#F3D38A` | amarelo-areia — realces, badges |

Cores de categoria (seed): tecnologia `#4F6D7A`, infantil `#EB9486`, juvenil `#7E7F9A`, educativo `#CAE7B9`, romance `#D98E04`, ficção `#5B8E7D`, história `#C08497`. Paleta para novas: `#8C6E5D #4F6D7A #A44A3F #6B705C #6D597A #277DA1 #F9844A #43AA8B`.

Diretrizes: cantos arredondados (8–16 px), bastante respiro, tipografia legível (Inter ou similar), contraste AA, janela mínima 1024×640 e layout responsivo até 1920 px.

## 8. Telas para wireframe (Figma)

1. Splash / carregamento
2. Layout base: sidebar + header + área de conteúdo
3. Dashboard
4. Acervo (busca, filtros, tabela, estado vazio, paginação)
5. Cadastro / Edição de livro (com lista dinâmica de códigos e erros de validação)
6. Diálogo de confirmação de exclusão
7. Importar / Exportar (seleção de arquivo, prévia, relatório)
8. Configurações (tema, backup/restauração, categorias e cores)
9. Toasts e estados de erro/carregamento

Cada tela em claro e escuro, frame de 1280×800.

## 9. Agentes e orquestração

O **orquestrador** é o Claude principal: não escreve código de produto, apenas delega, integra, resolve conflitos e mantém este briefing.

| Agente | Motor | Papel |
|---|---|---|
| `libok-figma-designer` | Claude + Figma MCP | Wireframes, design system e telas no Figma |
| `libok-tauri-rust` | Claude | Scaffold Tauri v2, commands, plugins, capabilities, build |
| `libok-sqlite-db` | Claude | Schema, migrations, repositórios, busca normalizada, CSV/backup |
| `libok-react-frontend` | Claude | Rotas, páginas, estado, integração IPC, formulários |
| `libok-tailwind-ui` | Claude + Figma MCP | Tokens Tailwind e biblioteca de componentes a partir do Figma |
| `libok-gemini-reviewer` | Gemini CLI | Segunda opinião: revisão de código, QA, testes e acessibilidade |

### Fases

| Fase | Paralelo | Entregável |
|---|---|---|
| 0 — Fundação | figma-designer (wireframes) ‖ tauri-rust (scaffold) | Arquivo Figma com wireframes; app Tauri+React+Tailwind abrindo vazio |
| 1 — Construção | sqlite-db ‖ tailwind-ui ‖ react-frontend (com mocks) ‖ figma-designer (UI final) | DB + repositórios testados; componentes UI; páginas com mocks |
| 2 — Integração | tauri-rust (commands sobre os repositórios) → react-frontend (troca mocks por `invoke`) | App funcional ponta a ponta |
| 3 — Qualidade | gemini-reviewer → correções pelos donos de cada área | Relatório em `docs/reviews/`, bugs corrigidos |
| 4 — Entrega | tauri-rust | Instalador Windows + README |

### Protocolo de entrega de cada agente
Ao terminar, todo agente responde com: (1) o que foi feito, (2) arquivos alterados, (3) como verificar (comando), (4) pendências/pedidos a outros agentes, (5) desvios do briefing.

## 10. Critérios de aceite do MVP

- `npm run tauri dev` abre o app sem erros; `npm run tauri build` gera instalador.
- `cargo test` e `npm test` passam; `cargo clippy -- -D warnings` e `npm run lint` limpos.
- Cadastrar, buscar (com e sem acento), editar, excluir, importar e exportar funcionam com dados reais.
- Turmas, alunos e professores: cadastrar, editar, excluir (com bloqueios); emprestar um exemplar, ver no resumo do aluno, devolver marcando como lido; atrasos aparecem corretamente.
- Título e código duplicados são bloqueados com mensagem clara.
- CSV exportado abre corretamente no Excel (acentos preservados).
- Telas implementadas batem com o Figma (tolerância visual pequena) em claro e escuro.
- Dados persistem entre execuções e o backup restaura o acervo.
