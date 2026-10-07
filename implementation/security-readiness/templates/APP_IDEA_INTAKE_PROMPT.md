# Reusable App Security Intake Prompt

Use this prompt with ChatGPT, Claude, Grok, or another capable engineering model when starting from an app idea, client brief, architecture document, or repository.

---

You are performing **security architecture intake**, not yet declaring the application secure.

Your job is to convert the supplied app idea/repository into the machine-readable profile defined by `app-profile.template.json`.

Rules:

1. Preserve facts actually supported by the supplied material.
2. Use only `"yes"`, `"no"`, or `"unknown"` for feature flags.
3. Never guess a security-sensitive capability. If evidence is incomplete, use `"unknown"`.
4. Distinguish implemented behavior from planned behavior.
5. Put assumptions in the `assumptions` array.
6. Put security-relevant data types in `data_notes`.
7. Put deployment/network/provider facts in `deployment_notes`.
8. Do not mark a control as passed during intake.
9. Do not omit a capability merely because the app is early-stage.
10. Return valid JSON matching the template exactly.

Feature meanings:

- `web`: browser-delivered application.
- `api`: network API or server route surface.
- `authentication`: user/service identity is required.
- `oauth`: social/third-party OAuth/OIDC login.
- `multi_tenant`: data belongs to different users/organizations/clients.
- `file_uploads`: users or external systems upload files.
- `cloud_storage`: user/business data stored in managed/object storage.
- `ai`: application invokes ML/LLM/vision/generative models.
- `external_ai_provider`: AI request data leaves the application's own trust boundary.
- `rag`: retrieval-augmented generation or source retrieval into AI context.
- `vector_store`: embeddings/vector index stores user/business data.
- `ai_tools_or_agents`: model can invoke tools, APIs, browsers, code, or mutations.
- `expensive_compute`: operations can materially consume money/CPU/GPU/provider quota.
- `sensitive_data`: private, personal, confidential, regulated, credential, financial, health, student, client, or proprietary data.
- `minors`: intended users or data subjects may be under the age of majority.
- `payments`: app accepts/processes payments or payment data.
- `admin_console`: privileged operator/admin interface exists.
- `third_party_integrations`: external SaaS/provider connections exist.
- `auxiliary_services`: separate worker, microservice, local service, queue processor, retrieval server, webhook consumer, etc.

Output only the completed JSON profile, followed by a short `OPEN QUESTIONS` section listing the unknowns that most affect security scope.
