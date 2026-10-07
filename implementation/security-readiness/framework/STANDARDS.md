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

## Traceability rule

Our internal control IDs (`GMS-...`) stay stable even if a standards organization renumbers its requirements. Framework references provide context; the internal control defines what must be tested in the application.
