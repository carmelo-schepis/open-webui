# HUGO Harness — Deep Research companion service

A dependency-free Node (>=18) service that performs multi-source web research and
streams progress as newline-delimited JSON events. It is the harness port of the
Hugo `deep-research` pipeline; the frontend `/deep-research` page consumes it.

## Event contract

Each line is one JSON object:

| event | payload |
| --- | --- |
| `started` | `{ query }` |
| `searching` | `{ query }` |
| `source_found` | `{ source: { url, title } }` |
| `reading` | `{ source }` |
| `note` | `{ source, content }` |
| `analyzing` | `{ message }` |
| `writing` | `{}` |
| `report_chunk` | `{ content }` (streamed markdown) |
| `completed` | `{ report, sources }` |
| `error` | `{ message }` |

## API

- `GET /health` → `{ ok, service, ollama }`
- `POST /research` `{ query, model? }` → NDJSON stream (CORS: `ALLOWED_ORIGINS`)

## Configuration

| env | default | notes |
| --- | --- | --- |
| `PORT` | `8787` | listen port |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama used for synthesis |
| `OLLAMA_MODEL` | `llama3.2` | fallback when the request omits a model |
| `ALLOWED_ORIGINS` | `*` | comma-separated origin allow-list |
| `EVIDENCE_MAX` | `5` | max sources read per run |
| `FETCH_TIMEOUT_MS` | `15000` | per-page fetch timeout |

## Run

```sh
node harness-services/deep-research/server.js
```

Search uses DuckDuckGo's HTML endpoints and requires outbound network access on
the service host. Reports are synthesized by Ollama, so `OLLAMA_BASE_URL` must
point at a reachable Ollama server. The Firecrawl-backed Hugo variant was
considered and is not required here: it needs an external API key, while this
port keeps the same event contract with zero external dependencies.
