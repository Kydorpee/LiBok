import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { Providers } from "../app/providers";
import { routes } from "../app/routes";
import { resetMock } from "../lib/api";

/** Renderiza o app inteiro (rotas reais + mock novo em memória) numa rota inicial. */
export function renderApp(route = "/") {
  resetMock();
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const user = userEvent.setup();
  const utils = render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { user, router, ...utils };
}
