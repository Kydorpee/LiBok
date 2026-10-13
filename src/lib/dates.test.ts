import { describe, expect, it } from "vitest";
import {
  addDays,
  defaultDueDate,
  diffDays,
  formatDate,
  isValidISODate,
  loanStatus,
  relativeDue,
  toISODate,
} from "./dates";

describe("datas", () => {
  it("soma dias atravessando mês, ano e bissexto", () => {
    expect(addDays("2026-10-12", 14)).toBe("2026-10-26");
    expect(addDays("2026-12-25", 14)).toBe("2027-01-08");
    expect(addDays("2028-02-20", 14)).toBe("2028-03-05");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("devolução prevista padrão é +7 dias", () => {
    expect(defaultDueDate("2026-10-12")).toBe("2026-10-19");
  });

  it("formata dd/mm/aaaa", () => {
    expect(formatDate("2026-10-05")).toBe("05/10/2026");
    expect(formatDate("2026-10-05 10:20:00")).toBe("05/10/2026");
    expect(formatDate(undefined)).toBe("");
  });

  it("toISODate usa a data local", () => {
    expect(toISODate(new Date(2026, 0, 9))).toBe("2026-01-09");
  });

  it("valida datas ISO", () => {
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-2-3")).toBe(false);
    expect(isValidISODate("2026-02-28")).toBe(true);
  });

  it("calcula o status do empréstimo", () => {
    const today = "2026-10-12";
    expect(loanStatus({ dueAt: "2026-10-12" }, today)).toBe("active");
    expect(loanStatus({ dueAt: "2026-10-11" }, today)).toBe("overdue");
    expect(loanStatus({ dueAt: "2026-10-01", returnedAt: "2026-10-12" }, today)).toBe("returned");
  });

  it("descreve o prazo relativo", () => {
    const today = "2026-10-12";
    expect(diffDays(today, "2026-10-19")).toBe(7);
    expect(relativeDue("2026-10-12", today)).toBe("vence hoje");
    expect(relativeDue("2026-10-13", today)).toBe("vence amanhã");
    expect(relativeDue("2026-10-15", today)).toBe("vence em 3 dias");
    expect(relativeDue("2026-10-05", today)).toBe("7 dias de atraso");
  });
});

describe("timestamps UTC -> local", () => {
  it("converte ISO com Z para a data/hora local", async () => {
    const { formatTimestamp, formatTimestampDate, parseTimestamp } = await import("./dates");
    const iso = "2026-10-13T02:30:00Z";
    const d = parseTimestamp(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expectedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    expect(formatTimestampDate(iso)).toBe(expectedDate);
    expect(formatTimestamp(iso)).toBe(`${expectedDate} ${pad(d.getHours())}:${pad(d.getMinutes())}`);
    expect(formatTimestampDate("")).toBe("");
  });
});
