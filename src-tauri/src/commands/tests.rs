//! Testes dos commands pela IPC real do Tauri (runtime mock + banco em memória).
//!
//! Passar pelo `invoke` valida, além da delegação aos repositórios, os nomes
//! dos argumentos (`query`, `input`, `bookId`, `returnedAt`...) e o formato
//! serializado de sucesso e de erro, exatamente como o front recebe.

use crate::db;
use crate::state::DbState;
use serde_json::{Value, json};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{
    INVOKE_KEY, MockRuntime, get_ipc_response, mock_builder, mock_context, noop_assets,
};
use tauri::webview::InvokeRequest;
use tauri::{App, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// Todos os commands da tabela do §5.
const CONTRACT: [&str; 34] = [
    "list_books",
    "get_book",
    "create_book",
    "update_book",
    "delete_book",
    "list_categories",
    "create_category",
    "update_category",
    "get_stats",
    "export_csv",
    "preview_csv",
    "import_csv",
    "backup_db",
    "restore_db",
    "list_classes",
    "get_class",
    "create_class",
    "update_class",
    "delete_class",
    "list_teachers",
    "create_teacher",
    "update_teacher",
    "delete_teacher",
    "list_students",
    "get_student",
    "create_student",
    "update_student",
    "delete_student",
    "search_readers",
    "get_reader_summary",
    "list_copy_status",
    "create_loan",
    "return_loan",
    "list_loans",
];

struct Harness {
    _app: App<MockRuntime>,
    webview: WebviewWindow<MockRuntime>,
}

impl Harness {
    fn new() -> Self {
        Self::with_conn(db::open_in_memory().expect("banco em memória"))
    }

    /// Harness sobre uma conexão já aberta (ex.: banco em arquivo).
    fn with_conn(conn: rusqlite::Connection) -> Self {
        let app = mock_builder()
            .manage(DbState::new(conn))
            .invoke_handler(super::handler())
            .build(mock_context(noop_assets()))
            .expect("app mock");
        let webview = WebviewWindowBuilder::new(&app, "main", WebviewUrl::default())
            .build()
            .expect("webview mock");
        Self { _app: app, webview }
    }

    /// Invoca `cmd` com `args` e devolve o JSON de sucesso ou de erro.
    fn call(&self, cmd: &str, args: Value) -> Result<Value, Value> {
        let url = if cfg!(any(windows, target_os = "android")) {
            "http://tauri.localhost"
        } else {
            "tauri://localhost"
        };
        get_ipc_response(
            &self.webview,
            InvokeRequest {
                cmd: cmd.into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: url.parse().expect("url"),
                body: InvokeBody::Json(args),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_string(),
            },
        )
        .map(|body| body.deserialize::<Value>().expect("resposta JSON"))
    }

    fn ok(&self, cmd: &str, args: Value) -> Value {
        match self.call(cmd, args) {
            Ok(v) => v,
            Err(e) => panic!("{cmd} falhou: {e}"),
        }
    }

    fn err(&self, cmd: &str, args: Value) -> Value {
        match self.call(cmd, args) {
            Ok(v) => panic!("{cmd} deveria falhar, mas retornou {v}"),
            Err(e) => e,
        }
    }

    fn category_id(&self, name: &str) -> i64 {
        let cats = self.ok("list_categories", json!({}));
        cats.as_array()
            .and_then(|list| list.iter().find(|c| c["name"] == name))
            .and_then(|c| c["id"].as_i64())
            .expect("categoria do seed")
    }

    /// Professor + turma + aluno; devolve `(teacher_id, class_id, student_id)`.
    fn school(&self) -> (i64, i64, i64) {
        let teacher = self.ok(
            "create_teacher",
            json!({ "input": { "name": "Profa. Marta", "contact": "9999" } }),
        );
        let teacher_id = teacher["id"].as_i64().expect("id");
        let class = self.ok(
            "create_class",
            json!({ "input": {
                "name": "5º ano A", "schoolYear": 2026, "shift": "morning", "teacherId": teacher_id
            } }),
        );
        let class_id = class["id"].as_i64().expect("id");
        let student = self.ok(
            "create_student",
            json!({ "input": { "name": "João da Silva", "registration": "2026001", "classId": class_id } }),
        );
        (teacher_id, class_id, student["id"].as_i64().expect("id"))
    }
}

fn temp_file(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("libok-cmd-{}-{name}", std::process::id()));
    std::fs::create_dir_all(&dir).expect("pasta temporária");
    dir.join(name)
}

#[test]
fn todos_os_commands_do_contrato_estao_registrados() {
    let h = Harness::new();
    for cmd in CONTRACT {
        if let Err(Value::String(msg)) = h.call(cmd, json!({})) {
            assert!(
                !msg.contains(&format!("Command {cmd} not found")),
                "{cmd} não registrado"
            );
        }
    }
    let unknown = h.err("nao_existe", json!({}));
    assert_eq!(unknown, json!("Command nao_existe not found"));
}

#[test]
fn ciclo_de_livro_com_nomes_de_argumentos_do_contrato() {
    let h = Harness::new();
    let romance = h.category_id("Romance");
    let input = json!({
        "title": "História do Brasil", "author": "Boris Fausto", "subject": "História",
        "categoryId": romance, "codes": ["H1", "H2"]
    });
    let book = h.ok("create_book", json!({ "input": input }));
    let id = book["id"].as_i64().expect("id");
    assert_eq!(book["quantity"], 2);
    assert_eq!(book["availableCount"], 2);
    assert_eq!(book["category"]["name"], "Romance");

    let page = h.ok(
        "list_books",
        json!({ "query": { "text": "historia", "pageSize": 10 } }),
    );
    assert_eq!(page["total"], 1);
    assert_eq!(page["pageSize"], 10);
    assert_eq!(h.ok("list_books", json!({ "query": {} }))["total"], 1);

    assert_eq!(
        h.ok("get_book", json!({ "id": id }))["title"],
        "História do Brasil"
    );

    let updated = h.ok(
        "update_book",
        json!({ "id": id, "input": {
            "title": "História do Brasil", "author": "Boris Fausto", "subject": "História",
            "categoryId": romance, "codes": ["H1", "H3"]
        } }),
    );
    assert_eq!(updated["codes"], json!(["H1", "H3"]));

    let copies = h.ok("list_copy_status", json!({ "bookId": id }));
    assert_eq!(copies.as_array().map(Vec::len), Some(2));
    assert_eq!(copies[0]["status"], "available");

    assert_eq!(h.ok("delete_book", json!({ "id": id })), Value::Null);
    let err = h.err("get_book", json!({ "id": id }));
    assert_eq!(err["code"], "NOT_FOUND");
}

#[test]
fn erros_chegam_no_formato_app_error() {
    let h = Harness::new();
    let romance = h.category_id("Romance");
    let input = |title: &str, code: &str| {
        json!({ "input": {
            "title": title, "author": "A", "subject": "S", "categoryId": romance, "codes": [code]
        } })
    };
    h.ok("create_book", input("Dom Casmurro", "A1"));

    let dup = h.err("create_book", input("  dom CASMURRO ", "A2"));
    assert_eq!(dup["code"], "DUPLICATE_TITLE");
    assert_eq!(dup["field"], "title");
    assert!(dup["message"].is_string());

    let code = h.err("create_book", input("Outro", "A1"));
    assert_eq!(code["code"], "DUPLICATE_CODE");
    assert_eq!(code["field"], "codes.0");

    let blank = h.err("create_book", input("", "B1"));
    assert_eq!(blank["code"], "VALIDATION");
    assert_eq!(blank["field"], "title");

    let not_found = h.err("delete_book", json!({ "id": 999 }));
    assert_eq!(not_found["code"], "NOT_FOUND");
    assert!(not_found.get("field").is_none());
}

#[test]
fn categorias_e_dashboard() {
    let h = Harness::new();
    let created = h.ok("create_category", json!({ "name": "Poesia" }));
    assert!(
        created["color"]
            .as_str()
            .is_some_and(|c| c.starts_with('#'))
    );
    let id = created["id"].as_i64().expect("id");
    let updated = h.ok(
        "update_category",
        json!({ "id": id, "name": "Poesias", "color": "#112233" }),
    );
    assert_eq!(updated["color"], "#112233");
    let dup = h.err(
        "create_category",
        json!({ "name": "poesias", "color": null }),
    );
    assert_eq!(
        (dup["code"].clone(), dup["field"].clone()),
        (json!("VALIDATION"), json!("name"))
    );

    let stats = h.ok("get_stats", json!({}));
    assert_eq!(stats["totalBooks"], 0);
    assert_eq!(stats["activeLoans"], 0);
    assert!(stats["byCategory"].is_array() && stats["recent"].is_array());
}

#[test]
fn circulacao_ponta_a_ponta() {
    let h = Harness::new();
    let (teacher_id, class_id, student_id) = h.school();
    let romance = h.category_id("Romance");
    let book = h.ok(
        "create_book",
        json!({ "input": {
            "title": "Dom Casmurro", "author": "Machado de Assis", "subject": "Romance",
            "categoryId": romance, "codes": ["A1"]
        } }),
    );
    let book_id = book["id"].as_i64().expect("id");
    let copy_id = h.ok("list_copy_status", json!({ "bookId": book_id }))[0]["copyId"]
        .as_i64()
        .expect("copyId");

    // turmas, professores e alunos
    let classes = h.ok(
        "list_classes",
        json!({ "query": { "schoolYear": 2026, "shift": "morning" } }),
    );
    assert_eq!(classes[0]["teacher"]["id"], teacher_id);
    let detail = h.ok("get_class", json!({ "id": class_id }));
    assert_eq!(detail["classRoom"]["studentCount"], 1);
    assert_eq!(detail["students"][0]["registration"], "2026001");
    assert_eq!(
        h.ok("list_teachers", json!({}))[0]["classes"][0]["name"],
        "5º ano A"
    );
    assert_eq!(
        h.ok("list_teachers", json!({ "text": "marta" }))
            .as_array()
            .map(Vec::len),
        Some(1)
    );
    let students = h.ok("list_students", json!({ "query": { "classId": class_id } }));
    assert_eq!(students["total"], 1);
    assert_eq!(
        h.ok("get_student", json!({ "id": student_id }))["classRoom"]["teacher"]["name"],
        "Profa. Marta"
    );

    // busca de leitores (sem acento, alunos e professores)
    let found = h.ok("search_readers", json!({ "text": "joao" }));
    assert_eq!(found[0]["kind"], "student");
    assert_eq!(found[0]["classLabel"], "5º ano A");
    let limited = h.ok("search_readers", json!({ "text": "", "limit": 1 }));
    assert_eq!(limited.as_array().map(Vec::len), Some(1));

    // empréstimo e bloqueios
    let loan_input = json!({ "input": {
        "copyId": copy_id, "readerKind": "student", "readerId": student_id,
        "loanedAt": "2026-10-01", "dueAt": "2099-12-31"
    } });
    let loan = h.ok("create_loan", loan_input.clone());
    let loan_id = loan["id"].as_i64().expect("id");
    assert_eq!(loan["status"], "active");
    assert_eq!(h.err("create_loan", loan_input)["code"], "COPY_UNAVAILABLE");
    assert_eq!(
        h.err("delete_student", json!({ "id": student_id }))["code"],
        "HAS_ACTIVE_LOANS"
    );
    assert_eq!(
        h.err("delete_book", json!({ "id": book_id }))["code"],
        "HAS_ACTIVE_LOANS"
    );
    assert_eq!(
        h.err("delete_class", json!({ "id": class_id }))["code"],
        "IN_USE"
    );
    assert_eq!(
        h.err("delete_teacher", json!({ "id": teacher_id }))["code"],
        "IN_USE"
    );
    assert_eq!(
        h.ok("list_copy_status", json!({ "bookId": book_id }))[0]["status"],
        "loaned"
    );

    let loans = h.ok(
        "list_loans",
        json!({ "query": { "status": "all", "text": "casmurro" } }),
    );
    assert_eq!(loans["total"], 1);
    assert_eq!(loans["counts"]["active"], 1);

    // devolução marcando como lido
    let returned = h.ok(
        "return_loan",
        json!({ "id": loan_id, "returnedAt": "2026-10-05", "markedRead": true }),
    );
    assert_eq!(returned["status"], "returned");
    assert_eq!(returned["markedRead"], true);
    assert_eq!(returned["returnedAt"], "2026-10-05");

    let summary = h.ok(
        "get_reader_summary",
        json!({ "kind": "student", "id": student_id }),
    );
    assert_eq!(
        summary["counts"],
        json!({ "active": 0, "overdue": 0, "read": 1 })
    );
    assert_eq!(summary["history"][0]["book"]["title"], "Dom Casmurro");
    assert!(summary["student"].is_object() && summary.get("teacher").is_none());

    // sem empréstimo ativo, os bloqueios caem
    assert_eq!(
        h.ok("delete_student", json!({ "id": student_id })),
        Value::Null
    );
    assert_eq!(h.ok("delete_class", json!({ "id": class_id })), Value::Null);
    let teacher = h.ok(
        "update_teacher",
        json!({ "id": teacher_id, "input": { "name": "Marta Souza" } }),
    );
    assert_eq!(teacher["name"], "Marta Souza");
    assert_eq!(
        h.ok("delete_teacher", json!({ "id": teacher_id })),
        Value::Null
    );
}

#[test]
fn csv_e_backup_por_caminho() {
    let h = Harness::new();
    let romance = h.category_id("Romance");
    h.ok(
        "create_book",
        json!({ "input": {
            "title": "Livro Salvo", "author": "A", "subject": "S", "categoryId": romance, "codes": ["S1"]
        } }),
    );

    let csv_path = temp_file("acervo.csv");
    let exported = h.ok("export_csv", json!({ "path": csv_path }));
    assert_eq!(exported, json!({ "rows": 1 }));
    let preview = h.ok("preview_csv", json!({ "path": csv_path }));
    assert_eq!(preview["counts"]["duplicate"], 1);
    let report = h.ok("import_csv", json!({ "path": csv_path }));
    assert_eq!(report["imported"], 0);
    assert_eq!(report["skippedDuplicates"], json!(["Livro Salvo"]));

    let db_path = temp_file("backup.db");
    assert_eq!(h.ok("backup_db", json!({ "path": db_path })), Value::Null);
    h.ok(
        "create_book",
        json!({ "input": {
            "title": "Livro Depois", "author": "A", "subject": "S", "categoryId": romance, "codes": ["D1"]
        } }),
    );
    assert_eq!(h.ok("restore_db", json!({ "path": db_path })), Value::Null);
    let after = h.ok("list_books", json!({ "query": {} }));
    assert_eq!(after["total"], 1);
    assert_eq!(after["items"][0]["title"], "Livro Salvo");

    let missing = h.err("restore_db", json!({ "path": temp_file("nao-existe.db") }));
    assert_eq!(missing["code"], "IO");

    for p in [csv_path, db_path] {
        if let Some(dir) = p.parent() {
            let _ = std::fs::remove_dir_all(dir);
        }
    }
}

/// Pasta temporária vazia e exclusiva do teste.
fn temp_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("libok-cmd-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("pasta temporária");
    dir
}

fn assert_path_error(err: &Value) {
    assert_eq!(err["code"], "VALIDATION", "{err}");
    assert_eq!(err["field"], "path", "{err}");
}

fn assert_live_db_error(err: &Value) {
    assert_path_error(err);
    assert!(
        err["message"]
            .as_str()
            .is_some_and(|m| m.contains("em uso")),
        "{err}"
    );
}

fn add_book(h: &Harness, title: &str, code: &str) {
    let romance = h.category_id("Romance");
    h.ok(
        "create_book",
        json!({ "input": {
            "title": title, "author": "A", "subject": "S", "categoryId": romance, "codes": [code]
        } }),
    );
}

#[test]
fn commands_de_arquivo_validam_a_extensao() {
    let h = Harness::new();
    add_book(&h, "Livro Salvo", "S1");
    let dir = temp_dir("ext");

    let cases = [
        ("export_csv", "acervo.txt"),
        ("export_csv", "acervo.db"),
        ("export_csv", "acervo"),
        ("export_csv", "acervo.csv.exe"),
        ("preview_csv", "acervo.xlsx"),
        ("import_csv", "acervo.db"),
        ("backup_db", "copia.csv"),
        ("backup_db", "copia.db-wal"),
        ("backup_db", "copia.docx"),
        ("restore_db", "copia.txt"),
    ];
    for (cmd, name) in cases {
        let path = dir.join(name);
        assert_path_error(&h.err(cmd, json!({ "path": path })));
        assert!(!path.exists(), "{cmd} não deve criar {name}");
    }

    // arquivo existente com extensão errada: recusado antes de ser lido
    let txt = dir.join("dados.txt");
    std::fs::write(&txt, "Título;Autor;Categoria;Assunto;Códigos\n").expect("escrever");
    for cmd in ["preview_csv", "import_csv"] {
        assert_path_error(&h.err(cmd, json!({ "path": txt })));
    }
    // um arquivo de outro tipo não é sobrescrito
    let doc = dir.join("relatorio.docx");
    std::fs::write(&doc, "conteúdo do usuário").expect("escrever");
    assert_path_error(&h.err("export_csv", json!({ "path": doc })));
    assert_path_error(&h.err("backup_db", json!({ "path": doc })));
    assert_eq!(
        std::fs::read_to_string(&doc).ok().as_deref(),
        Some("conteúdo do usuário")
    );

    // extensão sem diferenciar maiúsculas
    let upper_csv = dir.join("ACERVO.CSV");
    assert_eq!(
        h.ok("export_csv", json!({ "path": upper_csv })),
        json!({ "rows": 1 })
    );
    assert_eq!(
        h.ok("preview_csv", json!({ "path": upper_csv }))["counts"]["duplicate"],
        1
    );
    assert_eq!(
        h.ok("import_csv", json!({ "path": upper_csv }))["imported"],
        0
    );
    let upper_db = dir.join("COPIA.Db");
    assert_eq!(h.ok("backup_db", json!({ "path": upper_db })), Value::Null);
    assert_eq!(h.ok("restore_db", json!({ "path": upper_db })), Value::Null);
    assert_eq!(h.ok("list_books", json!({ "query": {} }))["total"], 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn banco_em_arquivo_recusa_o_proprio_banco_e_restore_guarda_copia() {
    let dir = temp_dir("live");
    let live = dir.join("libok.db");
    let h = Harness::with_conn(db::open(&live).expect("banco em arquivo"));
    add_book(&h, "Livro Salvo", "S1");

    // backup/restore sobre o banco em uso: recusados pelo repositório
    for cmd in ["backup_db", "restore_db"] {
        assert_live_db_error(&h.err(cmd, json!({ "path": live })));
    }
    // mesmo caminho por outro alias
    let alias = dir.join(".").join("libok.db");
    assert_live_db_error(&h.err("backup_db", json!({ "path": alias })));
    assert!(!dir.join("backups").exists(), "recusado antes de copiar");
    assert_eq!(h.ok("list_books", json!({ "query": {} }))["total"], 1);

    // backup → mutação → restore: o banco anterior fica em backups/
    let copy = dir.join("copia.db");
    assert_eq!(h.ok("backup_db", json!({ "path": copy })), Value::Null);
    add_book(&h, "Livro Depois", "D1");
    assert_eq!(h.ok("restore_db", json!({ "path": copy })), Value::Null);
    let after = h.ok("list_books", json!({ "query": {} }));
    assert_eq!(after["total"], 1);
    assert_eq!(after["items"][0]["title"], "Livro Salvo");

    let safety: Vec<String> = std::fs::read_dir(dir.join("backups"))
        .expect("pasta backups")
        .filter_map(Result::ok)
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(safety.len(), 1, "{safety:?}");
    assert!(
        safety[0].starts_with("libok-pre-restore-") && safety[0].ends_with(".db"),
        "{safety:?}"
    );

    drop(h);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn export_csv_recusa_o_banco_em_uso_mesmo_com_extensao_csv() {
    // Defesa em profundidade: a extensão passa, mas o repositório recusa o
    // arquivo vivo antes de truncá-lo.
    let dir = temp_dir("live-csv");
    let live = dir.join("banco.csv");
    let h = Harness::with_conn(db::open(&live).expect("banco em arquivo"));
    add_book(&h, "Intacto", "I1");

    assert_live_db_error(&h.err("export_csv", json!({ "path": live })));
    assert_eq!(h.ok("list_books", json!({ "query": {} }))["total"], 1);

    drop(h);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn hoje_e_a_data_local() {
    assert_eq!(super::today(), chrono::Local::now().date_naive());
}
