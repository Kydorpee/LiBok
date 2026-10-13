-- Leituras coletivas da turma ("Nova leitura").
-- Só cria tabelas e índices novos: não recria nenhuma tabela existente
-- (ver regras em db/mod.rs).
CREATE TABLE class_readings (
  id          INTEGER PRIMARY KEY,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  book_id     INTEGER REFERENCES books(id) ON DELETE SET NULL,
  book_title  TEXT NOT NULL,                 -- snapshot (usado só se o livro for apagado)
  book_author TEXT NOT NULL,
  book_norm   TEXT NOT NULL,
  read_at     TEXT NOT NULL,                 -- 'YYYY-MM-DD' local
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_class_readings_unique ON class_readings(class_id, book_id, read_at) WHERE book_id IS NOT NULL;
CREATE INDEX idx_class_readings_book ON class_readings(book_id);

CREATE TABLE class_reading_students (
  reading_id INTEGER NOT NULL REFERENCES class_readings(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (reading_id, student_id)
);
CREATE INDEX idx_crs_student ON class_reading_students(student_id);
