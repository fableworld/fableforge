# 🎭 FableForge (working title)

> Desktop companion app for managing custom audio content on FABA-compatible children's music players.

> [!NOTE]
> The project is currently being renamed from "freefaba" to avoid trademark issues. See [PRD §6](docs/PRD.md) for naming candidates.

## ✨ What It Does

- **Browse** community collections of audio characters from decentralized registries
- **Create** your own characters by importing MP3 files
- **Write** audio content to your FABA device via USB
- **Sync** your collections with S3-compatible cloud storage
- **Share** your collections with others via hosted registries

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | [Tauri](https://tauri.app/) (Rust + WebView) |
| Frontend | React + TypeScript |
| Build | Vite |
| State | Zustand / Jotai |
| Backend | Rust (Tauri commands) |

## 🚀 Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) (recommended) or npm
- Platform-specific Tauri dependencies (see [Tauri Prerequisites](https://tauri.app/start/prerequisites/))

### Development

```bash
# Install dependencies
pnpm install

# Start development mode (frontend + Tauri window)
pnpm tauri dev
```

### Build

```bash
# Create production build + installer
pnpm tauri build
```

### Testing

```bash
# Rust backend tests (MKI encoding, device logic)
cd src-tauri && cargo test

# Frontend tests
pnpm test
```

## 📁 Project Structure

```
├── docs/                     # Project documentation
│   ├── PRD.md                # Product Requirements Document
│   └── IMPLEMENTATION_PLAN.md # Phased development plan
├── src/                      # Frontend (React + TypeScript)
│   ├── components/           # UI components
│   ├── services/             # Business logic
│   ├── stores/               # State management
│   └── types/                # TypeScript types & Zod schemas
├── src-tauri/                # Backend (Rust)
│   ├── src/
│   │   ├── main.rs           # Tauri entry point & commands
│   │   ├── mki.rs            # MKI file encoding (rainbow table scrambling)
│   │   ├── faba.rs           # Device detection & management
│   │   ├── core/             # Error types
│   │   └── dto/              # Data transfer objects
│   └── Cargo.toml
├── AGENTS.md                 # AI agent / contributor reference
└── README.md                 # This file
```

## 🔗 Related Projects

- **[OpenFable](../openfable)** — Progressive Web App (PWA) for mobile: browse character registries, write NFC tags from your phone. Shares the same registry/character data model.

## 📖 Documentation

- [Product Requirements (PRD)](docs/PRD.md) — Full feature specification
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) — Phased development roadmap
- [Agent Reference (AGENTS.md)](AGENTS.md) — Architecture, guidelines, glossary

## 🤝 Contributing

1. Read the [AGENTS.md](AGENTS.md) for coding guidelines and architecture overview.
2. Check the [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) for current phase and open tasks.
3. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
4. Feature branches off `main`, squash merge when ready.

## 📄 License

TBD
