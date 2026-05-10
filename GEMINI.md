# Vibe-Fit Project Instructions & Conventions

## Project Overview
Vibe-Fit is a mobile-first, offline-first Progressive Web App (PWA) designed for personal fitness tracking. It allows users to manage workout plans, record strength and cardio sessions, view training history, and track progress. The application is designed to function entirely offline using IndexedDB, with optional cloud synchronization and user authentication.

## System Architecture
*   **Frontend**: A React-based PWA built with Vite. It handles all UI rendering, local state management (Zustand), and offline data storage (Dexie.js wrapping IndexedDB).
*   **Backend**: A Fastify-based Node.js API server. It manages user authentication, issues JWTs, and provides endpoints for syncing local data to a cloud database (currently mocked in-memory for development).
*   **Data Flow**: The frontend operates locally by default. When authenticated, it can push its complete local state to the backend or pull the latest state from the backend to overwrite the local store.

## Technology Stack
**Frontend (`/frontend`)**:
*   Framework: React 19, TypeScript, Vite
*   Routing: React Router (`react-router-dom`)
*   State Management: Zustand
*   Local Database: Dexie.js (IndexedDB wrapper)
*   UI Library: Material UI (MUI) v7
*   Validation: Zod
*   Testing: Vitest, React Testing Library
*   PWA: `vite-plugin-pwa`

**Backend (`/backend`)**:
*   Framework: Node.js, Fastify
*   Language: TypeScript
*   Authentication: `@fastify/jwt`, `bcryptjs`
*   Validation: Zod
*   Database: In-memory Mock DB (`src/mockDb.ts`) - *Pending production migration to PostgreSQL + Prisma.*

## Authentication Strategy
*   **Production Environment**: Integrate Google Login (OAuth 2.0 / Firebase Auth / Identity Platform).
*   **Development Environment**: Use mock login (mock users, temporary JWT, or local Firebase Auth Emulator). For Google OAuth testing, use a test/dev project client ID.
*   **Testing Strategy**: The backend API relies on JWT tokens. In the dev environment, generate a fixed test token or use a local mock user to authenticate. The frontend uses this token for API calls, enabling seamless local API debugging without depending on the production Google login infrastructure.

## Building and Running

**Frontend:**
```bash
cd frontend
npm install
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run test     # Run Vitest suite
```

**Backend:**
```bash
cd backend
npm install
npm run dev      # Start dev server with hot reload (tsx)
npm run build    # Compile TypeScript
npm run lint     # Run ESLint
```

## Development Conventions
*   **Strict Typing**: Use TypeScript rigorously. Define data models and API payloads using Zod schemas to ensure end-to-end type safety.
*   **Offline-First**: Treat IndexedDB as the primary source of truth. All CRUD operations must execute locally first. Cloud sync is a secondary, explicit action.
*   **Component Structure**: Avoid "God Components". Break down large pages into smaller, focused components within a `components/` subdirectory specific to that page (e.g., `src/pages/Today/components/`).
*   **State Management**: Complex or shared state (like the active training session or user settings) must reside in Zustand stores (`src/stores/`), not local component state.
