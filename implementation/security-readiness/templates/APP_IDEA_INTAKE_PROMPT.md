# Reusable App Security Intake Prompt

Use with any capable model when starting from an app idea, client brief, architecture document or repository. Paste this prompt, then the source material. Save the JSON as `apps/<app-id>/app-profile.json` (or run `pnpm security init <app-id>` first and replace its profile).

---

You are performing **security architecture intake**. You are not declaring the application secure.

Convert the supplied material into a JSON object matching `templates/app-profile.template.json` (schema: `framework/schemas/app-profile.schema.json`).

Rules:

1. Record only facts supported by the material.
2. Feature flags take exactly `"yes"`, `"no"` or `"unknown"`.
3. Never guess a security-sensitive capability. Incomplete evidence means `"unknown"`.
4. Distinguish implemented behavior from planned behavior; planned capabilities are `"yes"` only if the plan commits to them.
5. Put assumptions in `assumptions`, security-relevant data types in `data_notes`, and hosting/provider facts in `deployment_notes`.
6. Set `stage` to `idea`, `prototype`, `beta` or `production`.
7. List platforms in `platforms` only from: supabase, vercel, nextjs, openai, stripe.
8. Do not mark any control as passed during intake.
9. Return valid JSON matching the template exactly, with every feature key present.

Feature keys (all 23 must appear):

- `web`: Browser-delivered application surface. Ask: Is any part of the product delivered in a browser (web app, PWA, marketing site with forms)?
- `api`: Network API or server route surface. Ask: Does the product expose network endpoints (REST/GraphQL/RPC, server routes, server actions)?
- `authentication`: User or service identity is required. Ask: Do users or services sign in or present credentials?
- `oauth`: Social or third-party OAuth/OIDC login. Ask: Can users sign in with Google, Apple, Microsoft or another OAuth/OIDC provider?
- `public_signup`: Self-service or anonymous account creation open to the public. Ask: Can anyone on the internet create an account (including guest or anonymous accounts) without an invitation?
- `multi_tenant`: Data partitioned by owner/tenant. Ask: Does data belong to different users, teams, organizations or clients that must not see each other's data?
- `file_uploads`: Inbound files of any type. Ask: Can users or external systems upload files?
- `cloud_storage`: Managed/cloud persistence of user or business data. Ask: Is user or business data stored in managed databases or object storage?
- `ai`: Application invokes models. Ask: Does the product call ML, LLM, vision, speech or generative models?
- `external_ai_provider`: AI request data leaves the application's trust boundary. Ask: Does any AI request send data to a provider outside your own infrastructure (OpenAI, Anthropic, Google, a gateway)?
- `rag`: Retrieval-augmented generation. Ask: Does the product retrieve documents or records and place them into model context?
- `vector_store`: Vector/embedding storage. Ask: Are embeddings of user or business data stored in a vector index?
- `ai_tools_or_agents`: Model-initiated actions. Ask: Can a model call tools, APIs, browsers or code, or change data, on its own?
- `expensive_compute`: Operations that materially consume money/compute/quota. Ask: Can a single request cost real money or quota (model calls, OCR, transcoding, GPU, paid APIs)?
- `outbound_fetch`: Server-side requests to user-influenced destinations. Ask: Does the server fetch URLs or call hosts that a user, document or model can influence?
- `webhooks`: Inbound webhook/callback endpoints. Ask: Does the product receive inbound webhooks or callbacks from other services?
- `user_generated_content`: Content authored by one user and shown to others. Ask: Can users publish content that other users see (posts, comments, shared pages, profiles)?
- `sensitive_data`: Private or regulated data. Ask: Does the product handle personal, confidential, regulated, financial, health, student, client or proprietary data?
- `minors`: Minors as users or data subjects. Ask: Could users or data subjects be under 18 (or under 13 for COPPA)?
- `payments`: Payment processing. Ask: Does the product accept payments or handle payment data?
- `admin_console`: Privileged operator surface. Ask: Is there a privileged operator, admin or support interface?
- `third_party_integrations`: External integrations. Ask: Does the product connect to external SaaS or provider APIs on a user's behalf?
- `auxiliary_services`: Components outside the main app process. Ask: Are there separate workers, microservices, local services, queue consumers or retrieval servers?

After the JSON, add an `OPEN QUESTIONS` section listing each `"unknown"` feature, most security-significant first, with the question to ask the product owner.
