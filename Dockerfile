# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# CI-friendly env
ENV HUSKY=0
ENV CI=true

# Use pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Accept (optional) build-time public URL for Remix/Vite (Coolify can pass it)
ARG VITE_PUBLIC_APP_URL
ENV VITE_PUBLIC_APP_URL=${VITE_PUBLIC_APP_URL}

# Install deps efficiently
COPY package.json pnpm-lock.yaml* ./
RUN pnpm fetch

# Copy source and build
COPY . .
# install with dev deps (needed to build)
RUN pnpm install --offline --frozen-lockfile

# Build the Remix app (SSR + client)
RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm run build

# Keep only production deps for runtime
RUN pnpm prune --prod --ignore-scripts


# ---- production stage ----
FROM build AS bolt-ai-production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5173
ENV HOST=0.0.0.0

# Production environment variables
ARG GROQ_API_KEY
ARG HuggingFace_API_KEY
ARG OPENAI_API_KEY
ARG ANTHROPIC_API_KEY
ARG OPEN_ROUTER_API_KEY
ARG GOOGLE_GENERATIVE_AI_API_KEY
ARG OLLAMA_API_BASE_URL
ARG XAI_API_KEY
ARG TOGETHER_API_KEY
ARG TOGETHER_API_BASE_URL
ARG AWS_BEDROCK_CONFIG
ARG DEEPSEEK_API_KEY
ARG LMSTUDIO_API_BASE_URL
ARG MISTRAL_API_KEY
ARG PERPLEXITY_API_KEY
ARG OPENAI_LIKE_API_KEY
ARG OPENAI_LIKE_API_BASE_URL
ARG OPENAI_LIKE_API_MODELS
ARG VITE_LOG_LEVEL=debug
ARG DEFAULT_NUM_CTX

ENV WRANGLER_SEND_METRICS=false \
    GROQ_API_KEY=${GROQ_API_KEY} \
    HuggingFace_API_KEY=${HuggingFace_API_KEY} \
    OPENAI_API_KEY=${OPENAI_API_KEY} \
    ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} \
    OPEN_ROUTER_API_KEY=${OPEN_ROUTER_API_KEY} \
    GOOGLE_GENERATIVE_AI_API_KEY=${GOOGLE_GENERATIVE_AI_API_KEY} \
    OLLAMA_API_BASE_URL=${OLLAMA_API_BASE_URL} \
    XAI_API_KEY=${XAI_API_KEY} \
    TOGETHER_API_KEY=${TOGETHER_API_KEY} \
    TOGETHER_API_BASE_URL=${TOGETHER_API_BASE_URL} \
    AWS_BEDROCK_CONFIG=${AWS_BEDROCK_CONFIG} \
    DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY} \
    LMSTUDIO_API_BASE_URL=${LMSTUDIO_API_BASE_URL} \
    MISTRAL_API_KEY=${MISTRAL_API_KEY} \
    PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY} \
    OPENAI_LIKE_API_KEY=${OPENAI_LIKE_API_KEY} \
    OPENAI_LIKE_API_BASE_URL=${OPENAI_LIKE_API_BASE_URL} \
    OPENAI_LIKE_API_MODELS=${OPENAI_LIKE_API_MODELS} \
    VITE_LOG_LEVEL=${VITE_LOG_LEVEL} \
    DEFAULT_NUM_CTX=${DEFAULT_NUM_CTX} \
    RUNNING_IN_DOCKER=true

# Install curl for healthchecks and copy bindings script
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# Copy built files and scripts
COPY --from=build /app/build /app/build
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/bindings.sh /app/bindings.sh

# Pre-configure wrangler to disable metrics
RUN mkdir -p /root/.config/.wrangler && \
    echo '{"enabled":false}' > /root/.config/.wrangler/metrics.json

# Make bindings script executable
RUN chmod +x /app/bindings.sh

EXPOSE 5173

# Healthcheck for deployment platforms
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD curl -fsS http://localhost:5173/ || exit 1

# Start using dockerstart script with Wrangler
CMD ["pnpm", "run", "dockerstart"]


# ---- development stage ----
FROM build AS development

# Define the same environment variables for development
ARG GROQ_API_KEY
ARG HuggingFace_API_KEY
ARG OPENAI_API_KEY
ARG ANTHROPIC_API_KEY
ARG OPEN_ROUTER_API_KEY
ARG GOOGLE_GENERATIVE_AI_API_KEY
ARG OLLAMA_API_BASE_URL
ARG XAI_API_KEY
ARG TOGETHER_API_KEY
ARG TOGETHER_API_BASE_URL
ARG AWS_BEDROCK_CONFIG
ARG DEEPSEEK_API_KEY
ARG LMSTUDIO_API_BASE_URL
ARG MISTRAL_API_KEY
ARG PERPLEXITY_API_KEY
ARG OPENAI_LIKE_API_KEY
ARG OPENAI_LIKE_API_BASE_URL
ARG OPENAI_LIKE_API_MODELS
ARG VITE_LOG_LEVEL=debug
ARG DEFAULT_NUM_CTX

ENV GROQ_API_KEY=${GROQ_API_KEY} \
    HuggingFace_API_KEY=${HuggingFace_API_KEY} \
    OPENAI_API_KEY=${OPENAI_API_KEY} \
    ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} \
    OPEN_ROUTER_API_KEY=${OPEN_ROUTER_API_KEY} \
    GOOGLE_GENERATIVE_AI_API_KEY=${GOOGLE_GENERATIVE_AI_API_KEY} \
    OLLAMA_API_BASE_URL=${OLLAMA_API_BASE_URL} \
    XAI_API_KEY=${XAI_API_KEY} \
    TOGETHER_API_KEY=${TOGETHER_API_KEY} \
    TOGETHER_API_BASE_URL=${TOGETHER_API_BASE_URL} \
    AWS_BEDROCK_CONFIG=${AWS_BEDROCK_CONFIG} \
    DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY} \
    LMSTUDIO_API_BASE_URL=${LMSTUDIO_API_BASE_URL} \
    MISTRAL_API_KEY=${MISTRAL_API_KEY} \
    PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY} \
    OPENAI_LIKE_API_KEY=${OPENAI_LIKE_API_KEY} \
    OPENAI_LIKE_API_BASE_URL=${OPENAI_LIKE_API_BASE_URL} \
    OPENAI_LIKE_API_MODELS=${OPENAI_LIKE_API_MODELS} \
    VITE_LOG_LEVEL=${VITE_LOG_LEVEL} \
    DEFAULT_NUM_CTX=${DEFAULT_NUM_CTX} \
    RUNNING_IN_DOCKER=true

RUN mkdir -p /app/run
CMD ["pnpm", "run", "dev", "--host"]
