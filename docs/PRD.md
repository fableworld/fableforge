# Product Requirements Document (PRD)

**Project Name:** FableForge
**Type:** Desktop application (Tauri)
**Version:** 2.0
**Status:** Draft
**Related project:** [OpenFable](../openfable) — PWA companion

---

## 1. Executive Summary

FableForge is a **desktop companion application** for managing custom audio content on FABA-compatible music players. It evolves from the original "freefaba" prototype, incorporating the decentralized collection model pioneered by OpenFable (a PWA) with the native capabilities of a desktop app: direct USB device access, local file management, and S3-compatible registry synchronization.

The app allows users to **discover, create, manage, and write** audio character collections to their physical device, with a polished modern UI and a robust architecture.

---

## 2. User Personas

| Persona | Description | Key Needs |
|---|---|---|
| **The Maker Parent** | Tech-savvy, creates custom stories/songs for their children. Owns 3D printer. | Create collections, import audio files, write to device |
| **The Content Sharer** | Creates collections and shares them via a registry URL or S3 bucket | Publish collections, manage remote syncing |
| **The Casual User** | Browses community collections, writes pre-made characters to device | Discover content, one-click write |
| **The Archivist** | Manages large libraries of characters across multiple devices | Bulk operations, backup/restore, address management |

---

## 3. Functional Requirements

### 3.1 Collection Browsing & Discovery

> **Goal:** Allow users to browse collections (registries) from the web, mirroring OpenFable's decentralized model.

- **Registry index:** The app periodically (or on-demand) fetches an index listing available collection registries.
- **Adding registries:** Users can add registries by URL. Validation and partial-failure handling matches OpenFable's approach (valid characters imported, malformed ones skipped with warning).
- **Third-party collection import:** Users can import/manage registries from any URL (GitHub raw, S3, custom servers).
- **Offline access:** Fetched registry data is cached locally (SQLite or equivalent via Tauri) for offline browsing.
- **Background refresh:** Automatic periodic updates + manual "Check for Updates" button.
- **Gallery view:** Grid layout of characters with search, filter by collection, sort by date.
- **Character detail:** Preview image, description, audio sample player, download links, 3D model links.

### 3.2 Collection Management (Local & Remote)

> **Goal:** Allow users to create and manage their own collections of characters.

- **Create collection:** Wizard to create a new collection with metadata (name, version, maintainer, description, cover image).
- **Add character to collection:** Import audio files (MP3), assign metadata (name, description, preview image, NFC address), optionally link 3D models.
- **Edit/delete characters and collections.**
- **Local-only collections:** Stored entirely on disk, never synced.
- **S3-synced collections:** Collections can be synced to/from an S3-compatible remote bucket (AWS S3, MinIO, Garage, Backblaze B2, etc.).
  - Configurable endpoint, bucket, credentials.
  - Push (publish) and pull (subscribe) operations.
  - Conflict resolution: last-write-wins with manual override option.

### 3.3 Device Writing

> **Goal:** Streamlined, user-friendly process to write a character (set of audio tracks) from a collection to the FABA device.

- **Device detection:** Auto-detect FABA device connected via USB (mass storage mode). Show status indicator (connected/disconnected).
- **Hot-plug support:** React to device connect/disconnect events in real-time.
- **Write flow:**
  1. User selects a character from any collection (local or remote).
  2. App shows which device slot (address) to write to.
  3. **If slot is empty or matches the same character:** Write directly (with progress indicator).
  4. **If slot is occupied by a different character:** Show confirmation dialog:
     - Display what is currently in that slot.
     - Options: **Overwrite**, **Choose different address**, **Cancel**.
     - Remind user to update the NFC tag address if the address changes.
  5. **If only updating (tracks added/removed):** Show diff of changes, write delta.
- **MKI encoding:** Preserve the existing MKI scrambling/encoding engine (rainbow-table based) exactly as-is.
- **Slot initialization:** Ability to initialize device with placeholder tracks (existing feature, preserved).

### 3.4 Data Model

The application adopts and extends OpenFable's registry JSON schema:

```json
{
  "meta": {
    "name": "My Collection",
    "version": "1.0",
    "maintainer": "Author Name",
    "description": "Optional description",
    "cover_image": "https://..."
  },
  "characters": [
    {
      "id": "unique-uuid",
      "name": "Character Name",
      "created_at": "2024-01-01T00:00:00Z",
      "description": "Optional description",
      "preview_image": "https://...",
      "gallery_images": ["https://..."],
      "audio_sample_url": "https://...",
      "audio_zip_url": "https://...",
      "tracks": [
        { "index": 1, "name": "Track 1", "file": "track01.mp3" }
      ],
      "models_3d": [
        { "provider": "makerworld", "url": "https://..." }
      ],
      "nfc_payload": "K5001",
      "device_address": 1
    }
  ]
}
```

**Extensions over OpenFable:**
- `tracks[]` array with individual track metadata.
- `device_address` field mapping to the physical slot on the device.

---

## 4. Non-Functional Requirements

### 4.1 Stack Upgrade

| Component | Current (v1) | Target (v2) |
|---|---|---|
| **Tauri** | v1.2 | v2.x (latest stable) |
| **React** | v18 | v19 (or latest stable) |
| **UI Framework** | MUI v5 | Custom design system or modern alternative (Radix UI + CSS modules, or similar) |
| **State Management** | Jotai v1 | Jotai v2 |
| **TypeScript** | v4.6 | v5.x |
| **Vite** | v4 | v6.x |
| **Rust edition** | 2021 | 2021 (retain, upgrade crate versions) |
| **Tauri API** | `@tauri-apps/api` v1 | `@tauri-apps/api` v2 |
| **Package Manager** | Yarn (classic) | pnpm |

### 4.2 Look & Feel

- **Design philosophy:** Premium, modern, with attention to micro-interactions.
- **Dark mode:** System-aware with manual toggle.
- **Animations:**
  - Smooth page transitions (shared-element / hero transitions).
  - Subtle hover effects on cards and buttons.
  - Skeleton loaders instead of spinners.
  - Progress animations during device write.
- **Typography:** Modern sans-serif (Inter, Geist, or similar).
- **Color palette:** Vibrant, accessible, cohesive — inspired by storytelling/creativity themes.
- **Responsive layout:** Adapt to different window sizes gracefully.

### 4.3 Architecture Principles

- **Clean modular architecture:** Clear separation between UI, state, services, and Tauri commands.
- **Error handling:** Typed errors in both Rust and TypeScript. User-friendly error messages with actionable guidance.
- **Logging:** Structured logging in Rust backend.
- **Testability:** Unit tests for Rust encoding logic, integration tests for device operations.

---

## 5. User Flows

### 5.1 First Launch

1. App opens with empty state — "No collections yet".
2. Quick-start guide: "Add a registry to discover characters, or create your own collection."
3. Option to add default/community registry.

### 5.2 Browse & Write Character

1. User browses gallery of characters from added registries.
2. Clicks a character → detail view (image, description, tracks, 3D models).
3. Clicks "Write to Device" button.
4. App checks device connection.
5. Suggests slot address (or uses character's `device_address`).
6. Shows confirmation with slot status (empty / occupied / same character).
7. Writes tracks with progress bar.
8. Success animation + reminder about NFC tag.

### 5.3 Create Custom Character

1. User clicks "New Collection" → enters metadata.
2. Clicks "Add Character" → enters name, description.
3. Imports audio files (drag & drop or file picker).
4. Assigns track order.
5. Optionally sets preview image, 3D model links.
6. Saves locally.
7. Can publish to S3 bucket if configured.

### 5.4 S3 Sync

1. User goes to Settings → "Remote Sync".
2. Configures S3 endpoint, bucket, access key, secret key.
3. Selects which collections to sync.
4. "Push" uploads local collection to S3.
5. "Pull" downloads remote collection from S3.
6. Status indicators show sync state.

---

---

## 7. Future Roadmap

- **Deep link protocol:** `fableforge://write?character=uuid&registry=url` — receive write requests from OpenFable PWA.
- **Multi-device management:** Support multiple FABA devices simultaneously.
- **Audio editor:** Basic trim/normalize built into the app.
- **Collection marketplace/discovery:** Curated list of community registries.
- **Auto-update:** Tauri's built-in updater for seamless app updates.
