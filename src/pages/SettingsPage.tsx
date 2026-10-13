import { Database, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  ThemeToggle,
  useTheme,
  useToast,
} from "../components/ui";
import { toAppError } from "../lib/api";
import { toISODate } from "../lib/dates";
import { pickFileToOpen, pickPathToSave } from "../lib/files";
import type { Category } from "../lib/types";
import { useBackupDb, useRestoreDb } from "../features/backup/hooks";
import { useCategories, useCreateCategory, useUpdateCategory } from "../features/categories/hooks";
import { Page, PageError } from "../features/shared/Page";

const DEFAULT_COLOR = "#4F6D7A";

function CategoryRow({ category }: { category: Category }) {
  const toast = useToast();
  const update = useUpdateCategory();
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [error, setError] = useState<string>();
  const dirty = name !== category.name || color.toLowerCase() !== category.color.toLowerCase();

  async function save() {
    try {
      await update.mutateAsync({ id: category.id, name, color });
      setError(undefined);
      toast.success("Categoria atualizada", name);
    } catch (e) {
      const err = toAppError(e);
      setError(err.message);
      toast.error("Não foi possível salvar a categoria", err.message);
    }
  }

  return (
    <TableRow>
      <TableCell className="w-20">
        <input
          type="color"
          aria-label={`Cor da categoria ${category.name}`}
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded-sm border border-border-strong bg-bg-surface p-0.5"
        />
      </TableCell>
      <TableCell>
        <Input
          aria-label={`Nome da categoria ${category.name}`}
          value={name}
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && dirty) void save();
          }}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {category.bookCount} {category.bookCount === 1 ? "livro" : "livros"}
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="secondary" icon={<Save />} disabled={!dirty} loading={update.isPending} onClick={save}>
          Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const backup = useBackupDb();
  const restore = useRestoreDb();
  const categories = useCategories();
  const create = useCreateCategory();
  const [restorePath, setRestorePath] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [newError, setNewError] = useState<string>();

  async function doBackup() {
    try {
      const stamp = toISODate(new Date());
      const target = await pickPathToSave(`libok-backup-${stamp}.db`, "db", "Banco de dados LiBok");
      if (!target) return;
      await backup.mutateAsync(target);
      toast.success("Backup criado", target);
    } catch (e) {
      toast.error("Não foi possível criar o backup", toAppError(e).message);
    }
  }

  async function chooseRestore() {
    try {
      const file = await pickFileToOpen("db", "Banco de dados LiBok");
      if (file) setRestorePath(file);
    } catch (e) {
      toast.error("Não foi possível abrir o arquivo", toAppError(e).message);
    }
  }

  async function doRestore() {
    if (!restorePath) return;
    try {
      await restore.mutateAsync(restorePath);
      toast.success("Backup restaurado", "Os dados foram recarregados.");
    } catch (e) {
      toast.error("Não foi possível restaurar", toAppError(e).message);
    }
    setRestorePath(null);
  }

  async function addCategory() {
    if (!newName.trim()) {
      setNewError("Informe o nome da categoria.");
      return;
    }
    try {
      const c = await create.mutateAsync({ name: newName, color: newColor });
      toast.success("Categoria criada", c.name);
      setNewName("");
      setNewError(undefined);
    } catch (e) {
      const err = toAppError(e);
      setNewError(err.message);
    }
  }

  return (
    <Page title="Configurações" subtitle="Aparência, backup e categorias">
      <Card>
        <CardHeader title="Tema" description="Escolha como o LiBok deve aparecer." />
        <ThemeToggle value={theme} onChange={setTheme} showLabels />
      </Card>

      <Card>
        <CardHeader
          title="Backup e restauração"
          description="Salve uma cópia do banco de dados (arquivo .db) ou restaure uma cópia anterior. Restaurar substitui o acervo atual, mas guarda antes uma cópia automática."
        />
        <div className="flex flex-wrap gap-2">
          <Button icon={<Database />} onClick={doBackup} loading={backup.isPending}>
            Fazer backup
          </Button>
          <Button variant="secondary" icon={<RotateCcw />} onClick={chooseRestore} loading={restore.isPending}>
            Restaurar backup
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Categorias" description="Renomeie categorias e escolha a cor usada no gráfico e nos selos." />
        <form
          className="mb-4 flex flex-wrap items-start gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void addCategory();
          }}
        >
          <Input
            wrapperClassName="min-w-64 flex-1"
            label="Nova categoria"
            value={newName}
            error={newError}
            onChange={(e) => {
              setNewName(e.target.value);
              setNewError(undefined);
            }}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-category-color" className="text-label">
              Cor
            </label>
            <input
              id="new-category-color"
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-control w-14 cursor-pointer rounded-sm border border-border-strong bg-bg-surface p-1"
            />
          </div>
          <Button type="submit" className="mt-[26px]" loading={create.isPending}>
            Adicionar
          </Button>
        </form>

        {categories.isError && !categories.data ? (
          <PageError error={categories.error} onRetry={() => void categories.refetch()} />
        ) : categories.isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="overflow-hidden rounded-md border border-border-default">
            <Table caption="Categorias">
              <TableHead>
                <TableRow className="h-10 hover:bg-transparent">
                  <TableHeaderCell>Cor</TableHeaderCell>
                  <TableHeaderCell>Nome</TableHeaderCell>
                  <TableHeaderCell>Livros</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ação</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.data?.map((c) => (
                  <CategoryRow key={`${c.id}-${c.name}-${c.color}`} category={c} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!restorePath}
        title="Restaurar backup"
        message={`O acervo atual (livros, leitores e empréstimos) será substituído pelo conteúdo de "${restorePath}". Antes disso, o LiBok guarda uma cópia automática dos dados atuais na pasta "backups" dos dados do aplicativo.`}
        confirmLabel="Restaurar"
        loading={restore.isPending}
        onConfirm={doRestore}
        onCancel={() => setRestorePath(null)}
      />
    </Page>
  );
}
