# Implementation Plan

**Project:** freefaba → FableForge
**Scope:** Complete rewrite & feature expansion
**Status:** Draft — pending review

---

## Overview

This plan outlines a phased approach to rewriting the FableForge desktop app from its current state (Tauri v1 + React 18 + MUI v5) into a modern, feature-rich application aligned with the [PRD](./PRD.md). The work is divided into phases to allow incremental progress and validation.

---

## Phase 0 — Project Bootstrap & Stack Upgrade

> **Goal:** Set up the new project scaffolding with updated dependencies while preserving the critical Rust encoding engine.

### Tasks

1. **Rename project** — Update all references from "freefaba" to "FableForge" (identifiers, config files, bundle info).
2. **Initialize Tauri v2 project** — Create a new Tauri v2 + React + TypeScript + Vite project.
   - Use `pnpm` as package manager.
   - Configure Vite 6.x, TypeScript 5.x, React 19.
3. **Migrate Rust backend:**
   - Port `mki.rs` (MKI encoding/scrambling) as-is — this is the core engine and must not change functionally.
   - Port `faba.rs` (device detection, slot/track management) with improvements:
     - Add async device detection with hot-plug events.
     - Return richer metadata about slots (current character name, track count).
   - Update Cargo.toml to latest compatible versions of all dependencies.
   - Adapt Tauri command signatures to v2 API.
4. **Set up frontend design system:**
   - Choose UI component library (Radix UI + CSS modules, or Shadcn-like custom components).
   - Define CSS custom properties: color palette, typography scale, spacing, border radius, shadows.
   - Implement dark/light mode toggle with system-aware default.
5. **Set up state management** — Jotai v2 for global state.
6. **Testing infrastructure:**
   - Rust: `cargo test` for encoding unit tests.
   - TypeScript: Vitest for service/utility tests.

### Deliverables
- New project that builds and shows a "Hello World" Tauri v2 window.
- MKI encoding tests passing.
- Design system tokens visible in a demo page.

---

## Phase 1 — Collection Browsing & Discovery

> **Goal:** Implement the ability to browse collections from remote registries, matching OpenFable's model.

### Tasks

1. **Data layer:**
   - Define TypeScript types/schemas (Zod) for Registry, Character, Track, Model3D — extending OpenFable's `schemas.ts`.
   - Implement local storage layer using Tauri's SQLite plugin (or `tauri-plugin-store`).
   - `registry.service.ts` — fetch, validate (partial failure), cache registries.
2. **UI — Registry management:**
   - Settings page with "Add Registry" (URL input), list of added registries, "Remove", "Refresh".
3. **UI — Gallery:**
   - Grid layout of character cards (preview image, name, collection badge).
   - Search/filter bar.
   - Sort by date, name.
   - Skeleton loading states.
4. **UI — Character Detail:**
   - Full character info: image, description, track list, 3D model links.
   - Audio sample player (if `audio_sample_url` provided).
5. **Navigation:**
   - React Router (or TanStack Router) for page routing.
   - Shared-element transitions between gallery and detail views.

### Deliverables
- Users can add registries, browse characters, view details.
- Works offline with cached data.

---

## Phase 2 — Collection Management (Local & Remote)

> **Goal:** Allow users to create, edit, and optionally sync their own collections.

### Tasks

1. **Create collection wizard:**
   - Name, description, cover image.
   - Stored locally in app data directory as JSON.
2. **Character editor:**
   - Form: name, description, preview image (file picker or URL).
   - Audio track importer: drag & drop or file picker for MP3 files.
   - Track ordering (drag & drop reorder).
   - Device address assignment.
3. **Local collection persistence:**
   - Store collections in `$APPDATA/collections/` as JSON files.
   - Audio files stored alongside or in a managed cache.
4. **S3 sync (Rust backend):**
   - New Rust module: `s3_sync.rs` using `rust-s3` crate.
   - Configuration: endpoint, bucket, region, access key, secret key.
   - Push: upload collection JSON + audio files to S3.
   - Pull: download collection from S3 to local.
   - Tauri commands: `s3_configure`, `s3_push_collection`, `s3_pull_collection`, `s3_list_remote`.
5. **UI — Sync settings:**
   - S3 configuration form in Settings.
   - Per-collection sync toggle and status indicator.
   - Push/Pull buttons with progress.

### Deliverables
- Users can create and manage local collections.
- Collections can be synced with S3-compatible storage.

---

## Phase 3 — Device Writing (Enhanced)

> **Goal:** Reimagine the write-to-device experience to be intuitive and safe.

### Tasks

1. **Device connection status:**
   - Persistent status bar indicator (connected / not connected / error).
   - Hot-plug detection (Rust backend emits events on USB changes).
2. **Write flow UI:**
   - "Write to Device" button on character detail page.
   - Slot selection dialog:
     - Shows all 500 slots as a searchable list.
     - Each slot shows: index, current character name (if any), track count.
     - Suggested slot highlighted (character's `device_address` or first empty).
   - Confirmation dialog for overwrites:
     - Shows currently installed character vs. new one.
     - Options: Overwrite / Change Address / Cancel.
     - NFC tag address reminder.
   - Progress: per-track progress bar + overall progress.
   - Success screen with animation.
3. **Update detection:**
   - Compare on-device track list with collection's track list.
   - Show diff: "2 tracks added, 1 removed".
   - Option to update (write only changes) or full rewrite.
4. **Preserve & test MKI encoding:**
   - Ensure rainbow table scrambling produces identical output to v1.
   - Add golden-file tests (encode known input → compare to expected output).

### Deliverables
- Full write-to-device workflow with smart overwrite detection.
- All existing encoding functionality working identically.

---

## Phase 4 — Polish & Packaging

> **Goal:** Final UI polish, packaging, and documentation.

### Tasks

1. **Animations & transitions:**
   - Page transitions (framer-motion or similar).
   - Card hover effects, button ripples.
   - Write progress animation.
   - Toast notifications for success/error.
2. **Error handling review:**
   - Ensure all error states have friendly user-facing messages.
   - Rust panics caught and reported gracefully.
3. **Accessibility:**
   - Keyboard navigation.
   - ARIA labels on interactive elements.
   - Color contrast compliance.
4. **Packaging:**
   - Linux: AppImage, .deb.
   - macOS: .dmg.
   - Windows: .msi / .exe installer.
   - Application icons (generate from new branding).
5. **Documentation:**
   - Update README.md with final name and instructions.
   - User guide / help section in-app.
6. **Tauri auto-updater** configuration (optional, future).

### Deliverables
- Production-ready application with installers.
- Comprehensive documentation.

---

## Verification Plan

### Automated Tests

**Rust backend:**
```bash
cd src-tauri && cargo test
```
- MKI encoding golden-file tests (scramble/unscramble round-trip).
- Device slot listing logic with mock filesystem.
- S3 sync unit tests with mock S3 client.

**Frontend:**
```bash
pnpm test
```
- Registry service: fetch, validate, partial failure handling.
- Collection CRUD operations.
- State management tests.

### Manual Verification

1. **Device detection:** Connect/disconnect FABA device, verify status changes in UI.
2. **Write flow:** Write a multi-track character, verify MKI files on device match expected encoding.
3. **Registry browsing:** Add a real OpenFable registry URL, verify characters appear correctly.
4. **S3 sync:** Configure with a MinIO instance, push/pull a collection.
5. **Cross-platform:** Test on Linux, macOS, and Windows.
6. **UI review:** Verify animations, dark mode, responsive layout at various window sizes.

---

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| Tauri v1 → v2 API incompatibilities | Study migration guide; core Rust logic is framework-agnostic |
| MKI encoding regression | Golden-file tests + compare output with known-good files from v1 |
| S3 compatibility across providers | Test with MinIO, AWS S3, Backblaze B2 |
| USB hot-plug detection varies by OS | Use `notify` crate or Tauri-native filesystem watcher; fallback to polling |
| New name trademark conflicts | Search trademark databases before finalizing |
