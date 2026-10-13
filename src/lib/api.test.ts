import { describe, expect, it } from "vitest";
import { api, isAppError, isMockMode, toAppError } from "./api";

describe("api (modo mock)", () => {
  it("usa mocks fora do Tauri", () => {
    expect(isMockMode()).toBe(true);
  });

  it("chama o mock com wrapper tipado", async () => {
    const stats = await api.getStats();
    expect(stats.totalBooks).toBeGreaterThan(0);
    const page = await api.listBooks({ text: "hobbit" });
    expect(page.items[0].title).toBe("O Hobbit");
  });

  it("normaliza erros para AppError", async () => {
    await expect(api.getBook(-1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(toAppError("falhou")).toEqual({ code: "IO", message: "falhou" });
    expect(toAppError(new Error("x"))).toEqual({ code: "IO", message: "x" });
    expect(isAppError({ code: "DB", message: "m" })).toBe(true);
    expect(isAppError({ code: "OUTRO", message: "m" })).toBe(false);
  });
});
