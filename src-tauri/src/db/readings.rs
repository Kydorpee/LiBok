//! Leituras coletivas da turma ("Nova leitura").

use super::loans::LoanBook;
use super::normalize::normalize;
use super::types::{ClassReading, ClassReadingInput, Ref};
use super::{fmt_date, parse_date, utc_iso};
use crate::error::{AppError, AppResult};
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};

/// Chave de "livro distinto" de uma leitura (alias esperado: `r`); mesma
/// convenção de `loans::READ_KEY`.
pub(crate) const READING_KEY: &str = "COALESCE('b' || r.book_id, 'n' || r.book_norm)";

fn select_sql(where_sql: &str) -> String {
    let created = utc_iso("r.created_at");
    format!(
        "SELECT r.id, r.class_id, c.name, r.book_id, COALESCE(b.title, r.book_title),
            COALESCE(b.author, r.book_author), r.read_at,
            (SELECT COUNT(*) FROM class_reading_students x WHERE x.reading_id = r.id),
            (SELECT COUNT(*) FROM students s WHERE s.class_id = r.class_id),
            {created}
         FROM class_readings r
         JOIN classes c ON c.id = r.class_id
         LEFT JOIN books b ON b.id = r.book_id
         {where_sql}
         ORDER BY r.read_at DESC, r.id DESC"
    )
}

fn query(
    conn: &Connection,
    where_sql: &str,
    params: &[&dyn rusqlite::ToSql],
) -> AppResult<Vec<ClassReading>> {
    let mut stmt = conn.prepare(&select_sql(where_sql))?;
    let mut readings = stmt
        .query_map(params_from_iter(params.iter()), |row| {
            Ok(ClassReading {
                id: row.get(0)?,
                class_room: Ref {
                    id: row.get(1)?,
                    name: row.get(2)?,
                },
                book: LoanBook {
                    id: row.get(3)?,
                    title: row.get(4)?,
                    author: row.get(5)?,
                },
                read_at: row.get(6)?,
                present_count: row.get(7)?,
                class_size: row.get(8)?,
                students: Vec::new(),
                created_at: row.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let mut students = conn.prepare_cached(
        "SELECT s.id, s.name FROM class_reading_students x JOIN students s ON s.id = x.student_id
         WHERE x.reading_id = ?1 ORDER BY s.name_norm, s.id",
    )?;
    for reading in &mut readings {
        reading.students = students
            .query_map([reading.id], |r| {
                Ok(Ref {
                    id: r.get(0)?,
                    name: r.get(1)?,
                })
            })?
            .collect::<Result<_, _>>()?;
    }
    Ok(readings)
}

fn get(conn: &Connection, id: i64) -> AppResult<ClassReading> {
    query(conn, "WHERE r.id = ?1", &[&id])?
        .into_iter()
        .next()
        .ok_or_else(|| AppError::not_found("Leitura não encontrada."))
}

/// Leituras da turma, mais recente primeiro. `NOT_FOUND` se a turma não existe.
pub fn list_for_class(conn: &Connection, class_id: i64) -> AppResult<Vec<ClassReading>> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM classes WHERE id = ?1)",
        [class_id],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(AppError::not_found("Turma não encontrada."));
    }
    query(conn, "WHERE r.class_id = ?1", &[&class_id])
}

/// Leituras coletivas em que o aluno estava presente, mais recente primeiro.
pub fn list_for_student(conn: &Connection, student_id: i64) -> AppResult<Vec<ClassReading>> {
    query(
        conn,
        "WHERE r.id IN (SELECT reading_id FROM class_reading_students WHERE student_id = ?1)",
        &[&student_id],
    )
}

/// Registra uma leitura coletiva (transação). Ids repetidos em `student_ids`
/// são deduplicados.
pub fn create(conn: &Connection, input: &ClassReadingInput) -> AppResult<ClassReading> {
    let read_at = fmt_date(parse_date("readAt", &input.read_at)?);
    let mut ids: Vec<i64> = Vec::with_capacity(input.student_ids.len());
    for id in &input.student_ids {
        if !ids.contains(id) {
            ids.push(*id);
        }
    }
    if ids.is_empty() {
        return Err(AppError::validation(
            "studentIds",
            "Marque pelo menos um aluno presente.",
        ));
    }

    let tx = conn.unchecked_transaction()?;
    let class_exists: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM classes WHERE id = ?1)",
        [input.class_id],
        |r| r.get(0),
    )?;
    if !class_exists {
        return Err(AppError::not_found("Turma não encontrada."));
    }
    let (title, author): (String, String) = tx
        .query_row(
            "SELECT title, author FROM books WHERE id = ?1",
            [input.book_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| AppError::not_found("Livro não encontrado."))?;
    for id in &ids {
        let in_class: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM students WHERE id = ?1 AND class_id = ?2)",
            params![id, input.class_id],
            |r| r.get(0),
        )?;
        if !in_class {
            return Err(AppError::validation(
                "studentIds",
                "Todos os alunos precisam pertencer à turma.",
            ));
        }
    }
    let duplicate: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM class_readings
          WHERE class_id = ?1 AND book_id = ?2 AND read_at = ?3)",
        params![input.class_id, input.book_id, read_at],
        |r| r.get(0),
    )?;
    if duplicate {
        return Err(AppError::validation(
            "bookId",
            "A turma já registrou este livro nesta data.",
        ));
    }

    tx.execute(
        "INSERT INTO class_readings (class_id, book_id, book_title, book_author, book_norm, read_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            input.class_id,
            input.book_id,
            title,
            author,
            normalize(&format!("{title} {author}")),
            read_at
        ],
    )?;
    let id = tx.last_insert_rowid();
    {
        let mut stmt = tx.prepare(
            "INSERT INTO class_reading_students (reading_id, student_id) VALUES (?1, ?2)",
        )?;
        for student_id in &ids {
            stmt.execute(params![id, student_id])?;
        }
    }
    tx.commit()?;
    get(conn, id)
}

/// Exclui a leitura (e as presenças, em cascata). `NOT_FOUND` se não existe.
pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM class_readings WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(AppError::not_found("Leitura não encontrada."));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::loans::{self, LoanInput};
    use crate::db::readers::get_reader_summary;
    use crate::db::testutil::{book, class, db, school, student, teacher, today};
    use crate::db::types::ReaderKind;
    use crate::db::{books, classes, students};
    use crate::error::ErrorCode;

    fn input(class_id: i64, book_id: i64, date: &str, ids: &[i64]) -> ClassReadingInput {
        ClassReadingInput {
            class_id,
            book_id,
            read_at: date.into(),
            student_ids: ids.to_vec(),
        }
    }

    fn read_count(conn: &Connection, s: i64) -> i64 {
        students::get(conn, s, today()).unwrap().read_count
    }

    fn count(conn: &Connection, table: &str) -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn cria_lista_e_exclui() {
        let conn = db();
        let (_, c, s1) = school(&conn);
        let s2 = student(&conn, "Ana Souza", "2026002", c);
        let s3 = student(&conn, "Álvaro Lima", "2026003", c);
        let b = book(&conn, "Dom Casmurro", &["A1"]);

        // ids repetidos são deduplicados; presentes em ordem alfabética
        let r = create(&conn, &input(c, b.id, "2026-10-10", &[s2, s1, s2, s3])).unwrap();
        assert_eq!(r.present_count, 3);
        assert_eq!(r.class_size, 3);
        let names: Vec<_> = r.students.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, ["Álvaro Lima", "Ana Souza", "João da Silva"]);
        assert_eq!(r.book.id, Some(b.id));
        assert_eq!(r.book.title, "Dom Casmurro");
        assert_eq!(r.class_room.name, "5º ano A");
        assert_eq!(r.read_at, "2026-10-10");
        assert!(r.created_at.ends_with('Z'));

        let newer = create(&conn, &input(c, b.id, "2026-10-11", &[s1])).unwrap();
        let list = list_for_class(&conn, c).unwrap();
        let ids: Vec<_> = list.iter().map(|x| x.id).collect();
        assert_eq!(ids, [newer.id, r.id]);
        assert_eq!(list[0].present_count, 1);
        assert_eq!(list[0].class_size, 3);

        delete(&conn, r.id).unwrap();
        assert_eq!(list_for_class(&conn, c).unwrap().len(), 1);
        assert_eq!(delete(&conn, r.id).unwrap_err().code, ErrorCode::NotFound);
        assert_eq!(count(&conn, "class_reading_students"), 1);
        assert_eq!(
            list_for_class(&conn, 999).unwrap_err().code,
            ErrorCode::NotFound
        );
    }

    #[test]
    fn validacoes() {
        let conn = db();
        let (t, c, s1) = school(&conn);
        let other_class = class(&conn, "6º ano B", t);
        let stranger = student(&conn, "Pedro Alheio", "9", other_class);
        let b = book(&conn, "Livro", &["A1"]);
        let field = |e: crate::error::AppError| (e.code, e.field);
        let v = |f: &str| (ErrorCode::Validation, Some(f.to_string()));

        let e = create(&conn, &input(c, b.id, "2026-10-10", &[])).unwrap_err();
        assert_eq!(field(e), v("studentIds"));
        let e = create(&conn, &input(c, b.id, "2026-10-10", &[s1, stranger])).unwrap_err();
        assert_eq!(field(e), v("studentIds"));
        let e = create(&conn, &input(c, b.id, "2026-10-10", &[999])).unwrap_err();
        assert_eq!(field(e), v("studentIds"));
        let e = create(&conn, &input(c, 999, "2026-10-10", &[s1])).unwrap_err();
        assert_eq!(e.code, ErrorCode::NotFound);
        let e = create(&conn, &input(999, b.id, "2026-10-10", &[s1])).unwrap_err();
        assert_eq!(e.code, ErrorCode::NotFound);
        for bad in ["", "10/10/2026", "2026-02-30", "abc"] {
            let e = create(&conn, &input(c, b.id, bad, &[s1])).unwrap_err();
            assert_eq!(field(e), v("readAt"), "{bad}");
        }

        create(&conn, &input(c, b.id, "2026-10-10", &[s1])).unwrap();
        let e = create(&conn, &input(c, b.id, "2026-10-10", &[s1])).unwrap_err();
        assert_eq!(field(e), v("bookId"));
        // outra data ou outra turma: permitido
        create(&conn, &input(c, b.id, "2026-10-11", &[s1])).unwrap();
        create(&conn, &input(other_class, b.id, "2026-10-10", &[stranger])).unwrap();
        // nada ficou pela metade nas tentativas que falharam
        assert_eq!(count(&conn, "class_readings"), 3);
        assert_eq!(count(&conn, "class_reading_students"), 3);
    }

    #[test]
    fn leitura_conta_como_lida_sem_dobrar_com_emprestimo() {
        let conn = db();
        let (_, c, s1) = school(&conn);
        let s2 = student(&conn, "Ana", "2", c);
        let absent = student(&conn, "Zé", "3", c);
        let a = book(&conn, "Livro A", &["A1"]);
        let b = book(&conn, "Livro B", &["B1"]);

        create(&conn, &input(c, a.id, "2026-10-10", &[s1, s2])).unwrap();
        assert_eq!(read_count(&conn, s1), 1);
        assert_eq!(read_count(&conn, s2), 1);
        assert_eq!(read_count(&conn, absent), 0, "ausente não conta");

        // mesmo livro por empréstimo marcado como lido: continua 1
        let copy: i64 = conn
            .query_row(
                "SELECT id FROM copies WHERE registration_code = 'A1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let l = loans::create(
            &conn,
            &LoanInput {
                copy_id: copy,
                reader_kind: ReaderKind::Student,
                reader_id: s1,
                loaned_at: "2026-09-01".into(),
                due_at: "2026-09-15".into(),
            },
            today(),
        )
        .unwrap();
        loans::return_loan(&conn, l.id, "2026-09-10", true, today()).unwrap();
        assert_eq!(read_count(&conn, s1), 1);

        // outro livro lido coletivamente: 2
        create(&conn, &input(c, b.id, "2026-10-11", &[s1])).unwrap();
        assert_eq!(read_count(&conn, s1), 2);
        let sum = get_reader_summary(&conn, ReaderKind::Student, s1, today()).unwrap();
        assert_eq!(sum.counts.read, 2);
        assert_eq!(sum.readings.len(), 2);
        assert_eq!(
            sum.readings[0].book.title, "Livro B",
            "mais recente primeiro"
        );
        let sum = get_reader_summary(&conn, ReaderKind::Student, absent, today()).unwrap();
        assert!(sum.readings.is_empty());

        // livro apagado: leitura e empréstimo continuam sendo o mesmo livro (book_norm)
        books::delete(&conn, a.id).unwrap();
        assert_eq!(read_count(&conn, s1), 2);
        assert_eq!(read_count(&conn, s2), 1);

        // professor não tem leituras coletivas
        let t = teacher(&conn, "Outra");
        let sum = get_reader_summary(&conn, ReaderKind::Teacher, t, today()).unwrap();
        assert!(sum.readings.is_empty());
    }

    #[test]
    fn editar_atualiza_e_apagar_livro_mantem_snapshot() {
        let conn = db();
        let (_, c, s1) = school(&conn);
        let b = book(&conn, "Titulo Antigo", &["A1"]);
        let r = create(&conn, &input(c, b.id, "2026-10-10", &[s1])).unwrap();

        let edit = books::BookInput {
            title: "Titulo Novo".into(),
            author: "Outro Autor".into(),
            subject: "Assunto".into(),
            category_id: b.category.id,
            codes: vec!["A1".into()],
        };
        books::update(&conn, b.id, &edit).unwrap();
        assert_eq!(get(&conn, r.id).unwrap().book.title, "Titulo Novo");
        let norm: String = conn
            .query_row("SELECT book_norm FROM class_readings", [], |r| r.get(0))
            .unwrap();
        assert_eq!(norm, "titulo novo outro autor");

        books::delete(&conn, b.id).unwrap();
        let gone = get(&conn, r.id).unwrap();
        assert_eq!(gone.book.id, None);
        assert_eq!(gone.book.title, "Titulo Novo");
        assert_eq!(gone.book.author, "Outro Autor");
        assert_eq!(read_count(&conn, s1), 1);
    }

    #[test]
    fn apagar_aluno_remove_so_a_presenca_dele() {
        let conn = db();
        let (_, c, s1) = school(&conn);
        let s2 = student(&conn, "Ana", "2", c);
        let b = book(&conn, "Livro", &["A1"]);
        let r = create(&conn, &input(c, b.id, "2026-10-10", &[s1, s2])).unwrap();
        students::delete(&conn, s1).unwrap();
        let after = get(&conn, r.id).unwrap();
        assert_eq!(after.present_count, 1);
        assert_eq!(after.class_size, 1);
        assert_eq!(after.students[0].id, s2);
    }

    #[test]
    fn apagar_turma_sem_alunos_apaga_as_leituras() {
        let conn = db();
        let (_, c, s1) = school(&conn);
        let b = book(&conn, "Livro", &["A1"]);
        create(&conn, &input(c, b.id, "2026-10-10", &[s1])).unwrap();
        assert_eq!(
            classes::delete(&conn, c).unwrap_err().code,
            ErrorCode::InUse
        );
        students::delete(&conn, s1).unwrap();
        classes::delete(&conn, c).unwrap();
        assert_eq!(count(&conn, "class_readings"), 0);
        assert_eq!(count(&conn, "class_reading_students"), 0);
    }
}
