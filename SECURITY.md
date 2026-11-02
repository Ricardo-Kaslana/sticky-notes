# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.2.x | Yes |
| < 0.2 | No |

Only the latest release receives security fixes.

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, discussions, or pull requests.

Use GitHub's private vulnerability reporting:

**<https://github.com/Ricardo-Kaslana/sticky-notes/security/advisories/new>**

Include, when possible:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- The app version and Windows version.
- Any relevant logs or screenshots.
- Your suggested fix, if you have one.

You will receive an acknowledgement as soon as possible, usually within a few days. This is a spare-time project, so please allow reasonable time for a fix and coordinated disclosure.

## Scope

Sticky Notes is a local desktop application. It has no account system, no network communication, no telemetry, and no auto-update channel. Relevant areas include:

- Path handling for note IDs and attachments (path traversal, arbitrary file write/delete).
- Rendering of note HTML and pasted content inside the TipTap editor (XSS, script execution in the webview).
- Tauri capabilities and CSP boundaries (`src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`).
- The `asset:` protocol scope and attachment URL rewriting during data migration.
- Privilege boundaries of the updater or autostart integration (autostart only writes the current user's startup entry).

Issues that require an attacker to already have full local access to the user's files or account are generally out of scope, but we are still interested in defense-in-depth improvements.

## What not to include

Never attach real note data, personal attachments, credentials, or tokens to a public report. Redact paths and content from screenshots and logs.
