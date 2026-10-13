import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renderiza a rota inicial (Dashboard)", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });
});
