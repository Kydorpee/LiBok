import { CircleAlert, CircleCheck, CopyX, Download, EyeOff, FileSpreadsheet, Pencil, Undo2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { paths } from "../app/paths";
import {
  Button,
  buttonStyles,
  Card,
  CardHeader,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  useToast,
} from "../components/ui";
import { toAppError } from "../lib/api";
import { pickFileToOpen, pickPathToSave } from "../lib/files";
import type { CsvPreviewRow, ImportReport, ImportRow } from "../lib/types";
import { FixRowModal } from "../features/importExport/FixRowModal";
import {
  useExportCsv,
  useImportRows,
  usePreviewCsv,
  useValidateImportRows,
} from "../features/importExport/hooks";
import { Page } from "../features/shared/Page";

const PREVIEW_LIMIT = 100;

const STATUS: Record<CsvPreviewRow["status"], { label: string; className: string }> = {
  ready: { label: "Pronta", className: "text-text-success" },
  duplicate: { label: "Duplicada", className: "text-text-warning" },
  error: { label: "Com erro", className: "text-text-danger" },
};

function RowStatus({ status }: { status: CsvPreviewRow["status"] }) {
  const Icon = status === "ready" ? CircleCheck : status === "duplicate" ? CopyX : CircleAlert;
  return (
    <span className={`inline-flex items-center gap-1 text-body-strong ${STATUS[status].className}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {STATUS[status].label}
    </span>
  );
}

const toImportRow = (r: CsvPreviewRow): ImportRow => ({
  line: r.line,
  title: r.title,
  author: r.author,
  subject: r.subject,
  categoryName: r.categoryName,
  codes: r.codes,
});

export default function ImportExportPage() {
  const toast = useToast();
  const exportCsv = useExportCsv();
  const preview = usePreviewCsv();
  const validate = useValidateImportRows();
  const importRows = useImportRows();
  const [path, setPath] = useState<string | null>(null);
  // Linhas da prévia: fonte da verdade (já com as correções do usuário).
  const [rows, setRows] = useState<CsvPreviewRow[] | null>(null);
  const [ignored, setIgnored] = useState<Set<number>>(new Set());
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [fixing, setFixing] = useState<number | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const active = useMemo(() => (rows ?? []).filter((r) => !ignored.has(r.line)), [rows, ignored]);
  const counts = useMemo(
    () => ({
      ready: active.filter((r) => r.status === "ready").length,
      duplicate: active.filter((r) => r.status === "duplicate").length,
      error: active.filter((r) => r.status === "error").length,
    }),
    [active],
  );
  const problems = counts.duplicate + counts.error;
  const filtered = useMemo(
    () => (onlyProblems ? (rows ?? []).filter((r) => ignored.has(r.line) || r.status !== "ready") : (rows ?? [])),
    [rows, ignored, onlyProblems],
  );
  const fixingRow = fixing === null ? null : (rows?.find((r) => r.line === fixing) ?? null);

  async function doExport() {
    try {
      const target = await pickPathToSave("acervo-libok.csv", "csv", "Planilha CSV");
      if (!target) return;
      const r = await exportCsv.mutateAsync(target);
      toast.success("Acervo exportado", `${r.rows} ${r.rows === 1 ? "linha gravada" : "linhas gravadas"} em ${target}.`);
    } catch (e) {
      toast.error("Não foi possível exportar", toAppError(e).message);
    }
  }

  async function choose() {
    try {
      const file = await pickFileToOpen("csv", "Planilha CSV");
      if (!file) return;
      const p = await preview.mutateAsync(file);
      setPath(file);
      setRows(p.rows);
      setIgnored(new Set());
      setOnlyProblems(false);
      setFixing(null);
      setReport(null);
    } catch (e) {
      toast.error("Não foi possível ler o arquivo", toAppError(e).message);
    }
  }

  /** Revalida todas as linhas não ignoradas e troca o resultado na prévia. */
  async function revalidate(current: CsvPreviewRow[], nextIgnored: Set<number>, edited?: ImportRow) {
    const send = current
      .filter((r) => !nextIgnored.has(r.line))
      .map((r) => (edited && r.line === edited.line ? edited : toImportRow(r)));
    const result = await validate.mutateAsync(send);
    const byLine = new Map(result.rows.map((r) => [r.line, r]));
    const next = current.map((r) => byLine.get(r.line) ?? r);
    setRows(next);
    setIgnored(nextIgnored);
    return next.find((r) => edited && r.line === edited.line);
  }

  async function saveFix(edited: ImportRow) {
    if (!rows) return;
    try {
      const updated = await revalidate(rows, ignored, edited);
      if (updated?.status === "ready") {
        setFixing(null);
        toast.success("Linha corrigida", `Linha ${edited.line} pronta para importar.`);
      }
    } catch (e) {
      toast.error("Não foi possível validar a linha", toAppError(e).message);
    }
  }

  async function setLineIgnored(line: number, value: boolean) {
    if (!rows) return;
    const next = new Set(ignored);
    if (value) next.add(line);
    else next.delete(line);
    try {
      await revalidate(rows, next);
      if (value) setFixing(null);
    } catch (e) {
      toast.error("Não foi possível atualizar a prévia", toAppError(e).message);
    }
  }

  async function doImport() {
    try {
      // Só as linhas "prontas" vão ao backend; duplicadas/com erro entram no relatório localmente.
      const sent = await importRows.mutateAsync(active.filter((x) => x.status === "ready").map(toImportRow));
      const r: ImportReport = {
        imported: sent.imported,
        skippedDuplicates: [
          ...sent.skippedDuplicates,
          ...active.filter((x) => x.status === "duplicate").map((x) => x.title),
        ],
        errors: [
          ...sent.errors,
          ...active
            .filter((x) => x.status === "error")
            .map((x) => ({ line: x.line, message: x.message ?? "Linha inválida." })),
        ],
      };
      setReport(r);
      setRows(null);
      toast.success("Importação concluída", `${r.imported} ${r.imported === 1 ? "livro importado" : "livros importados"}.`);
    } catch (e) {
      toast.error("Não foi possível importar", toAppError(e).message);
    }
  }

  function restart() {
    setPath(null);
    setRows(null);
    setIgnored(new Set());
    setFixing(null);
    setReport(null);
  }

  const shown = filtered.slice(0, PREVIEW_LIMIT);

  return (
    <Page title="Importar / Exportar" subtitle="Troque dados com o Excel usando arquivos CSV (UTF-8, separador ;)">
      <Card>
        <CardHeader
          title="Exportar acervo"
          description="Gera um CSV com todos os livros e códigos de registro, compatível com o Excel."
          actions={
            <Button icon={<Download />} onClick={doExport} loading={exportCsv.isPending}>
              Exportar CSV
            </Button>
          }
        />
      </Card>

      <Card>
        <CardHeader
          title="Importar livros"
          description="Escolha um CSV no mesmo formato da exportação. Você confere e corrige a prévia antes de importar."
          actions={
            <Button
              variant={rows || report ? "secondary" : "primary"}
              icon={<Upload />}
              onClick={choose}
              loading={preview.isPending}
            >
              {rows || report ? "Escolher outro arquivo" : "Escolher arquivo"}
            </Button>
          }
        />

        {rows ? (
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-caption text-text-muted">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              {path}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" className="text-body">
                {counts.ready} prontas · {counts.duplicate} duplicadas · {counts.error} com erro
                {ignored.size ? ` · ${ignored.size} ignoradas` : ""}. Categorias novas são criadas automaticamente.
              </p>
              <Button
                variant={onlyProblems ? "primary" : "secondary"}
                size="sm"
                aria-pressed={onlyProblems}
                onClick={() => setOnlyProblems((v) => !v)}
              >
                Só com problemas ({problems})
              </Button>
            </div>
            <div className="overflow-hidden rounded-md border border-border-default">
              <Table caption="Prévia da importação">
                <TableHead>
                  <TableRow className="h-10 hover:bg-transparent">
                    <TableHeaderCell>Linha</TableHeaderCell>
                    <TableHeaderCell>Título</TableHeaderCell>
                    <TableHeaderCell>Autor</TableHeaderCell>
                    <TableHeaderCell>Categoria</TableHeaderCell>
                    <TableHeaderCell>Exemplares</TableHeaderCell>
                    <TableHeaderCell>Situação</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.map((r) => {
                    const isIgnored = ignored.has(r.line);
                    const fixable = !isIgnored && r.status !== "ready";
                    return (
                      <TableRow
                        key={r.line}
                        className={fixable ? "cursor-pointer" : isIgnored ? "opacity-60" : undefined}
                        onClick={fixable ? () => setFixing(r.line) : undefined}
                      >
                        <TableCell>{r.line}</TableCell>
                        <TableCell>{r.title}</TableCell>
                        <TableCell>{r.author}</TableCell>
                        <TableCell>{r.categoryName}</TableCell>
                        <TableCell>{r.codes.length}</TableCell>
                        <TableCell>
                          {isIgnored ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-body-strong text-text-muted">
                                <EyeOff className="h-4 w-4" aria-hidden="true" />
                                Ignorada
                              </span>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Undo2 />}
                                aria-label={`Desfazer ignorar linha ${r.line}`}
                                onClick={() => void setLineIgnored(r.line, false)}
                              >
                                Desfazer
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <RowStatus status={r.status} />
                                {r.message ? <p className="text-caption text-text-muted">{r.message}</p> : null}
                              </div>
                              {fixable ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={<Pencil />}
                                  aria-label={`Corrigir linha ${r.line}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFixing(r.line);
                                  }}
                                >
                                  Corrigir
                                </Button>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {filtered.length > PREVIEW_LIMIT ? (
              <p className="text-caption text-text-muted">
                Mostrando {PREVIEW_LIMIT} de {filtered.length} linhas
                {onlyProblems ? " com problemas" : ""}. A importação considera todas as linhas.
              </p>
            ) : null}
            {onlyProblems && filtered.length === 0 ? (
              <p className="text-caption text-text-muted">Nenhuma linha com problemas.</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={restart}>
                Cancelar
              </Button>
              <Button onClick={doImport} loading={importRows.isPending} disabled={counts.ready === 0}>
                Importar {counts.ready} {counts.ready === 1 ? "livro" : "livros"}
              </Button>
            </div>
          </div>
        ) : null}

        {report ? (
          <div className="flex flex-col gap-4" aria-label="Relatório da importação" role="region">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Importados" value={report.imported} icon={<CircleCheck />} />
              <StatCard label="Ignorados (duplicados)" value={report.skippedDuplicates.length} icon={<CopyX />} />
              <StatCard label="Com erro" value={report.errors.length} icon={<CircleAlert />} />
            </div>
            {report.skippedDuplicates.length ? (
              <div>
                <h3 className="text-body-strong">Ignorados por duplicidade</h3>
                <ul className="list-disc pl-6 text-body text-text-muted">
                  {report.skippedDuplicates.map((t, i) => (
                    <li key={`${i}-${t}`}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {report.errors.length ? (
              <div>
                <h3 className="text-body-strong">Erros</h3>
                <ul className="list-disc pl-6 text-body text-text-muted">
                  {report.errors.map((e) => (
                    <li key={`${e.line}-${e.message}`}>
                      Linha {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={restart}>
                Nova importação
              </Button>
              <Link to={paths.books} className={buttonStyles({})}>
                Ver acervo
              </Link>
            </div>
          </div>
        ) : null}
      </Card>

      <FixRowModal
        row={fixingRow}
        saving={validate.isPending}
        onSave={saveFix}
        onIgnore={(line) => void setLineIgnored(line, true)}
        onClose={() => setFixing(null)}
      />
    </Page>
  );
}
