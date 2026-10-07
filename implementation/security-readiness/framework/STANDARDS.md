# Security Standards Reference

This framework is a practical crosswalk. It does not claim formal certification.

## Primary verification baseline

### OWASP Application Security Verification Standard (ASVS) 5.0

Use ASVS Level 2 as the primary application-security verification target for applications that handle authenticated/private user data.

https://owasp.org/www-project-application-security-verification-standard/

## API security

### OWASP API Security Top 10

Relevant to object authorization, authentication, resource consumption, business flows, SSRF, configuration and third-party API consumption.

https://owasp.org/API-Security/

## Web application risk

### OWASP Top 10

Use as risk awareness and review coverage, not as a substitute for ASVS verification.

https://owasp.org/www-project-top-ten/

## AI / LLM security

### OWASP GenAI / LLM Top 10

Relevant to prompt injection, sensitive information disclosure, supply-chain risk, improper output handling, excessive agency, system prompt leakage, vector/embedding weaknesses and unbounded consumption.

https://genai.owasp.org/llm-top-10/

## AI risk governance

### NIST AI Risk Management Framework

https://www.nist.gov/itl/ai-risk-management-framework

### NIST AI 600-1 — Generative AI Profile

https://csrc.nist.gov/pubs/ai/600/1/final

Use these for AI governance, testing, provenance, measurement, incident management and lifecycle risk.

## Secure software development

### NIST Secure Software Development Framework, SP 800-218

https://csrc.nist.gov/pubs/sp/800/218/final

Use for secure development lifecycle, provenance, release integrity, vulnerability management and organizational practices.

## Focused OWASP guidance

File Upload:
https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

Logging:
https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

Content Security Policy:
https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html

REST Security:
https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html

Software Supply Chain Security:
https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html

## Platform-specific authorization

For applications using Supabase, include RLS/service-role review:

https://supabase.com/docs/guides/database/postgres/row-level-security

## Specific reference IDs used in `standard_refs`

Controls cite specific items so a reviewer can go straight to the source text.

| Prefix | Source | Items |
|---|---|---|
| `OWASP API1:2023` … `API10:2023` | [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | API1 Broken Object Level Authorization, API2 Broken Authentication, API3 Broken Object Property Level Authorization, API4 Unrestricted Resource Consumption, API5 Broken Function Level Authorization, API6 Unrestricted Access to Sensitive Business Flows, API7 Server Side Request Forgery, API8 Security Misconfiguration, API9 Improper Inventory Management, API10 Unsafe Consumption of APIs |
| `OWASP LLM01:2025` … `LLM10:2025` | [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/) | LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain, LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses, LLM09 Misinformation, LLM10 Unbounded Consumption |
| `OWASP Top 10:2021 A01` … `A10` | [OWASP Top 10 2021](https://owasp.org/Top10/) | A01 Broken Access Control … A10 Server-Side Request Forgery |
| `NIST SSDF PO/PS/PW/RV.n` | [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) | Practice IDs, e.g. PS.1 protect code, PW.4 reuse well-secured software, RV.1 identify vulnerabilities |
| `NIST AI 600-1: <risk>` | [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) | The twelve GAI risks by name, e.g. Confabulation, Data Privacy, Information Security, Value Chain and Component Integration |
| `NIST AI RMF <FUNCTION n>` | [NIST AI RMF 1.0](https://www.nist.gov/itl/ai-risk-management-framework) | GOVERN, MAP, MEASURE, MANAGE categories |
| `RFC 9700` | [OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700) | OAuth redirect, PKCE and state guidance |
| `PCI DSS v4.0` | [PCI Security Standards Council](https://www.pcisecuritystandards.org/) | Scope reduction through hosted payment pages (SAQ A) |
| `COPPA 16 CFR Part 312` | [FTC COPPA Rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa) | 312.4 notice, 312.10 retention and deletion |
| `FERPA 34 CFR Part 99` | [Student Privacy Policy Office](https://studentprivacy.ed.gov/faq/who-school-official-under-ferpa) | School-official exception criteria |
| `GDPR Art. n` | [Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj) | Art. 5 principles, 12-15 transparency and access, 17 erasure, 20 portability, 28 processors |

Legal references (COPPA, FERPA, GDPR, PCI DSS) identify where an obligation comes from. They are not legal advice; counsel decides applicability.

## Platform production checklists

Used by `platform_guidance` and GMS-OPS-003:

- Supabase: [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Vercel: [WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), deployment protection, sensitive environment variables
- Next.js: [data security](https://nextjs.org/docs/app/guides/data-security), [content security policy](https://nextjs.org/docs/app/guides/content-security-policy)

## Traceability rule

Our internal control IDs (`GMS-...`) stay stable even if a standards organization renumbers its requirements. Framework references provide context; the internal control defines what must be tested in the application.
