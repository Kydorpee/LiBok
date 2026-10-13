-- F-04/F-05: o empréstimo passa a guardar o vínculo direto com o livro.
-- `book_id` sobrevive à remoção/renomeação do código (copy_id vira NULL) e só
-- fica NULL quando o próprio livro é excluído (ON DELETE SET NULL); a partir daí
-- valem os snapshots (book_title, book_author, book_norm).
--
-- ADD COLUMN não recria a tabela (padrão obrigatório para migrations leves com
-- foreign_keys=ON; ver db/mod.rs). A coluna nova precisa de DEFAULT NULL.
ALTER TABLE loans ADD COLUMN book_id INTEGER REFERENCES books(id) ON DELETE SET NULL;

-- Backfill: empréstimos cujo exemplar ainda existe.
UPDATE loans
   SET book_id = (SELECT cp.book_id FROM copies cp WHERE cp.id = loans.copy_id)
 WHERE copy_id IS NOT NULL;

CREATE INDEX idx_loans_book ON loans(book_id);
