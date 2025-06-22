# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Docker Development (Primary)
- `docker-compose up -d app-prod` - **ALWAYS USE FOR TESTING** - Start production container (localhost:5173)
- `docker-compose up -d app-dev` - Development container with hot reload (for active development only)
- `docker-compose down` - Stop all containers
- `docker-compose build app-prod` - Build production Docker image (required after code changes)
- `docker-compose build app-dev` - Build development Docker image
- `docker logs buildify-app-prod-1 --tail 50` - View production container logs
- `docker logs buildify-app-dev-1 --tail 50` - View development container logs

### Container Commands
- `docker exec -it buildify-app-prod-1 pnpm test` - Run tests inside production container
- `docker exec -it buildify-app-prod-1 pnpm run typecheck` - Run TypeScript checking in container
- `docker exec -it buildify-app-prod-1 pnpm run lint:fix` - Fix linting issues in container
- `docker exec -it buildify-app-prod-1 bash` - Access production container shell for debugging

### Non-Docker Development (Alternative)
- `pnpm run dev` - Start development server directly (requires local Node.js setup)
- `pnpm run build` - Build the project for production
- `pnpm run preview` - Build and run production preview locally

### Environment Setup
- Copy `.env.example` to `.env.local` and configure API keys
- Required for LLM providers: Set `PROVIDER_API_KEY` (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- For local testing: Configure `BAYER_MGA_API_KEY` and `BAYER_MGA_API_BASE_URL`

## Core Architecture

### Framework & Deployment
- **Frontend**: Remix with React, running on Cloudflare Pages
- **Backend**: Cloudflare Workers with Wrangler
- **WebContainers**: Real browser-based development environment using @webcontainer/api
- **Deployment**: Cloudflare Pages, Netlify, or self-hosted Docker

### File Structure
- `app/routes/` - Remix file-based routing (API endpoints: `api.*.ts`, pages: `*.tsx`)
- `app/lib/modules/llm/` - LLM provider system with pluggable architecture
- `app/components/` - React components organized by feature
- `app/lib/.server/llm/` - Server-side LLM processing and streaming
- `app/types/` - TypeScript type definitions
- `app/utils/` - Shared utilities and constants

### LLM Provider System
The application uses a modular provider system for multiple LLM services:

- **Base Class**: `BaseProvider` in `app/lib/modules/llm/base-provider.ts`
- **Registration**: Auto-discovery via `app/lib/modules/llm/registry.ts`
- **Management**: `LLMManager` singleton handles provider instances and model lists
- **Providers**: Individual provider classes in `app/lib/modules/llm/providers/`

#### Adding New LLM Providers
1. Create provider class extending `BaseProvider`
2. Implement required methods: `getDynamicModels()`, `getModelInstance()`
3. Add to provider registry exports
4. Configure API keys in environment variables

#### Key Provider Methods
- `getDynamicModels()` - Fetch available models from provider API
- `getModelInstance()` - Create AI SDK-compatible model instance
- `getProviderBaseUrlAndKey()` - Resolve API credentials from various sources

### API Architecture
- **Main Chat**: `/api/chat` - Streaming chat with context optimization
- **LLM Calls**: `/api/llmcall` - Single-turn completions
- **Models**: `/api/models` - Available models from all providers
- **Provider Debug**: `/api/debug-[provider]` - Provider-specific testing

### Message Processing Pipeline
1. **Input**: User messages with optional file context
2. **Context Selection**: `select-context.ts` chooses relevant files
3. **Prompt Assembly**: System prompts + user context via `prompts.ts`
4. **Streaming**: `stream-text.ts` handles AI SDK streaming with provider routing
5. **Response**: Real-time streaming to frontend via Server-Sent Events

### State Management
- **Zustand**: Primary state management for chat, files, settings
- **Nanostores**: Lightweight reactive state for specific features
- **IndexedDB**: Persistence layer for chat history and file data

### WebContainer Integration
- **Purpose**: Run full Node.js environment in browser
- **Location**: `app/lib/webcontainer/`
- **Features**: Terminal access, file system, package installation, dev servers
- **Licensing**: Requires commercial license for production use

### Testing Strategy
- **Unit Tests**: Vitest for utilities and business logic
- **Type Safety**: TypeScript strict mode with comprehensive types
- **Provider Testing**: Dedicated test scripts for LLM provider validation
- **Docker Testing**: Automated container testing scripts

## Development Workflow

### Working with LLM Providers
1. **Environment**: Always test with `.env.local` containing real API keys
2. **Provider Changes**: Restart Docker containers to pick up provider modifications
3. **Model Testing**: Use provider debug endpoints for isolated testing
4. **Logs**: Monitor Docker logs for provider-specific errors

### Code Patterns
- **Logging**: Use `createScopedLogger()` for consistent logging across modules
- **Error Handling**: Graceful fallbacks for LLM provider failures
- **Type Safety**: Leverage TypeScript for API contracts and data validation
- **Performance**: Lazy loading for provider modules and model lists

### Common Tasks
- **Add Provider**: Create provider class, implement interface, add to registry
- **Debug Models**: Use `/api/debug-[provider]` endpoints with test payloads
- **Update Dependencies**: Run `pnpm install` after package.json changes
- **Container Rebuild**: Required when changing provider configurations

## Project Context

This is Buildify (bolt.diy), an open-source AI-powered web development platform that allows full-stack development in the browser. The project emphasizes:

- **Multi-LLM Support**: Extensible architecture supporting 15+ LLM providers
- **Real Development Environment**: WebContainers enable actual Node.js development
- **Community-Driven**: Open development with community contributions
- **Professional Features**: Git integration, deployment pipelines, file management

The codebase prioritizes modularity, type safety, and developer experience while maintaining compatibility with Cloudflare's edge runtime environment.