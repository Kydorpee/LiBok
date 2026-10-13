import { useState } from "react";
import { createHashRouter, RouterProvider } from "react-router";
import { Providers } from "./app/providers";
import { routes } from "./app/routes";

// HashRouter: funciona com o protocolo do Tauri sem configurar fallback de servidor.
function App() {
  const [router] = useState(() => createHashRouter(routes));
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}

export default App;
