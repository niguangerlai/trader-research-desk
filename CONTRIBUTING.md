# Contributing

Thanks for helping improve Trader Research Desk.

## Before opening a pull request

1. Create a focused branch.
2. Keep credentials, portfolios, exported workspaces and deployment IDs out of
   the repository.
3. Preserve the evidence boundary: never present missing, delayed or inferred
   market data as verified fact.
4. Run:

   ```bash
   npm ci
   npm run lint
   npm test
   ```

5. Explain the investor workflow affected by the change and the evidence used
   to validate it.

## Areas where contributions are especially useful

- additional audited market-data adapters;
- company disclosure parsers outside the SEC;
- investor-facing research and portfolio-risk views;
- accessibility and mobile improvements;
- authentication adapters for self-hosted workspace sync;
- tests for source outages, partial evidence and model-output failures.

Do not add broker order submission without first discussing the security,
authorization, audit and regulatory boundary in an issue.
