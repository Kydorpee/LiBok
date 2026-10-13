import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { renderApp } from "../test/renderApp";

async function openPreview() {
  const ctx = renderApp("/importar-exportar");
  await ctx.user.click(await screen.findByRole("button", { name: "Escolher arquivo" }));
  await screen.findByText("Poemas Escolhidos");
  return ctx;
}

// Mock: linha 2 e 3 prontas, 4 duplicada (Dom Casmurro), 5 com erro (autor vazio).
describe("fluxo: corrigir linhas na prévia", () => {
  it("abre o modal com foco no campo do erro, corrige e importa", async () => {
    const spy = vi.spyOn(api, "importRows");
    const { user } = await openPreview();
    expect(screen.getByRole("status")).toHaveTextContent("2 prontas · 1 duplicadas · 1 com erro");

    await user.click(screen.getByRole("button", { name: "Corrigir linha 5" }));
    const dialog = await screen.findByRole("dialog", { name: "Corrigir linha 5" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Autor não informado.");
    await waitFor(() => expect(within(dialog).getByLabelText("Autor")).toHaveFocus());
    expect(within(dialog).getByLabelText("Autor")).toHaveAttribute("aria-invalid", "true");

    await user.type(within(dialog).getByLabelText("Autor"), "Graciliano Ramos");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("3 prontas · 1 duplicadas · 0 com erro");

    await user.click(screen.getByRole("button", { name: "Importar 3 livros" }));
    const report = await screen.findByRole("region", { name: "Relatório da importação" });
    expect(within(report).getByText("Dom Casmurro")).toBeInTheDocument();
    const sent = spy.mock.calls[0][0];
    expect(sent.map((r) => r.line)).toEqual([2, 3, 5]);
    expect(sent[2].author).toBe("Graciliano Ramos");
    spy.mockRestore();
  });

  it("duplicidade entre linhas aparece e some ao corrigir o título", async () => {
    const { user } = await openPreview();
    await user.click(screen.getByRole("button", { name: "Corrigir linha 5" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Autor"), "X");
    await user.clear(within(dialog).getByLabelText("Título"));
    await user.type(within(dialog).getByLabelText("Título"), "a hora da estrela");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Título repetido em outra linha");
    await waitFor(() => expect(within(dialog).getByLabelText("Título")).toHaveFocus());

    await user.clear(within(dialog).getByLabelText("Título"));
    await user.type(within(dialog).getByLabelText("Título"), "Vidas Secas");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("3 prontas");
  });

  it("ignorar linha não envia e permite desfazer", async () => {
    const spy = vi.spyOn(api, "importRows");
    const { user } = await openPreview();
    await user.click(screen.getByRole("button", { name: "Corrigir linha 5" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ignorar esta linha" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Ignorada")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 prontas · 1 duplicadas · 0 com erro");

    await user.click(screen.getByRole("button", { name: "Importar 2 livros" }));
    await screen.findByRole("region", { name: "Relatório da importação" });
    expect(spy.mock.calls[0][0].map((r) => r.line)).toEqual([2, 3]);
    spy.mockRestore();
  });

  it("desfazer ignorar devolve a linha", async () => {
    const { user } = await openPreview();
    await user.click(screen.getByRole("button", { name: "Corrigir linha 5" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ignorar esta linha" }));
    await user.click(await screen.findByRole("button", { name: "Desfazer ignorar linha 5" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 com erro"));
  });

  it("filtro 'Só com problemas'", async () => {
    const { user } = await openPreview();
    const toggle = screen.getByRole("button", { name: "Só com problemas (2)" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Poemas Escolhidos")).not.toBeInTheDocument();
    expect(screen.getByText("Vidas Secas")).toBeInTheDocument();
    expect(screen.getByText("Dom Casmurro")).toBeInTheDocument();
  });
});
