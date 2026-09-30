CREATE TABLE categoria (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nome              TEXT    NOT NULL,
    nome_normalizado  TEXT    NOT NULL UNIQUE,
    cor               TEXT    NOT NULL
);

CREATE TABLE livro (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo              TEXT    NOT NULL,
    titulo_normalizado  TEXT    NOT NULL UNIQUE,
    autor               TEXT    NOT NULL,
    categoria_id        INTEGER NOT NULL REFERENCES categoria (id),
    assunto             TEXT    NOT NULL,
    isbn                TEXT,
    ano_publicacao      INTEGER,
    descricao           TEXT,
    texto_busca         TEXT    NOT NULL,
    criado_em           TEXT    NOT NULL,
    atualizado_em       TEXT    NOT NULL
);
CREATE INDEX idx_livro_categoria ON livro (categoria_id);

CREATE TABLE exemplar (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    livro_id           INTEGER NOT NULL REFERENCES livro (id) ON DELETE CASCADE,
    codigo             TEXT    NOT NULL,
    codigo_normalizado TEXT    NOT NULL UNIQUE,
    situacao           TEXT    NOT NULL
);
CREATE INDEX idx_exemplar_livro ON exemplar (livro_id);

CREATE TABLE leitor (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nome              TEXT    NOT NULL,
    nome_normalizado  TEXT    NOT NULL,
    matricula         TEXT    UNIQUE,
    turma             TEXT,
    telefone          TEXT,
    email             TEXT,
    observacao        TEXT,
    ativo             INTEGER NOT NULL DEFAULT 1,
    criado_em         TEXT    NOT NULL
);

CREATE TABLE emprestimo (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    exemplar_id         INTEGER NOT NULL REFERENCES exemplar (id) ON DELETE CASCADE,
    leitor_id           INTEGER NOT NULL REFERENCES leitor (id),
    data_emprestimo     TEXT    NOT NULL,
    data_prevista       TEXT    NOT NULL,
    data_devolucao      TEXT,
    renovacoes          INTEGER NOT NULL DEFAULT 0,
    observacao          TEXT
);
CREATE INDEX idx_emprestimo_exemplar ON emprestimo (exemplar_id);
CREATE INDEX idx_emprestimo_leitor ON emprestimo (leitor_id);
CREATE INDEX idx_emprestimo_data ON emprestimo (data_emprestimo);

CREATE TABLE importacao (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_arquivo  TEXT    NOT NULL,
    origem        TEXT    NOT NULL,
    realizada_em  TEXT    NOT NULL,
    importados    INTEGER NOT NULL,
    ignorados     INTEGER NOT NULL,
    com_erro      INTEGER NOT NULL,
    log           TEXT    NOT NULL
);

CREATE TABLE configuracao (
    id                        INTEGER PRIMARY KEY CHECK (id = 1),
    nome_biblioteca           TEXT    NOT NULL,
    prazo_emprestimo_dias     INTEGER NOT NULL,
    limite_emprestimos        INTEGER NOT NULL,
    bloquear_com_atraso       INTEGER NOT NULL
);
INSERT INTO configuracao (id, nome_biblioteca, prazo_emprestimo_dias, limite_emprestimos, bloquear_com_atraso)
VALUES (1, 'Minha Biblioteca', 14, 3, 1);
