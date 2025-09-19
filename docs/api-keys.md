# API Key Permissions & Scopes

This document provides detailed information about all API keys used in bolt.diy, their minimal required permissions, and security best practices. Understanding these requirements helps you maintain better security while ensuring all features work correctly.

## Table of Contents

- [AI Provider API Keys](#ai-provider-api-keys)
- [Cloud Service Integrations](#cloud-service-integrations)
- [Version Control Integrations](#version-control-integrations)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

---

## AI Provider API Keys

These keys are used for AI model inference and chat functionality. All AI providers require API access for text generation.

### OpenAI
- **Environment Variable:** `OPENAI_API_KEY`
- **Get Key:** https://platform.openai.com/api-keys
- **Required Permissions:** Standard API access (no special scopes)
- **Usage in bolt.diy:** Text generation, code completion, chat responses
- **Rate Limits:** Varies by plan (see OpenAI documentation)
- **Security Notes:** Keep this key private; it provides access to paid API usage

### Anthropic Claude
- **Environment Variable:** `ANTHROPIC_API_KEY`
- **Get Key:** https://console.anthropic.com/
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** Alternative AI model for text generation and chat
- **Rate Limits:** Based on your Anthropic plan
- **Security Notes:** Anthropic keys have built-in safety mechanisms

### Google Gemini
- **Environment Variable:** `GOOGLE_GENERATIVE_AI_API_KEY`
- **Get Key:** https://makersuite.google.com/app/apikey
- **Required Permissions:** Generative AI API access
- **Usage in bolt.diy:** Google's AI models for text generation
- **Rate Limits:** Free tier available with limitations
- **Security Notes:** Supports both free and paid tiers

### Groq (Fast Inference)
- **Environment Variable:** `GROQ_API_KEY`
- **Get Key:** https://console.groq.com/keys
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** High-speed inference for supported models
- **Rate Limits:** Generous free tier available
- **Security Notes:** Optimized for speed; great for development

### Hugging Face
- **Environment Variable:** `HuggingFace_API_KEY`
- **Get Key:** https://huggingface.co/settings/tokens
- **Required Permissions:** 
  - **Read access** to models and datasets
  - **Inference API** access (if using hosted models)
- **Usage in bolt.diy:** Access to open-source models and inference endpoints
- **Rate Limits:** Varies by model and subscription
- **Security Notes:** Choose "Read" scope for minimal access

### Perplexity AI
- **Environment Variable:** `PERPLEXITY_API_KEY`
- **Get Key:** https://www.perplexity.ai/settings/api
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** Search-augmented language models
- **Rate Limits:** Based on subscription plan
- **Security Notes:** Provides real-time web search capabilities

### DeepSeek
- **Environment Variable:** `DEEPSEEK_API_KEY`
- **Get Key:** https://platform.deepseek.com/api_keys
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** Cost-effective coding and reasoning models
- **Rate Limits:** Competitive pricing with good free tier
- **Security Notes:** Specialized for code generation tasks

### Mistral AI
- **Environment Variable:** `MISTRAL_API_KEY`
- **Get Key:** https://console.mistral.ai/api-keys/
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** European AI provider with strong performance
- **Rate Limits:** Various tiers available
- **Security Notes:** GDPR-compliant European provider

### Together AI
- **Environment Variable:** `TOGETHER_API_KEY`
- **Get Key:** https://api.together.xyz/settings/api-keys
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** Access to various open-source models
- **Rate Limits:** Pay-per-use pricing model
- **Security Notes:** Supports many open-source models

### X.AI (Grok)
- **Environment Variable:** `XAI_API_KEY`
- **Get Key:** https://console.x.ai/
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** Access to Grok models
- **Rate Limits:** Based on X.AI pricing plans
- **Security Notes:** Relatively new provider; monitor usage

### Moonshot AI (Kimi)
- **Environment Variable:** `MOONSHOT_API_KEY`
- **Get Key:** https://platform.moonshot.ai/console/api-keys
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** Chinese AI provider with long context models
- **Rate Limits:** Varies by plan
- **Security Notes:** Specialized in long-context applications

### Cohere
- **Environment Variable:** `COHERE_API_KEY`
- **Get Key:** https://dashboard.cohere.ai/api-keys
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** Enterprise-focused language models
- **Rate Limits:** Generous free tier for development
- **Security Notes:** Strong enterprise security features

### Hyperbolic
- **Environment Variable:** `HYPERBOLIC_API_KEY`
- **Get Key:** https://app.hyperbolic.xyz/settings
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** Fast inference for various models
- **Rate Limits:** Competitive pricing model
- **Security Notes:** Focus on performance optimization

### OpenRouter
- **Environment Variable:** `OPEN_ROUTER_API_KEY`
- **Get Key:** https://openrouter.ai/keys
- **Required Permissions:** Standard API access
- **Usage in bolt.diy:** Meta-routing service for multiple AI providers
- **Rate Limits:** Depends on underlying provider
- **Security Notes:** Single key for multiple providers; monitor costs

---

## Cloud Service Integrations

These keys enable deployment and hosting features in bolt.diy.

### Vercel
- **Environment Variable:** `VITE_VERCEL_ACCESS_TOKEN`
- **Get Token:** https://vercel.com/account/tokens
- **Required Permissions:**
  - **Deploy** - Create and manage deployments
  - **Project Management** - Create, read, update projects
  - **Domain Management** - Manage custom domains (optional)
- **Usage in bolt.diy:** Deploy projects to Vercel hosting
- **Security Notes:** Scope tokens to specific teams/projects when possible

### Netlify
- **Environment Variable:** `VITE_NETLIFY_ACCESS_TOKEN`
- **Get Token:** https://app.netlify.com/user/applications
- **Required Permissions:**
  - **Site Management** - Create and deploy sites
  - **Build Hooks** - Trigger rebuilds
  - **Form Handling** - Access form submissions (if used)
- **Usage in bolt.diy:** Deploy static sites and JAMstack applications
- **Security Notes:** Regularly rotate tokens and monitor usage

### Supabase
- **Environment Variables:**
  - `VITE_SUPABASE_URL` - Your project URL
  - `VITE_SUPABASE_ANON_KEY` - Public anonymous key
  - `VITE_SUPABASE_ACCESS_TOKEN` - Management token
- **Get Keys:** https://supabase.com/dashboard → Your Project → Settings → API
- **Required Permissions:**
  - **Anonymous Key:** Public access (safe to expose)
  - **Access Token:** Full project management access
- **Usage in bolt.diy:** Database operations and backend services
- **Security Notes:** Only the anon key should be public; keep access token private

---

## Version Control Integrations

These keys enable repository management and code synchronization features.

### GitHub
- **Environment Variables:**
  - `VITE_GITHUB_ACCESS_TOKEN` - Main access token
  - `GITHUB_TOKEN` - Alternative token name
  - `GITHUB_API_KEY` - For GitHub Models API
- **Get Token:** https://github.com/settings/tokens
- **Required Permissions:**
  
  **For Classic Personal Access Tokens:**
  - ✅ **repo** - Full repository access (private and public)
  - ✅ **read:user** - Read user profile information
  - ✅ **user:email** - Access user email addresses
  
  **For Fine-grained Personal Access Tokens:**
  - ✅ **Contents** - Read/Write access to repository contents
  - ✅ **Metadata** - Read repository metadata
  - ✅ **Pull requests** - Create and manage pull requests
  - ✅ **Issues** - Create and manage issues (if using templates)

- **Usage in bolt.diy:** 
  - Import/clone repositories
  - Create branches and commits
  - Push code changes
  - Access GitHub Models API (AI)
- **Security Notes:** Use fine-grained tokens when possible; scope to specific repositories

### GitLab
- **Environment Variables:**
  - `VITE_GITLAB_ACCESS_TOKEN` - Access token
  - `VITE_GITLAB_URL` - GitLab instance URL (default: https://gitlab.com)
  - `VITE_GITLAB_TOKEN_TYPE` - Token type (default: personal-access-token)
- **Get Token:** https://gitlab.com/-/profile/personal_access_tokens
- **Required Permissions:**
  - ✅ **api** - Full API access (includes project creation)
  - ✅ **read_repository** - Clone and read repositories
  - ✅ **write_repository** - Push commits and update branches
- **Usage in bolt.diy:**
  - Import GitLab projects
  - Create new GitLab projects
  - Manage branches and commits
  - Access private repositories
- **Security Notes:** Set appropriate expiration dates; monitor project access

---

## Local Development Options

### Ollama (Local Models)
- **Environment Variable:** `OLLAMA_API_BASE_URL`
- **Default Value:** `http://127.0.0.1:11434`
- **Required Permissions:** None (local installation)
- **Usage in bolt.diy:** Run AI models locally without API costs
- **Security Notes:** Uses IPv4 (127.0.0.1) to avoid IPv6 issues
- **Setup:** Install Ollama locally and pull desired models

### LM Studio (Local Models)
- **Environment Variable:** `LMSTUDIO_API_BASE_URL`
- **Default Value:** `http://127.0.0.1:1234`
- **Required Permissions:** None (local installation)
- **Usage in bolt.diy:** Alternative local model hosting
- **Security Notes:** Enable CORS in LM Studio settings
- **Setup:** Download LM Studio and load compatible models

---

## Security Best Practices

### 🔐 API Key Management

1. **Never commit API keys to version control**
   - Use `.env.local` for local development
   - Add `.env.local` to `.gitignore` (already included)
   - Use environment variables in production

2. **Use minimal required permissions**
   - Follow the principle of least privilege
   - Regularly audit and rotate keys
   - Monitor usage and costs

3. **Secure storage**
   - Use secure environment variable management in production
   - Consider using secret management services
   - Never log or expose keys in error messages

### 🚨 Key Rotation

- **Rotate keys regularly** (every 90 days recommended)
- **Monitor for unusual usage patterns**
- **Revoke compromised keys immediately**
- **Update documentation when changing providers**

### 📊 Usage Monitoring

1. **Set up billing alerts** for paid services
2. **Monitor API usage patterns** for anomalies
3. **Track rate limit violations**
4. **Review access logs regularly**

### 🔍 Testing & Validation

- **Test with minimal permissions first**
- **Use development/staging keys when available**
- **Validate key permissions before production use**
- **Document any permission escalations needed**

---

## Troubleshooting

### Common Issues

#### ❌ "Invalid API Key" Errors
- Verify the key is correctly set in `.env.local`
- Check for extra spaces or characters
- Ensure the key hasn't expired
- Verify you're using the correct environment variable name

#### ❌ "Permission Denied" Errors
- Review required permissions for the specific service
- Check if your account has the necessary plan/subscription
- Verify token scopes match requirements
- Contact provider support if permissions seem correct

#### ❌ Rate Limit Errors
- Check your current usage against plan limits
- Implement proper rate limiting in your application
- Consider upgrading your plan or using multiple providers
- Add exponential backoff retry logic

#### ❌ CORS Issues (Local Development)
- Verify base URLs use `127.0.0.1` instead of `localhost`
- Enable CORS in local model servers (LM Studio, Ollama)
- Check that ports match your local setup

### Getting Help

1. **Check provider documentation** for specific permission requirements
2. **Review bolt.diy GitHub issues** for similar problems
3. **Test with minimal configurations** to isolate issues
4. **Use provider support channels** for key-specific problems

---

## Environment Setup

### Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Add your API keys** to `.env.local`

3. **Start with one provider** to test configuration

4. **Restart your development server:**
   ```bash
   pnpm run dev
   ```

5. **Verify connections** in Settings → Providers tab

### Production Deployment

- Use your platform's environment variable system
- Never expose API keys in client-side code (except `VITE_` prefixed public keys)
- Use secure secret management for sensitive keys
- Set up monitoring and alerting for key usage

---

*Last updated: September 2025*
*For the latest information, check the [bolt.diy repository](https://github.com/stackblitz-labs/bolt.diy)*
