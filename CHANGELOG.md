# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

## [0.1.1] 2026-02-22

## [0.1.0] - 2026-02-21

### Added
- Initial project structure with Tauri v2.
- GitHub Actions configuration for cross-platform releases.
- Automatic release notes extraction from CHANGELOG.md.
