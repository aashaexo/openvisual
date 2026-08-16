# Security policy

## The short version

OpenVisual Local has no server, no account system and no network surface beyond your own
machine. There is no backend to breach and no user data to leak — your text, your diagrams and
your projects never leave the computer they were created on.

That does not make it unbreakable, and reports are welcome.

## Reporting a vulnerability

Please report privately rather than in a public issue: open a
[security advisory](../../security/advisories/new) on this repository.

Include what you did, what happened, and what you expected. A proof of concept helps enormously.
Expect a first response within a week.

Please do not include real personal or confidential text in a report — a synthetic example that
reproduces the problem is always enough.

## What counts as a vulnerability here

The security model rests on a few properties. Anything that breaks one of them is worth
reporting:

- **The app contacts only `127.0.0.1:11434`.** Any code path that reaches a different host, or
  any way to redirect the Ollama endpoint through configuration, input or a crafted file, is a
  vulnerability.
- **Model output is untrusted.** It is validated by a strict Zod schema before anything is drawn.
  Anything that renders unvalidated output, or smuggles HTML, SVG, script or styling past the
  schema and into the canvas, is a vulnerability.
- **Imported files are untrusted.** Project backups, diagram JSON and `.excalidraw` scenes are
  parsed defensively. A crafted file that executes code, escapes the canvas or corrupts stored
  projects is a vulnerability.
- **Nothing is executed.** The app never evaluates code returned by a model or contained in a
  file.
- **Nothing is collected.** There is no telemetry, no analytics and no crash reporting. Any code
  that reports usage anywhere is a bug, and a serious one.

## What does not count

- Vulnerabilities in Ollama itself, or in a model you have installed — report those upstream.
- The macOS Gatekeeper warning on unsigned release builds. It is expected; releases are unsigned
  until the project can justify a code-signing certificate.
- Anything that requires an attacker to already have write access to your machine or to the
  application's own storage.

## Scope of a release

Only the latest release is supported. There are no long-term support branches.
