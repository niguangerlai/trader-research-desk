import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchSecEvidence,
  filingsContainManagementGuidance,
} from "../app/sec-evidence.ts";

test("uses Alphabet's official CIK and a declared SEC user agent", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requestedUrls.push(url);
    const headers = new Headers(init?.headers);
    assert.match(headers.get("user-agent") ?? "", /.+@.+/);

    if (url.includes("/submissions/CIK0001652044.json")) {
      return Response.json({
        filings: {
          recent: {
            form: ["10-Q"],
            filingDate: ["2026-07-23"],
            reportDate: ["2026-06-30"],
            accessionNumber: ["0001652044-26-000071"],
            primaryDocument: ["goog-20260630.htm"],
          },
        },
      });
    }
    if (url.includes("/Archives/edgar/data/1652044/")) {
      return new Response(
        `<html><body>Alphabet quarterly filing ${"cover ".repeat(
          4_000,
        )} CONSOLIDATED STATEMENTS OF INCOME Revenue 96,428 Google Cloud revenue 13,624</body></html>`,
      );
    }
    return new Response("Unexpected URL", { status: 500 });
  };

  try {
    const result = await fetchSecEvidence("GOOGL");
    assert.equal(result.status, "ok");
    assert.equal(result.filings.length, 1);
    assert.equal(result.filings[0].form, "10-Q");
    assert.match(result.filings[0].excerpt, /Alphabet quarterly filing/);
    assert.match(result.filings[0].excerpt, /Revenue 96,428/);
    assert.equal(
      requestedUrls.some((url) => url.includes("company_tickers_exchange")),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports a ticker mapping outage instead of claiming no filings exist", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Forbidden", { status: 403 });

  try {
    const result = await fetchSecEvidence("UNMAPPED-TEST");
    assert.equal(result.status, "mapping_unavailable");
    assert.deepEqual(result.filings, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reads an earnings press release attached to an 8-K", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/submissions/CIK0000723125.json")) {
      return Response.json({
        filings: {
          recent: {
            form: ["8-K"],
            filingDate: ["2026-06-24"],
            reportDate: ["2026-06-24"],
            accessionNumber: ["0000723125-26-000013"],
            primaryDocument: ["mu-20260624.htm"],
          },
        },
      });
    }
    if (url.endsWith("/index.json")) {
      return Response.json({
        directory: {
          item: [
            { name: "mu-20260624.htm" },
            { name: "a2026q3ex991-pressrelease.htm" },
            { name: "report.css" },
          ],
        },
      });
    }
    if (url.endsWith("/a2026q3ex991-pressrelease.htm")) {
      return new Response(
        `<html><body>${"cover ".repeat(
          4_000,
        )} Business Outlook. Guidance for the fourth quarter: revenue $20.0 billion, gross margin 50%, EPS $4.50. HBM demand remains strong.</body></html>`,
      );
    }
    if (url.endsWith("/mu-20260624.htm")) {
      return new Response("<html><body>8-K cover page</body></html>");
    }
    return new Response("Unexpected URL", { status: 500 });
  };

  try {
    const result = await fetchSecEvidence("MU");
    assert.equal(result.status, "ok");
    assert.equal(result.filings[0].form, "8-K");
    assert.equal(result.filings[0].attachments.length, 1);
    assert.equal(
      result.filings[0].attachments[0].name,
      "a2026q3ex991-pressrelease.htm",
    );
    assert.match(result.filings[0].attachments[0].excerpt, /revenue \$20\.0/);
    assert.match(result.filings[0].attachments[0].excerpt, /gross margin 50%/);
    assert.equal(filingsContainManagementGuidance(result.filings), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keeps the latest 8-K and also reads an older earnings 8-K", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/submissions/CIK0001158114.json")) {
      return Response.json({
        filings: {
          recent: {
            form: ["8-K", "10-Q", "8-K", "10-K"],
            filingDate: [
              "2026-07-01",
              "2026-05-07",
              "2026-05-07",
              "2026-02-26",
            ],
            reportDate: [
              "2026-06-25",
              "2026-03-31",
              "2026-05-07",
              "2025-12-31",
            ],
            accessionNumber: [
              "0001683168-26-005221",
              "0001437749-26-015620",
              "0001683168-26-003562",
              "0001437749-26-005875",
            ],
            primaryDocument: [
              "latest-8k.htm",
              "quarterly.htm",
              "earnings-8k.htm",
              "annual.htm",
            ],
            items: ["1.01,2.03,9.01", "", "2.02,9.01", ""],
          },
        },
      });
    }
    if (
      url.endsWith(
        "/0001683168-26-003562-index.html",
      )
    ) {
      return new Response(`
        <table>
          <tr>
            <td>2</td><td>PRESS RELEASE</td>
            <td><a href="/Archives/quarterly-release.htm">quarterly-release.htm</a></td>
            <td>EX-99.1</td><td>90000</td>
          </tr>
        </table>
      `);
    }
    if (
      url.endsWith(
        "/0001683168-26-005221-index.html",
      )
    ) {
      return new Response(`
        <table>
          <tr>
            <td>2</td><td>DIRECTOR APPOINTMENT RELEASE</td>
            <td><a href="/Archives/director-release.htm">director-release.htm</a></td>
            <td>EX-99.1</td><td>12000</td>
          </tr>
        </table>
      `);
    }
    if (url.endsWith("/quarterly-release.htm")) {
      return new Response(
        "<html><body>First quarter revenue was $151 million and gross margin was 29%. Second Quarter 2026 Business Outlook. The company currently expects revenue of $180 million to $198 million and gross margin of 29% to 30%.</body></html>",
      );
    }
    if (url.endsWith("/director-release.htm")) {
      return new Response(
        "<html><body>The company appointed a new independent director to its board.</body></html>",
      );
    }
    if (url.endsWith("/index.json")) {
      return Response.json({ directory: { item: [] } });
    }
    if (url.endsWith("-index.html")) {
      return new Response("<html><body>No earnings exhibits</body></html>");
    }
    if (url.endsWith("/latest-8k.htm")) {
      return new Response(
        "<html><body>Credit agreement amendment and financing update.</body></html>",
      );
    }
    if (url.endsWith("/earnings-8k.htm")) {
      return new Response("<html><body>8-K earnings cover page.</body></html>");
    }
    if (url.endsWith("/quarterly.htm")) {
      return new Response(
        "<html><body>First quarter revenue and consolidated statements of income.</body></html>",
      );
    }
    if (url.endsWith("/annual.htm")) {
      return new Response(
        "<html><body>Fiscal year consolidated statements of income and cash flows.</body></html>",
      );
    }
    return new Response("Unexpected URL", { status: 500 });
  };

  try {
    const result = await fetchSecEvidence("AAOI");
    assert.equal(result.status, "ok");
    assert.equal(
      result.filings.filter((filing) => filing.form === "8-K").length,
      2,
    );
    assert.equal(
      result.filings.find((filing) => filing.filingDate === "2026-07-01")
        ?.attachments.length,
      0,
    );
    const earnings = result.filings.find((filing) =>
      filing.attachments.some(
        (attachment) => attachment.name === "quarterly-release.htm",
      ),
    );
    assert.ok(earnings);
    assert.match(
      earnings.attachments[0].excerpt,
      /revenue of \$180 million to \$198 million/,
    );
    assert.equal(filingsContainManagementGuidance(result.filings), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("finds a financial-results 6-K behind a newer routine 6-K", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/submissions/CIK0000924613.json")) {
      return Response.json({
        filings: {
          recent: {
            form: ["6-K", "6-K", "20-F"],
            filingDate: ["2026-07-27", "2026-07-23", "2026-03-05"],
            reportDate: ["2026-07-27", "2026-07-23", "2025-12-31"],
            accessionNumber: [
              "0001104659-26-086848",
              "0001104659-26-086081",
              "0001628280-26-015034",
            ],
            primaryDocument: [
              "manager-transactions.htm",
              "q2-results.htm",
              "annual.htm",
            ],
            items: ["", "", ""],
          },
        },
      });
    }
    if (url.endsWith("/index.json")) {
      return Response.json({ directory: { item: [] } });
    }
    if (url.endsWith("-index.html")) {
      return new Response("<html><body>No exhibits</body></html>");
    }
    if (url.endsWith("/manager-transactions.htm")) {
      return new Response(
        "<html><body>Notification of managers' transactions.</body></html>",
      );
    }
    if (url.endsWith("/q2-results.htm")) {
      return new Response(
        "<html><body>Q2 2026 net sales grew 9%. Gross margin was 46%. Operating margin was 9%. Full-year outlook is for operating profit of EUR 2.1 to 2.6 billion.</body></html>",
      );
    }
    if (url.endsWith("/annual.htm")) {
      return new Response(
        "<html><body>Fiscal year net sales, operating profit and consolidated financial statements.</body></html>",
      );
    }
    return new Response("Unexpected URL", { status: 500 });
  };

  try {
    const result = await fetchSecEvidence("NOK");
    assert.equal(result.status, "ok");
    assert.equal(
      result.filings.filter((filing) => filing.form === "6-K").length,
      2,
    );
    assert.equal(
      result.filings.some((filing) =>
        filing.excerpt.includes("Q2 2026 net sales grew 9%"),
      ),
      true,
    );
    assert.equal(filingsContainManagementGuidance(result.filings), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("prefers a financial statement table over its table-of-contents entry", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/submissions/CIK0001158114.json")) {
      return Response.json({
        filings: {
          recent: {
            form: ["10-Q"],
            filingDate: ["2026-05-07"],
            reportDate: ["2026-03-31"],
            accessionNumber: ["0001437749-26-015620"],
            primaryDocument: ["quarterly.htm"],
            items: [""],
          },
        },
      });
    }
    if (url.endsWith("/quarterly.htm")) {
      return new Response(
        `<html><body>
          Table of Contents: Condensed Consolidated Statements of Cash Flows
          ${"page 1 $10 ".repeat(300)}
          ${"narrative padding ".repeat(1_400)}
          CONDENSED CONSOLIDATED STATEMENTS OF CASH FLOWS
          Net cash used in operating activities was $85.4 million.
          Purchase of property, plant and equipment was $58.2 million.
          ${"financial detail $100 ".repeat(300)}
        </body></html>`,
      );
    }
    return new Response("Unexpected URL", { status: 500 });
  };

  try {
    const result = await fetchSecEvidence("AAOI");
    assert.equal(result.status, "ok");
    assert.match(
      result.filings[0].excerpt,
      /Net cash used in operating activities was \$85\.4 million/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
