-- LiBok v2 - schema inicial (briefing §4) + seed de categorias (§7).

CREATE TABLE categories (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  name_norm TEXT NOT NULL UNIQUE,
  color     TEXT NOT NULL
);

CREATE TABLE books (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  title_norm   TEXT NOT NULL UNIQUE,
  author       TEXT NOT NULL,
  author_norm  TEXT NOT NULL,
  subject      TEXT NOT NULL,
  subject_norm TEXT NOT NULL,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
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
  name        TEXT NOT NULL,
  name_norm   TEXT NOT NULL,
  school_year INTEGER NOT NULL,
  shift       TEXT NOT NULL CHECK (shift IN ('morning','afternoon','evening','fullday')),
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  UNIQUE (name_norm, school_year)
);

CREATE TABLE students (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  name_norm    TEXT NOT NULL,
  registration TEXT NOT NULL UNIQUE,
  class_id     INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  guardian     TEXT,
  contact      TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE loans (
  id          INTEGER PRIMARY KEY,
  copy_id     INTEGER REFERENCES copies(id) ON DELETE SET NULL,
  student_id  INTEGER REFERENCES students(id) ON DELETE CASCADE,
  teacher_id  INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  copy_code   TEXT NOT NULL,
  book_title  TEXT NOT NULL,
  book_author TEXT NOT NULL,
  book_norm   TEXT NOT NULL DEFAULT '',   -- título + autor normalizados (busca no histórico)
  loaned_at   TEXT NOT NULL,
  due_at      TEXT NOT NULL,
  returned_at TEXT,
  marked_read INTEGER NOT NULL DEFAULT 0,
  CHECK ((student_id IS NULL) <> (teacher_id IS NULL))
);

CREATE UNIQUE INDEX idx_loans_active_copy ON loans(copy_id) WHERE returned_at IS NULL;
CREATE INDEX idx_loans_student ON loans(student_id);
CREATE INDEX idx_loans_teacher ON loans(teacher_id);
CREATE INDEX idx_loans_due     ON loans(due_at) WHERE returned_at IS NULL;
CREATE INDEX idx_students_class ON students(class_id);

-- Seed: categorias da v1
INSERT INTO categories (name, name_norm, color) VALUES
  ('Tecnologia', 'tecnologia', '#4F6D7A'),
  ('Infantil',   'infantil',   '#EB9486'),
  ('Juvenil',    'juvenil',    '#7E7F9A'),
  ('Educativo',  'educativo',  '#CAE7B9'),
  ('Romance',    'romance',    '#D98E04'),
  ('Ficção',     'ficcao',     '#5B8E7D'),
  ('História',   'historia',   '#C08497');
