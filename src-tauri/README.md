# OpenVisual Local — Tauri backend

A thin, local-only bridge to Ollama. It never parses diagram JSON — the TypeScript layer owns the schema, validation and the repair loop.

## Fixed endpoint

Every request goes to `http://127.0.0.1:11434`. The base URL is a compile-time constant
with no config field, environment variable or command parameter, and the shared HTTP
client clears proxies so an ambient `HTTP_PROXY` cannot divert loopback traffic to a
third party. This is a deliberate MVP security boundary.

## Commands

| Command              | Arguments                  | Returns                        |
| -------------------- | -------------------------- | ------------------------------ |
| `check_ollama`       | –                          | `OllamaStatusDto`, never fails |
| `list_ollama_models` | –                          | `OllamaModelDto[]`             |
| `generate_diagram`   | `request: GenerateRequest` | `GenerateResponse`             |
| `repair_diagram`     | `request: GenerateRequest` | `GenerateResponse`             |
| `cancel_generation`  | `requestId: string`        | `void`                         |

DTOs are camelCase on the wire. Failures reject with `{ code, message }`, where `code` is
`ollama_unreachable`, `timeout`, `cancelled`, `model_missing`, `invalid_model_output` or
`unknown` — the set the frontend maps to `AppError`. Generation registers its `requestId`
before the call and de-registers on every exit path; cancelling an unknown id is a no-op.
