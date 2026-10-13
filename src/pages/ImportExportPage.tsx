import { CircleAlert, CircleCheck, CopyX, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
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
import type { CsvPreview, CsvPreviewRow, ImportReport } from "../lib/types";
import { useExportCsv, useImportCsv, usePreviewCsv } from "../features/importExport/hooks";
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

export default function ImportExportPage() {
  const toast = useToast();
  const exportCsv = useExportCsv();
  const preview = usePreviewCsv();
  const importCsv = useImportCsv();
  const [path, setPath] = useState<string | null>(null);
  const [data, setData] = useState<CsvPreview | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

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
      setData(p);
      setReport(null);
    } catch (e) {
      toast.error("Não foi possível ler o arquivo", toAppError(e).message);
    }
  }

  async function doImport() {
    if (!path) return;
    try {
      const r = await importCsv.mutateAsync(path);
      setReport(r);
      setData(null);
      toast.success("Importação concluída", `${r.imported} ${r.imported === 1 ? "livro importado" : "livros importados"}.`);
    } catch (e) {
      toast.error("Não foi possível importar", toAppError(e).message);
    }
  }

  function restart() {
    setPath(null);
    setData(null);
    setReport(null);
  }

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
          description="Escolha um CSV no mesmo formato da exportação. Você confere uma prévia antes de importar."
          actions={
            <Button
              variant={data || report ? "secondary" : "primary"}
              icon={<Upload />}
              onClick={choose}
              loading={preview.isPending}
            >
              {data || report ? "Escolher outro arquivo" : "Escolher arquivo"}
            </Button>
          }
        />

        {data ? (
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-caption text-text-muted">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              {path}
            </p>
            <p role="status" className="text-body">
              {data.counts.ready} prontas · {data.counts.duplicate} duplicadas · {data.counts.error} com erro.
              Categorias novas são criadas automaticamente.
            </p>
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
                  {data.rows.slice(0, PREVIEW_LIMIT).map((r) => (
                    <TableRow key={r.line}>
                      <TableCell>{r.line}</TableCell>
                      <TableCell>{r.title}</TableCell>
                      <TableCell>{r.author}</TableCell>
                      <TableCell>{r.categoryName}</TableCell>
                      <TableCell>{r.codes.length}</TableCell>
                      <TableCell>
                        <RowStatus status={r.status} />
                        {r.message ? <p className="text-caption text-text-muted">{r.message}</p> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data.rows.length > PREVIEW_LIMIT ? (
              <p className="text-caption text-text-muted">
                Mostrando {PREVIEW_LIMIT} de {data.rows.length} linhas. A importação considera todas as linhas.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={restart}>
                Cancelar
              </Button>
              <Button onClick={doImport} loading={importCsv.isPending} disabled={data.counts.ready === 0}>
                Importar {data.counts.ready} {data.counts.ready === 1 ? "livro" : "livros"}
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
    </Page>
  );
}
