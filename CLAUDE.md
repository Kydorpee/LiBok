# LiBok v2

App desktop para gerenciar uma pequena biblioteca — Tauri v2 + React/Vite + Tailwind v4 + SQLite.

- Fonte da verdade: `docs/BRIEFING.md` (escopo, modelo de dados, contrato IPC, fases).
- A sessão principal do Claude é o **orquestrador**: delega aos agentes em `.claude/agents/` (`libok-*`), integra os resultados e mantém o briefing. Não escreve código de produto diretamente.
- Cada agente só edita a própria área (briefing §6). Mudanças no contrato IPC (§5) passam pelo orquestrador.
- A v1 (Python/CustomTkinter) está no histórico do git (commit `914c65a`) como referência de regras de negócio.
