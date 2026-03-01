# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- **Deep Linking Support**: Integrated `tauri-plugin-deep-link` to handle `freefaba://` protocol for character sharing and remote registry imports.
- **Ephemeral Characters**: Added support for previewing and playing characters from external registries before importing them into the local collection.
- **Native Audio Engine**: Implemented a dedicated Rust-based audio engine using `rodio` to provide stable, low-latency playback on Linux, bypassing Webview limitations.
- **Arch Linux Packaging**: Added `PKGBUILD` and `.desktop` files for official Arch Linux support and AUR-ready packaging.
- **Backend Networking**: Switched to `reqwest` for robust HTTP fetching of registries and assets directly from the Rust backend.
- **Device Management**: Centralized logic for Faba hardware device slot management (loading and clearing) in the main application state.
- **S3 Improvements**: Added support for optional public base URLs in S3 configurations and implemented partial credential updates.
- **Security**: Enabled persistent storage and Rust-based crypto features for the OS keyring integration.

## [0.2.0] 2026-02-23
### Fixed
- Show characters in the gallery from the local collection even if no external regietries has been added

### Added
- System Diagnostics section in Settings page.
- Real-time system information display (OS, Architecture, Tauri and App versions).
- "System Health Check" utility for environment and data directory verification.
- Internal UI interaction analytics for performance monitoring.
- S3-compatible remote sync foundation: Rust S3 module with aws-sdk-s3.
- OS keyring integration for secure S3 credential storage.
- S3 configuration management (add, edit, delete, test connection) in Settings.
- S3ConfigDialog component for configuring S3 connections with inline test.
- Public index URL copy button for public S3 buckets.
- 6 new Tauri commands for S3 operations (save/get/delete config, test connection, store credentials, get public URL).
- S3 sync engine: per-character upload/download with asset files (preview images + MP3 tracks).
- SHA-256 content hashing for change detection with ETag-based optimistic locking.
- S3 lockfile mechanism with TTL-based expiry for concurrent upload prevention.
- OpenFable-compatible index.json generation/update after each character upload.
- Conflict detection engine (synced/pending_upload/pending_download/conflict states).
- 4 new sync Tauri commands (upload, download, get status, resolve conflict).
- Frontend sync service layer with TypeScript types for sync metadata and results.
- Sync status badges in editor sidebar (synced ✓, pending upload ↑, pending download ↓, conflict ⚠).
- Upload/Download action buttons per character in the editor.
- Conflict resolution banner with "Keep Local" / "Use Remote" actions.
- S3 Sync indicator badge in editor header when collection has linked S3 config.
- Sync All button to batch-upload all characters in a collection to S3.
- Auto-sync timer: periodic sync status refresh every 60 seconds.
- `s3_sync_all` Tauri command for batch character upload.
- Audio player with local file support (Blob URLs) and remote URL streaming.

## [0.1.1] 2026-02-22

## [0.1.0] - 2026-02-21

### Added
- Initial project structure with Tauri v2.
- GitHub Actions configuration for cross-platform releases.
- Automatic release notes extraction from CHANGELOG.md.
