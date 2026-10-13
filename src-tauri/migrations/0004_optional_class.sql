-- Turma opcional: aluno "Sem turma" e leituras que sobrevivem à exclusão da turma.
--
-- RECRIA `students` e `class_readings` (padrão de 12 passos do SQLite). Por isso
-- `db::migrate` desliga `foreign_keys` FORA da transação antes de aplicar esta
-- migration e religa depois; sem isso o DROP TABLE dispararia ON DELETE CASCADE
-- em `loans` e `class_reading_students`. Os ids são preservados, e as FKs
-- que apontam para estas tabelas (por nome) continuam valendo após o RENAME.
-- O `foreign_key_check` é feito pelo runner (M::foreign_key_check) antes do commit.

CREATE TABLE students_new (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  name_norm    TEXT NOT NULL,
  registration TEXT NOT NULL UNIQUE,
  class_id     INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  guardian     TEXT,
  contact      TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO students_new (id, name, name_norm, registration, class_id, guardian, contact, notes, created_at)
  SELECT id, name, name_norm, registration, class_id, guardian, contact, notes, created_at FROM students;
DROP TABLE students;
ALTER TABLE students_new RENAME TO students;
CREATE INDEX idx_students_class ON students(class_id);

CREATE TABLE class_readings_new (
  id          INTEGER PRIMARY KEY,
  class_id    INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  class_name  TEXT NOT NULL,                 -- snapshot do nome da turma
  book_id     INTEGER REFERENCES books(id) ON DELETE SET NULL,
  book_title  TEXT NOT NULL,
  book_author TEXT NOT NULL,
  book_norm   TEXT NOT NULL,
  read_at     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO class_readings_new (id, class_id, class_name, book_id, book_title, book_author, book_norm, read_at, created_at)
  SELECT r.id, r.class_id, COALESCE((SELECT c.name FROM classes c WHERE c.id = r.class_id), ''),
         r.book_id, r.book_title, r.book_author, r.book_norm, r.read_at, r.created_at
  FROM class_readings r;
DROP TABLE class_readings;
ALTER TABLE class_readings_new RENAME TO class_readings;
CREATE UNIQUE INDEX idx_class_readings_unique ON class_readings(class_id, book_id, read_at) WHERE book_id IS NOT NULL;
CREATE INDEX idx_class_readings_book ON class_readings(book_id);
