# **Ideia → app rodando, com explicação e controle.**

Crie, refatore e lance aplicações full-stack por prompt, usando modelos **locais** (LM Studio/Ollama) ou **nuvem** (OpenRouter/OpenAI/Anthropic/GitHub/Google).
Planejamento por **facetas** (UI/API/Data/Test/Docs), **pipeline** com testes/análise/build e **PR reviews** automáticos.

## Por que

- **Três caminhos:** Criar do zero • Prototipar (layout/BD) • Continuar um projeto (importar pasta ou Git)
- **Prism Engine:** sua ideia vira facetas (UI/API/Data/Test/Docs) com plano → arquivos → testes
- **Queue Graph:** geração → testes → lint/typecheck → análise → build (com logs, retry e cache)
- **Deep Dives:** cada entrega importante vem com o *por quê* (trade-offs, alternativas, fontes)
- **Local + Nuvem:** roteamento inteligente (custo/latência/dados) e override manual quando quiser
- **Guard:** checklist de segurança para LLMs (OWASP LLM Top 10) como quality gate

## Provedores

- **Locais:** LM Studio (OpenAI-compatible), Ollama
- **Nuvem:** OpenRouter (vários modelos, pode ter rotas free), OpenAI, Anthropic (Claude), Google (Gemini), GitHub Models

## Como rodar (dev)

```bash
pnpm install
pnpm run dev
# abre em http://localhost:5173
```
