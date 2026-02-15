# 🎭 FableForge

> Desktop companion app for managing custom audio content on FABA-compatible children's music players.

> [!NOTE]
> This project was formerly known as "freefaba" and has been renamed to FableForge.

## ✨ Features

- **Store & Registry**: Browse community collections of audio characters from decentralized registries.
- **Custom Characters**: Create your own characters by importing MP3 files with drag-and-drop reordering.
- **Local Library**: Manage local collections and characters with a full CRUD editor.
- **Device Monitoring**: Real-time device connection status via background USB polling.
- **Safe Write Flow**: Write audio content to your device with a verified flow including progress tracking and overwrite confirmation.
- **Premium UI**: Modern, responsive interface with smooth transitions, dark mode support, and toast notifications.

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | [Tauri v2](https://tauri.app/) (Rust + WebView) |
| Frontend | React 19 + TypeScript |
| UI Components | Radix UI + Lucide Icons |
| State Management | Jotai v2 |
| Styling | Vanilla CSS (Modern Variables) |

## 🚀 Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) (recommended)
- Platform-specific Tauri dependencies

### Development

```bash
# Install dependencies
pnpm install

# Start development mode
pnpm tauri dev
```

### Build

```bash
# Create production build + installer (AppImage, Deb)
pnpm tauri build
```

## 📁 Project Structure

```
├── docs/                     # Project documentation (PRD, Implementation Plan)
├── src/                      # Frontend (React + TypeScript)
│   ├── components/           # UI components (Toasts, Dialogs, Layout)
│   ├── services/             # API & Device services
│   ├── stores/               # Jotai atoms
│   └── styles/               # CSS Design System
├── src-tauri/                # Backend (Rust)
│   ├── src/
│   │   ├── mki.rs            # MKI file encoding (scrambling logic)
│   │   ├── faba.rs           # Device communication & discovery
│   │   └── main.rs           # Tauri commands & event polling
│   └── Cargo.toml
└── README.md                 # This file
```

## 🤝 Contributing

1. Check the [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) for current status.
2. Follow architectural patterns defined in [AGENTS.md](AGENTS.md).
3. Ensure `cargo check` and `tsc --noEmit` pass before submitting.

## 📄 License

TBD
