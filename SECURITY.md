# Security Policy

## Supported version

Security fixes are applied to the latest revision of `main`. Older revisions and
forks are not supported.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Use the
repository's **Security → Advisories → Report a vulnerability** flow and include:

- the affected revision and component;
- prerequisites and a minimal reproduction;
- the security impact and any known mitigations.

Do not include real user data, production credentials, or destructive proof of
concepts. Acknowledgement and remediation timing depend on severity and the
quality of the reproduction.

## Deployment secrets

Only GitHub Environments attached to protected `main` deployments may contain
Supabase credentials. Browser variables may contain only the Supabase project
URL and a publishable key; never commit or expose secret or service-role keys.
