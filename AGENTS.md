# AGENTS.md — Project Reference for AI Agents

> This file provides context and guidelines for AI agents working on this codebase.
> Updated: 2026-02-14

---

## Project Overview

**Name:** (formerly "freefaba" — being renamed, see `docs/PRD.md` §6)
**Type:** Desktop application
**Stack:** Tauri (Rust backend) + React (TypeScript frontend)
**Purpose:** Manage custom audio content for FABA-compatible music players. Download/create audio character collections, convert and write them to the physical device via USB.

**Related project:** [OpenFable](../openfable) — A companion PWA for browsing/sharing character collections and writing NFC tags from phones. This project shares the same data model (registry/character JSON schema).

---

## Architecture

```
┌─────────────────────────────────────────┐
│               Frontend (React)          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │  Pages   │ │Components│ │ Services│ │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       └────────────┼────────────┘      │
│                    ▼                    │
│           State Management              │
│           (Zustand/Jotai)               │
└────────────────┬────────────────────────┘
                 │ Tauri IPC (invoke/events)
┌────────────────▼────────────────────────┐
│               Backend (Rust)            │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │  Device  │ │   MKI    │ │   S3    │ │
│  │ Manager  │ │ Encoder  │ │  Sync   │ │
│  └──────────┘ └──────────┘ └─────────┘ │
└─────────────────────────────────────────┘
```

### Key Modules

**Rust Backend (`src-tauri/src/`):**
- `mki.rs` — MKI file encoding/decoding using rainbow table scrambling. **Critical: do not modify the rainbow tables or scrambling logic** — they must produce output identical to the original FABA device format.
- `faba.rs` (to be renamed `device.rs`) — FABA device detection via USB mount point scanning, slot/track listing, track writing.
- `core/error.rs` — Typed error enum with serde serialization for IPC.
- `dto/` — Data transfer objects for Tauri commands.

**Frontend (`src/`):**
- `components/` — React components.
- `services/` — Business logic (registry fetching, collection management).
- `stores/` — State management stores.
- `types/` — TypeScript type definitions and Zod schemas.

---

## Key Reference Documents

| Document | Location | Purpose |
|---|---|---|
| PRD | `docs/PRD.md` | Product requirements, user personas, feature specs |
| Implementation Plan | `docs/IMPLEMENTATION_PLAN.md` | Phased development plan with tasks and deliverables |
| OpenFable Requirements | `../openfable/docs/REQUIREMENTS.md` | Reference for registry/character data model |
| OpenFable Schemas | `../openfable/src/lib/schemas.ts` | Zod schemas for the shared data model |

> **Keep these documents updated** as the project evolves. When making significant architectural decisions, document them in the relevant file.

---

## Data Model

The project uses a decentralized registry model shared with OpenFable:

- **Registry** — A JSON file hosted at a URL, containing metadata (`meta`) and a list of `characters`.
- **Character** — An audio character with tracks, images, 3D model links, and NFC payload.
- **Track** — An individual audio file within a character.

Schema definitions should use **Zod** for runtime validation, matching OpenFable's approach in `schemas.ts`.

---

## Development Guidelines

### Rust Backend

1. **Error handling:** Use `thiserror` for defining error types. All errors must implement `serde::Serialize` for IPC.
2. **Async operations:** Use Tokio for async file I/O and network operations. Tauri v2 commands support async natively.
3. **MKI encoding:** The rainbow table scrambling in `mki.rs` is a black-box reverse-engineered from the FABA device format. It MUST NOT be modified. Add tests, not changes.
4. **Testing:** All Rust modules should have `#[cfg(test)]` modules. Use golden-file testing for encoding.
5. **Logging:** Use `tracing` crate for structured logging.

### Frontend

1. **Component structure:** Prefer small, focused components. Use composition over inheritance.
2. **State management:** Global state in Zustand/Jotai stores. Component-local state with `useState`/`useReducer`.
3. **Styling:** CSS modules or CSS custom properties. Design tokens defined centrally. No inline styles except for dynamic values.
4. **TypeScript:** Strict mode. No `any` types. Use Zod for runtime validation at boundaries (IPC, network).
5. **Tauri IPC:** All `invoke()` calls should be wrapped in typed service functions. Never call `invoke()` directly from components.
6. **Accessibility:** ARIA labels on interactive elements. Keyboard navigable. Dark mode compliant.

### General

1. **Commit messages:** Conventional Commits format (`feat:`, `fix:`, `refactor:`, `docs:`, etc.).
2. **Branch strategy:** Feature branches off `main`. Squash merge.
3. **No dead code:** Remove unused imports, functions, and files during refactoring.
4. **i18n readiness:** All user-facing strings should be extractable (even if single-language initially).

---

## Common Tasks

### Run in Development
```bash
# Frontend dev server + Tauri window
pnpm tauri dev
```

### Build for Production
```bash
pnpm tauri build
```

### Run Rust Tests
```bash
cd src-tauri && cargo test
```

### Run Frontend Tests
```bash
pnpm test
```

---

## Glossary

| Term | Meaning |
|---|---|
| **MKI** | The scrambled audio file format used by FABA devices. Files have `.MKI` extension. |
| **Slot** | A numbered directory on the FABA device (1-500) corresponding to a character address. Mapped as `MKI01/K5XXX/`. |
| **Track** | An individual audio file within a slot, named `CPNN.MKI` (e.g., `CP01.MKI`). |
| **Rainbow Table** | A 4×256 byte substitution table used for MKI scrambling/unscrambling. |
| **Registry** | A JSON file listing characters in a collection, hosted at a URL. |
| **Character** | A set of audio tracks with metadata (name, image, etc.) that maps to a physical figurine on the FABA player. |
| **Collection** | A group of characters managed together (synonym with a registry). |
| **NFC Payload** | The data written to an NFC tag that tells the FABA device which slot to play. |
