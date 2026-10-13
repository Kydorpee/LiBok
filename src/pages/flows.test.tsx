import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { api, resetMock } from "../lib/api";
import { renderApp } from "../test/renderApp";

describe("fluxo: cadastrar livro", () => {
  it("valida, adiciona exemplares com Enter, salva e limpa o formulário", async () => {
    const { user } = renderApp("/cadastrar");
    await screen.findByRole("heading", { name: "Cadastrar livro" });

    // envio vazio mostra o resumo de erros
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    const summary = await screen.findByText("Corrija os campos abaixo para continuar");
    expect(summary).toBeInTheDocument();
    expect(screen.getAllByText("Informe o título.").length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("Título *"), "Livro de Teste");
    await user.type(screen.getByLabelText("Autor *"), "Autora Teste");
    await user.type(screen.getByLabelText("Assunto *"), "Testes");
    await screen.findByRole("option", { name: "Tecnologia" });
    await user.selectOptions(screen.getByLabelText("Categoria *"), "Tecnologia");
    await user.type(screen.getByLabelText("Código do exemplar 1"), "TST-1{Enter}");
    // Enter adiciona uma segunda linha já focada
    const second = await screen.findByLabelText("Código do exemplar 2");
    expect(second).toHaveFocus();
    await user.type(second, "TST-2");
    expect(screen.getByText("2 exemplares")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Livro cadastrado")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Título *")).toHaveValue(""));
    expect(screen.queryByLabelText("Código do exemplar 2")).not.toBeInTheDocument();

    const page = await api.listBooks({ text: "TST-2" });
    expect(page.items[0]).toMatchObject({ title: "Livro de Teste", quantity: 2 });
  });

  it("mostra o erro de título duplicado no campo", async () => {
    const { user } = renderApp("/cadastrar");
    await screen.findByRole("option", { name: "Tecnologia" });
    await user.type(screen.getByLabelText("Título *"), "o pequeno principe");
    await user.type(screen.getByLabelText("Autor *"), "X");
    await user.type(screen.getByLabelText("Assunto *"), "Y");
    await user.selectOptions(screen.getByLabelText("Categoria *"), "Infantil");
    await user.type(screen.getByLabelText("Código do exemplar 1"), "DUP-1");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getByLabelText("Título *")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getAllByText("Já existe um livro com este título.").length).toBeGreaterThan(0);
  });

  it("marca o código repetido no campo certo (codes.N)", async () => {
    const { user } = renderApp("/cadastrar");
    await screen.findByRole("option", { name: "Tecnologia" });
    await user.type(screen.getByLabelText("Título *"), "Outro Livro");
    await user.type(screen.getByLabelText("Autor *"), "X");
    await user.type(screen.getByLabelText("Assunto *"), "Y");
    await user.selectOptions(screen.getByLabelText("Categoria *"), "Infantil");
    await user.type(screen.getByLabelText("Código do exemplar 1"), "NOVO-9{Enter}");
    await user.type(await screen.findByLabelText("Código do exemplar 2"), "REG-0001");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getByLabelText("Código do exemplar 2")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Código do exemplar 1")).not.toHaveAttribute("aria-invalid", "true");
  });
});

describe("fluxo: acervo", () => {
  it("busca com debounce, sem acento", async () => {
    const { user } = renderApp("/acervo");
    expect(await screen.findByText("O Hobbit")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "memorias postumas");
    await waitFor(() => expect(screen.queryByText("O Hobbit")).not.toBeInTheDocument());
    expect(screen.getByText("Memórias Póstumas de Brás Cubas")).toBeInTheDocument();
  });

  it("mostra estado vazio com ação de limpar filtros", async () => {
    const { user } = renderApp("/acervo");
    await screen.findByText("O Hobbit");
    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "zzzz");
    expect(await screen.findByText("Nenhum livro encontrado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(await screen.findByText("O Hobbit")).toBeInTheDocument();
  });

  it("exclui com confirmação e trata HAS_ACTIVE_LOANS", async () => {
    const { user } = renderApp("/acervo");
    await screen.findByText("O Hobbit");
    // O Hobbit tem exemplar emprestado -> bloqueado
    await user.click(screen.getByRole("button", { name: "Excluir O Hobbit" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir livro" });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Não foi possível excluir")).toBeInTheDocument();
    expect(screen.getByText("O Hobbit")).toBeInTheDocument();
  });
});

describe("fluxo: emprestar", () => {
  it("empresta um exemplar do Acervo para um aluno", async () => {
    const { user } = renderApp("/acervo");
    await screen.findByText("O Pequeno Príncipe");
    await user.click(screen.getByRole("button", { name: "Emprestar O Pequeno Príncipe" }));

    const dialog = await screen.findByRole("dialog", { name: "Emprestar exemplar" });
    // REG-0001 está emprestado (desabilitado); o primeiro disponível vem marcado
    expect(await within(dialog).findByRole("radio", { name: /REG-0001/ })).toBeDisabled();
    expect(await within(dialog).findByRole("button", { name: "Emprestar REG-0002" })).toBeInTheDocument();

    await user.type(within(dialog).getByRole("searchbox", { name: "Leitor" }), "bruno");
    await user.click(await within(dialog).findByRole("button", { name: /Bruno Henrique Costa/ }));
    await user.click(within(dialog).getByRole("button", { name: "Emprestar REG-0002" }));

    expect(await screen.findByText("Empréstimo registrado")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // disponibilidade atualizada: 3 exemplares, 2 emprestados
    expect(await screen.findByText("1 de 3")).toBeInTheDocument();
  });

  it("pede o leitor quando não foi escolhido", async () => {
    const { user } = renderApp("/acervo");
    await screen.findByText("O Pequeno Príncipe");
    await user.click(screen.getByRole("button", { name: "Emprestar O Pequeno Príncipe" }));
    const dialog = await screen.findByRole("dialog", { name: "Emprestar exemplar" });
    await user.click(await within(dialog).findByRole("button", { name: "Emprestar REG-0002" }));
    expect(await within(dialog).findByText("Selecione o leitor.")).toBeInTheDocument();
  });

  it("empresta a partir do resumo do leitor com o leitor pré-escolhido", async () => {
    resetMock(); // ids do mock são determinísticos
    const students = await api.listStudents({ text: "heitor" });
    const { user } = renderApp(`/leitores/aluno/${students.items[0].id}`);
    await screen.findByRole("heading", { name: "Heitor Pereira" });
    await user.click(screen.getByRole("button", { name: "Novo empréstimo" }));
    const dialog = await screen.findByRole("dialog", { name: "Emprestar exemplar" });
    expect(within(dialog).getByText("Heitor Pereira")).toBeInTheDocument();
    await user.type(within(dialog).getByRole("searchbox", { name: "Livro" }), "atlas");
    await user.click(await within(dialog).findByRole("button", { name: /Atlas Geográfico Escolar/ }));
    await user.click(await within(dialog).findByRole("button", { name: /^Emprestar REG-0018$/ }));
    expect(await screen.findByText("Empréstimo registrado")).toBeInTheDocument();
    // o resumo passa a listar o empréstimo ativo
    expect(await screen.findByRole("button", { name: "Devolver REG-0018" })).toBeInTheDocument();
  });
});

describe("fluxo: devolver", () => {
  it("devolve marcando como lido e atualiza a lista e as contagens", async () => {
    const { user } = renderApp("/emprestimos");
    const ativos = await screen.findByRole("tab", { name: /Ativos/ });
    await waitFor(() => expect(ativos).toHaveTextContent("5"));

    await user.click(await screen.findByRole("button", { name: /Devolver REG-0004/ }));
    const dialog = await screen.findByRole("dialog", { name: "Registrar devolução" });
    expect(within(dialog).getByRole("checkbox", { name: "Marcar como lido" })).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Registrar devolução" }));

    expect(await screen.findByText("Devolução registrada")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: /Devolver REG-0004/ })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("tab", { name: /Ativos/ })).toHaveTextContent("4"));

    const bruno = (await api.listStudents({ text: "bruno" })).items[0];
    const summary = await api.getReaderSummary("student", bruno.id);
    expect(summary.counts).toEqual({ active: 0, overdue: 0, read: 1 });
  });

  it("mostra o prazo relativo dos atrasados", async () => {
    renderApp("/emprestimos");
    expect(await screen.findAllByText(/dias de atraso/)).not.toHaveLength(0);
    expect(screen.getByText("vence hoje")).toBeInTheDocument();
  });
});

describe("fluxo: cadastrar aluno", () => {
  it("mostra matrícula duplicada no campo e cadastra com matrícula nova", async () => {
    const { user } = renderApp("/leitores/alunos/novo");
    await screen.findByRole("heading", { name: "Cadastrar aluno" });
    await screen.findAllByRole("option", { name: /5º ano A \(/ });

    await user.type(screen.getByLabelText("Nome *"), "Novo Aluno Teste");
    await user.type(screen.getByLabelText("Matrícula *"), "2026001");
    await user.selectOptions(screen.getByLabelText("Turma *"), (await screen.findAllByRole("option", { name: /5º ano A \(/ }))[0]);
    expect(await screen.findByText(/Professor responsável: Marina Alves/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.getByLabelText("Matrícula *")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getAllByText("Já existe um aluno com esta matrícula.").length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText("Matrícula *"));
    await user.type(screen.getByLabelText("Matrícula *"), "2026099");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Aluno cadastrado")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Nome *")).toHaveValue(""));
  });
});

describe("fluxo: turmas e leitores", () => {
  it("cria turma com professor novo (criação rápida)", async () => {
    const { user } = renderApp("/turmas");
    await screen.findByText("8º ano A");
    await user.click(screen.getByRole("button", { name: "Nova turma" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova turma" });
    await user.type(within(dialog).getByLabelText("Nome *"), "9º ano B");
    await user.click(within(dialog).getByRole("button", { name: "Novo professor" }));
    await user.type(within(dialog).getByLabelText("Nome do professor"), "Lúcia Prado");
    await user.click(within(dialog).getByRole("button", { name: "Cadastrar" }));
    await waitFor(() =>
      expect(within(dialog).getByLabelText("Professor responsável *")).toHaveDisplayValue("Lúcia Prado"),
    );
    await user.click(within(dialog).getByRole("button", { name: "Salvar turma" }));
    expect(await screen.findByText("Turma criada")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "9º ano B" })).toBeInTheDocument();
  });

  it("não deixa excluir professor responsável por turma (IN_USE)", async () => {
    const { user } = renderApp("/leitores?aba=professores");
    await screen.findByText("Marina Alves");
    await user.click(screen.getByRole("button", { name: "Excluir Marina Alves" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir professor" });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Não foi possível excluir o professor")).toBeInTheDocument();
    expect(screen.getByText("Marina Alves")).toBeInTheDocument();
  });

  it("filtra alunos só com atraso", async () => {
    const { user } = renderApp("/leitores");
    await screen.findByText("Ana Beatriz Souza");
    await user.click(screen.getByRole("checkbox", { name: "Só com atraso" }));
    await waitFor(() => expect(screen.queryByText("Ana Beatriz Souza")).not.toBeInTheDocument());
    expect(screen.getByText("Bruno Henrique Costa")).toBeInTheDocument();
    expect(screen.getByText("Eduarda Martins")).toBeInTheDocument();
  });
});

describe("fluxo: trocar o livro no modal de empréstimo (F-01)", () => {
  it("limpa o exemplar do livro anterior e só empresta exemplar do livro atual", async () => {
    const { user } = renderApp("/emprestimos");
    await screen.findByRole("tab", { name: /Ativos/ });
    await user.click(screen.getByRole("button", { name: "Novo empréstimo" }));
    const dialog = await screen.findByRole("dialog", { name: "Emprestar exemplar" });

    await user.type(within(dialog).getByRole("searchbox", { name: "Livro" }), "pequeno principe");
    await user.click(await within(dialog).findByRole("button", { name: /O Pequeno Príncipe/ }));
    expect(await within(dialog).findByRole("radio", { name: /REG-0002/ })).toBeChecked();

    await user.click(within(dialog).getByRole("button", { name: "Trocar livro" }));
    expect(within(dialog).queryByRole("radio", { name: /REG-0002/ })).not.toBeInTheDocument();
    await user.type(within(dialog).getByRole("searchbox", { name: "Livro" }), "dom casmurro");
    await user.click(await within(dialog).findByRole("button", { name: /Dom Casmurro/ }));

    // só aparecem exemplares do livro B e o marcado pertence a ele
    const radio = await within(dialog).findByRole("radio", { name: /REG-0005/ });
    expect(radio).toBeChecked();
    expect(within(dialog).queryByRole("radio", { name: /REG-000[123]/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Emprestar REG-0005" })).toBeInTheDocument();
  });
});

describe("fluxo: página fora do intervalo (F-02)", () => {
  it("volta à última página válida ao excluir o último item, sem mostrar o estado vazio", async () => {
    const { user } = renderApp("/acervo");
    await screen.findByText("O Hobbit");
    const turma = (await api.listBooks({ text: "turma da monica" })).items[0];
    await api.deleteBook(turma.id); // 11 livros: a página 2 terá só 1

    await user.click(await screen.findByRole("button", { name: "Próxima página" }));
    await screen.findByText("Sapiens: Uma Breve História da Humanidade");
    await user.click(screen.getByRole("button", { name: "Excluir Sapiens: Uma Breve História da Humanidade" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir livro" });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect(await screen.findByText("O Hobbit")).toBeInTheDocument();
    expect(screen.queryByText("O acervo está vazio")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhum livro encontrado")).not.toBeInTheDocument();
  });
});

describe("fluxo: título do documento", () => {
  it("define document.title pela página", async () => {
    renderApp("/acervo");
    await screen.findByText("O Hobbit");
    expect(document.title).toBe("Acervo · LiBok");
  });
});
