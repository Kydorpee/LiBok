import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, Checkbox, Modal, Pagination, TabPanel, Tabs, ThemeToggle, ToastProvider, useToast } from ".";

afterEach(cleanup);

describe("Button", () => {
  it("não dispara onClick quando desabilitado", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Salvar
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("em loading fica desabilitado e aria-busy", () => {
    render(<Button loading>Salvando…</Button>);
    const btn = screen.getByRole("button", { name: /Salvando/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });
});

describe("Checkbox", () => {
  it("alterna ao clicar no rótulo", async () => {
    render(<Checkbox label="Marcar como lido" description="Conta nos livros lidos" />);
    const box = screen.getByRole("checkbox", { name: "Marcar como lido" });
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText("Marcar como lido"));
    expect(box).toBeChecked();
  });
});

describe("Tabs", () => {
  function Demo() {
    const [v, setV] = useState("a");
    return (
      <>
        <Tabs
          aria-label="Situação"
          value={v}
          onChange={setV}
          items={[
            { value: "a", label: "Ativos", count: 2 },
            { value: "b", label: "Devolvidos" },
          ]}
        />
        <TabPanel value="a" active={v}>
          Painel A
        </TabPanel>
        <TabPanel value="b" active={v}>
          Painel B
        </TabPanel>
      </>
    );
  }

  it("troca de aba por clique e setas", async () => {
    render(<Demo />);
    expect(screen.getByRole("tab", { name: /Ativos/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Painel A");
    await userEvent.click(screen.getByRole("tab", { name: "Devolvidos" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Painel B");
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /Ativos/ })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Modal", () => {
  function Demo({ onClose }: { onClose: () => void }) {
    return (
      <>
        <button>Fora</button>
        <Modal
          open
          onClose={onClose}
          title="Nova turma"
          footer={<button>Salvar</button>}
        >
          <input aria-label="Nome" />
        </Modal>
      </>
    );
  }

  it("tem role dialog, nome acessível e foco inicial dentro", () => {
    render(<Demo onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Nova turma" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("fecha com Esc", async () => {
    const onClose = vi.fn();
    render(<Demo onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("prende o foco ao tabular", async () => {
    render(<Demo onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});

describe("Modal empilhado", () => {
  function Stack({ onCloseA, onCloseB }: { onCloseA: () => void; onCloseB: () => void }) {
    return (
      <>
        <Modal open onClose={onCloseA} title="Primeiro">
          <input aria-label="Campo A" />
        </Modal>
        <Modal open onClose={onCloseB} title="Segundo">
          <input aria-label="Campo B" />
        </Modal>
      </>
    );
  }

  it("só o modal do topo reage ao Esc e o foco inicial vai ao primeiro campo", async () => {
    const a = vi.fn();
    const b = vi.fn();
    render(<Stack onCloseA={a} onCloseB={b} />);
    expect(screen.getByLabelText("Campo B")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it("devolve o foco ao elemento que abriu o modal", async () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Teste">
            <input aria-label="Campo" />
          </Modal>
        </>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(opener);
    expect(screen.getByLabelText("Campo")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(opener).toHaveFocus();
  });
});

describe("ThemeToggle", () => {
  it("usa roving tabindex e setas", async () => {
    const onChange = vi.fn();
    render(<ThemeToggle value="light" onChange={onChange} />);
    const light = screen.getByRole("radio", { name: "Claro" });
    expect(light).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Escuro" })).toHaveAttribute("tabindex", "-1");
    light.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("dark");
  });
});

describe("Pagination", () => {
  it("não mostra 'Página 1 de 0'", () => {
    render(<Pagination page={1} pageCount={0} onPageChange={() => {}} />);
    expect(screen.queryByText(/Página 1 de 0/)).not.toBeInTheDocument();
  });
});

describe("Toast", () => {
  afterEach(() => vi.useRealTimers());

  function Trigger() {
    const t = useToast();
    return <button onClick={() => t.success("Livro salvo", "Cadastro concluído")}>Disparar</button>;
  }

  it("mostra, fecha manualmente e some sozinho", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByText("Disparar"));
    expect(screen.getByText("Livro salvo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fechar notificação" }));
    expect(screen.queryByText("Livro salvo")).not.toBeInTheDocument();

    vi.useFakeTimers();
    await act(async () => {
      screen.getByText("Disparar").click();
    });
    expect(screen.getByText("Livro salvo")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByText("Livro salvo")).not.toBeInTheDocument();
  });

  it("região live sempre renderizada; erro é assertivo; hover pausa o timer", async () => {
    function Both() {
      const t = useToast();
      return (
        <>
          <button onClick={() => t.success("Salvo")}>ok</button>
          <button onClick={() => t.error("Falhou")}>erro</button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Both />
      </ToastProvider>,
    );
    const region = screen.getByRole("region", { name: "Notificações" });
    expect(region).toHaveAttribute("aria-live", "polite");

    vi.useFakeTimers();
    await act(async () => {
      screen.getByText("ok").click();
      screen.getByText("erro").click();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
    const saved = screen.getByText("Salvo");
    await act(async () => {
      fireEvent.mouseEnter(saved.closest("div")!.parentElement!);
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Salvo")).toBeInTheDocument();
    await act(async () => {
      fireEvent.mouseLeave(saved.closest("div")!.parentElement!);
    });
    await act(async () => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByText("Salvo")).not.toBeInTheDocument();
  });
});
