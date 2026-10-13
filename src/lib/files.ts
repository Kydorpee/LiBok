import { open, save } from "@tauri-apps/plugin-dialog";
import { isMockMode } from "./api";

// No navegador (mock) os diálogos nativos não existem: devolvemos um caminho simulado.

export async function pickFileToOpen(extension: string, label: string): Promise<string | null> {
  if (isMockMode()) return `arquivo-simulado.${extension}`;
  const r = await open({ multiple: false, directory: false, filters: [{ name: label, extensions: [extension] }] });
  return typeof r === "string" ? r : null;
}

export async function pickPathToSave(
  defaultPath: string,
  extension: string,
  label: string,
): Promise<string | null> {
  if (isMockMode()) return defaultPath;
  return save({ defaultPath, filters: [{ name: label, extensions: [extension] }] });
}
