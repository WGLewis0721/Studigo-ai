# Intake questions: Studigo

Answer each question with **yes**, **no** or **unknown** in `app-profile.json` under `features`.
Unknown is allowed. It keeps the affected controls in `needs_review` and shows up as a scope action until answered.

| # | Feature key | Question | Current answer | Controls it activates |
|---|---|---|---|---|
| 1 | `web` | Is any part of the product delivered in a browser (web app, PWA, marketing site with forms)? | yes | GMS-API-003, GMS-WEB-001, GMS-WEB-002 |
| 2 | `api` | Does the product expose network endpoints (REST/GraphQL/RPC, server routes, server actions)? | yes | GMS-ACCESS-001, GMS-API-001, GMS-API-002, GMS-API-003, GMS-API-004 |
| 3 | `authentication` | Do users or services sign in or present credentials? | yes | GMS-AUTH-001, GMS-AUTH-003, GMS-API-003 |
| 4 | `oauth` | Can users sign in with Google, Apple, Microsoft or another OAuth/OIDC provider? | yes | GMS-AUTH-002 |
| 5 | `public_signup` | Can anyone on the internet create an account (including guest or anonymous accounts) without an invitation? | yes | GMS-AUTH-004, GMS-API-002, GMS-PRIV-004 |
| 6 | `multi_tenant` | Does data belong to different users, teams, organizations or clients that must not see each other's data? | yes | GMS-AUTH-001, GMS-ACCESS-001, GMS-ACCESS-002, GMS-RAG-001 |
| 7 | `file_uploads` | Can users or external systems upload files? | yes | GMS-FILE-001, GMS-FILE-002, GMS-FILE-003, GMS-FILE-004, GMS-FILE-005 |
| 8 | `cloud_storage` | Is user or business data stored in managed databases or object storage? | yes | GMS-ACCESS-002, GMS-FILE-005, GMS-PRIV-001, GMS-OPS-002 |
| 9 | `ai` | Does the product call ML, LLM, vision, speech or generative models? | yes | GMS-API-002, GMS-WEB-002, GMS-AI-001, GMS-AI-002, GMS-AI-003, GMS-AI-005, GMS-AI-006, GMS-AI-007, GMS-LOG-002 |
| 10 | `external_ai_provider` | Does any AI request send data to a provider outside your own infrastructure (OpenAI, Anthropic, Google, a gateway)? | yes | GMS-AI-007, GMS-PRIV-003 |
| 11 | `rag` | Does the product retrieve documents or records and place them into model context? | yes | GMS-AI-001, GMS-RAG-001, GMS-RAG-002, GMS-RAG-003 |
| 12 | `vector_store` | Are embeddings of user or business data stored in a vector index? | yes | GMS-RAG-001, GMS-RAG-003 |
| 13 | `ai_tools_or_agents` | Can a model call tools, APIs, browsers or code, or change data, on its own? | no | GMS-API-005, GMS-AI-004 |
| 14 | `expensive_compute` | Can a single request cost real money or quota (model calls, OCR, transcoding, GPU, paid APIs)? | yes | GMS-API-002, GMS-FILE-003, GMS-AI-007 |
| 15 | `outbound_fetch` | Does the server fetch URLs or call hosts that a user, document or model can influence? | no | GMS-API-005 |
| 16 | `webhooks` | Does the product receive inbound webhooks or callbacks from other services? | no | GMS-API-006 |
| 17 | `user_generated_content` | Can users publish content that other users see (posts, comments, shared pages, profiles)? | no | GMS-WEB-002, GMS-AI-008 |
| 18 | `sensitive_data` | Does the product handle personal, confidential, regulated, financial, health, student, client or proprietary data? | yes | GMS-GOV-002, GMS-AUTH-001, GMS-AI-005, GMS-PRIV-001, GMS-PRIV-003, GMS-PRIV-004, GMS-LOG-002, GMS-OPS-002 |
| 19 | `minors` | Could users or data subjects be under 18 (or under 13 for COPPA)? | yes | GMS-GOV-002, GMS-AI-008, GMS-PRIV-002, GMS-PRIV-004 |
| 20 | `payments` | Does the product accept payments or handle payment data? | no | GMS-API-006, GMS-PAY-001 |
| 21 | `admin_console` | Is there a privileged operator, admin or support interface? | no | GMS-AUTH-005 |
| 22 | `third_party_integrations` | Does the product connect to external SaaS or provider APIs on a user's behalf? | yes | GMS-PRIV-003 |
| 23 | `auxiliary_services` | Are there separate workers, microservices, local services, queue consumers or retrieval servers? | yes | GMS-ACCESS-003 |

Also record, in the profile:

- `platforms`: hosting/backend/AI/payment platforms in use (supabase, vercel, nextjs, openai, stripe) to get platform-specific guidance.
- `data_notes`: each kind of personal or sensitive data.
- `deployment_notes`: where it runs and which providers receive data.
- `assumptions`: anything you assumed rather than confirmed.
