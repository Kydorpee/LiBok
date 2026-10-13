import type { RouteObject } from "react-router";
import BooksPage from "../pages/BooksPage";
import ClassDetailPage from "../pages/ClassDetailPage";
import ClassesPage from "../pages/ClassesPage";
import DashboardPage from "../pages/DashboardPage";
import EditBookPage from "../pages/EditBookPage";
import ImportExportPage from "../pages/ImportExportPage";
import LoansPage from "../pages/LoansPage";
import NewBookPage from "../pages/NewBookPage";
import { Placeholder } from "../pages/Placeholder";
import ReaderSummaryPage from "../pages/ReaderSummaryPage";
import ReadersPage from "../pages/ReadersPage";
import SettingsPage from "../pages/SettingsPage";
import StudentFormPage from "../pages/StudentFormPage";
import TeacherFormPage from "../pages/TeacherFormPage";
import { AppLayout } from "./AppLayout";

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "acervo", element: <BooksPage /> },
      { path: "acervo/:id/editar", element: <EditBookPage /> },
      { path: "cadastrar", element: <NewBookPage /> },
      { path: "importar-exportar", element: <ImportExportPage /> },
      { path: "configuracoes", element: <SettingsPage /> },
      { path: "turmas", element: <ClassesPage /> },
      { path: "turmas/:id", element: <ClassDetailPage /> },
      { path: "leitores", element: <ReadersPage /> }, // abas via ?aba=alunos|professores
      { path: "leitores/alunos/novo", element: <StudentFormPage /> },
      { path: "leitores/alunos/:id/editar", element: <StudentFormPage /> },
      { path: "leitores/professores/novo", element: <TeacherFormPage /> },
      { path: "leitores/professores/:id/editar", element: <TeacherFormPage /> },
      { path: "leitores/:kind/:id", element: <ReaderSummaryPage /> }, // kind: aluno | professor
      { path: "emprestimos", element: <LoansPage /> },
      { path: "*", element: <Placeholder title="Página não encontrada" /> },
    ],
  },
];
