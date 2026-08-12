# Security policy

## Secrets

This repository does not include an LLM API key, Cloudflare credential,
database identifier, user portfolio, or cloud workspace data. Configure
secrets only through `.dev.vars` locally or your hosting provider's secret
manager in production.

If a key is ever committed, revoking and rotating it is required; removing the
text from the latest commit is not sufficient.

## Reporting a vulnerability

Please open a private GitHub security advisory for vulnerabilities that could
expose secrets, portfolio data, authentication headers, or server-side request
capabilities. Do not include real credentials or private research data in a
public issue.

## Product boundary

Trader Research Desk is a research notebook. It does not connect to a broker,
send orders, promise real-time market data, or provide investment advice.
