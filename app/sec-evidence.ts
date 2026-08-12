const DEFAULT_SEC_USER_AGENT =
  "Trader Research Desk/1.0 research@example.com";
const SEC_CIK_FALLBACK: Record<string, string> = {
  GOOGL: "0001652044",
  GOOG: "0001652044",
  MU: "0000723125",
  ORCL: "0001341439",
  CRCL: "0001876042",
  NOK: "0000924613",
  AAOI: "0001158114",
  AXTI: "0001051627",
};
const SEC_TICKER_CACHE_MS = 6 * 60 * 60 * 1_000;

type SecTickerPayload = {
  fields?: string[];
  data?: Array<Array<string | number | null>>;
};

type SecSubmissionPayload = {
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      primaryDocument?: string[];
      items?: string[];
    };
  };
};

type SecFilingIndexPayload = {
  directory?: {
    item?: Array<{
      name?: string;
      type?: string;
      size?: string;
    }>;
  };
};

export type FilingAttachmentEvidence = {
  name: string;
  url: string;
  excerpt: string;
};

export type FilingEvidence = {
  form: string;
  filingDate: string;
  reportDate: string;
  url: string;
  excerpt: string;
  attachments: FilingAttachmentEvidence[];
};

export type SecEvidenceStatus =
  | "ok"
  | "not_applicable"
  | "ticker_unresolved"
  | "mapping_unavailable"
  | "submissions_unavailable"
  | "no_recent_filings";

export type SecEvidenceResult = {
  filings: FilingEvidence[];
  status: SecEvidenceStatus;
};

let secTickerCache:
  | {
      expiresAt: number;
      lookup: Map<string, string>;
    }
  | undefined;
let secTickerRequest: Promise<Map<string, string>> | undefined;

function stripSecHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function filingsContainManagementGuidance(
  filings: FilingEvidence[],
) {
  return filings.some((filing) =>
    [filing.excerpt, ...filing.attachments.map(({ excerpt }) => excerpt)].some(
      textContainsManagementGuidance,
    ),
  );
}

function textContainsManagementGuidance(value: string) {
  const text = stripSecHtml(value);
  const hasForwardLanguage =
    /\b(?:business outlook|company (?:currently )?expects|guidance for|current outlook|full[- ]year outlook|outlook is|fy ?20\d{2} outlook|forward[- ]looking guidance)\b/i.test(
      text,
    );
  const hasGuidanceMetric =
    /\b(?:revenue|net sales|gross margin|operating margin|operating profit|earnings per share|diluted earnings per share|eps|capital expenditures|capex)\b/i.test(
      text,
    );
  return hasForwardLanguage && hasGuidanceMetric;
}

function containsFinancialResultsEvidence(value: string) {
  const text = stripSecHtml(value);
  const hasReportingPeriod =
    /\b(?:q[1-4][’' -]?\d{2,4}|first quarter|second quarter|third quarter|fourth quarter|three months ended|six months ended|nine months ended|fiscal year|full year)\b/i.test(
      text,
    );
  const metricCount = [
    /\brevenue\b/i,
    /\bnet sales\b/i,
    /\bgross margin\b/i,
    /\boperating margin\b/i,
    /\boperating profit\b/i,
    /\bnet income\b/i,
    /\bearnings per share\b/i,
    /\bdiluted eps\b/i,
  ].filter((pattern) => pattern.test(text)).length;
  return hasReportingPeriod && metricCount >= 2;
}

const PRIMARY_FILING_KEYWORDS = [
  "consolidated statements of income",
  "consolidated statements of cash flows",
  "google cloud",
  "search & other",
  "capital expenditures",
  "purchases of property and equipment",
  "operating cash flow",
  "free cash flow",
  "consolidated balance sheets",
  "results of operations",
  "management's discussion and analysis",
  "legal proceedings",
  "risk factors",
];

const EARNINGS_RELEASE_KEYWORDS = [
  "guidance",
  "outlook",
  "revenue",
  "gross margin",
  "operating margin",
  "earnings per share",
  "hbm",
  "dram",
  "nand",
  "capital expenditures",
  "operating cash flow",
  "free cash flow",
];

function selectRelevantFilingExcerpt(
  value: string,
  limit = 18_000,
  keywords = PRIMARY_FILING_KEYWORDS,
) {
  const text = stripSecHtml(value);
  if (text.length <= limit) return text;

  const lower = text.toLowerCase();
  const selectedPositions: Array<{ keyword: string; position: number }> = [];
  for (const keyword of keywords) {
    const candidates: number[] = [];
    let cursor = 0;
    while (candidates.length < 24) {
      const position = lower.indexOf(keyword, cursor);
      if (position < 0) break;
      candidates.push(position);
      cursor = position + keyword.length;
    }
    const position =
      candidates
        .map((candidate) => {
          const context = text.slice(
            Math.max(0, candidate - 500),
            candidate + 2_800,
          );
          const numericTokens =
            context.match(/\b\d[\d,]*(?:\.\d+)?%?\b/g)?.length ?? 0;
          const dollarTokens = context.match(/\$/g)?.length ?? 0;
          const localAfter = text.slice(candidate, candidate + 1_200);
          const financialTableBonus =
            /(?:unaudited,\s*in thousands|operating activities|net cash (?:used in|provided by) operating activities|total assets|total liabilities|net income|net loss)/i.test(
              localAfter,
            )
              ? 5_000
              : 0;
          const contentsListingPenalty =
            /(?:notes to .{0,80}financial statements|item 2\.|item 3\.|item 4\.|part ii\.|signatures)/i.test(
              localAfter,
            )
            ? 250
            : 0;
          return {
            position: candidate,
            score:
              numericTokens +
              dollarTokens * 5 -
              contentsListingPenalty +
              financialTableBonus,
          };
        })
        .sort((a, b) => b.score - a.score)[0]?.position ?? -1;
    if (
      position >= 0 &&
      selectedPositions.every(
        (selected) => Math.abs(selected.position - position) > 2_400,
      )
    ) {
      selectedPositions.push({ keyword, position });
    }
    if (selectedPositions.length >= 6) break;
  }
  if (!selectedPositions.length) return text.slice(0, limit);

  const sections = [
    `[文件首页]\n${text.slice(0, 2_000)}`,
    ...selectedPositions.map(
      ({ keyword, position }) =>
        `[相关片段：${keyword}]\n${text.slice(
          Math.max(0, position - 500),
          position + 2_800,
        )}`,
    ),
  ];
  return sections.join("\n\n").slice(0, limit);
}

function isSafeDocumentName(name: string) {
  return (
    !name.includes("/") &&
    !name.includes("..") &&
    /\.(?:html?|txt)$/i.test(name)
  );
}

function looksLikeEarningsAttachmentName(name: string) {
  return (
    isSafeDocumentName(name) &&
    /(?:ex(?:hibit)?[-_]?99|ex99|press.?release|earnings|financial.?results)/i.test(
      name,
    )
  );
}

function extractExhibit99Names(indexHtml: string) {
  const names: string[] = [];
  for (const row of indexHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []) {
    if (!/\bEX-99(?:\.\d+)?\b/i.test(stripSecHtml(row))) continue;
    const link = row.match(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/i,
    )?.[1];
    if (!link) continue;
    const encodedName = link.split("/").at(-1) ?? "";
    let name = encodedName;
    try {
      name = decodeURIComponent(encodedName);
    } catch {
      name = encodedName;
    }
    if (isSafeDocumentName(name) && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

async function fetchEarningsAttachments(
  baseUrl: string,
  accession: string,
  primaryDocument: string,
  headers: Record<string, string>,
) {
  try {
    const [directoryNames, typedNames] = await Promise.all([
      (async () => {
        try {
          const response = await fetch(`${baseUrl}/index.json`, {
            headers,
            signal: AbortSignal.timeout(12_000),
          });
          if (!response.ok) return [];
          const index = (await response.json()) as SecFilingIndexPayload;
          return (index.directory?.item ?? [])
            .map((item) => item.name ?? "")
            .filter(looksLikeEarningsAttachmentName);
        } catch {
          return [];
        }
      })(),
      (async () => {
        try {
          const response = await fetch(
            `${baseUrl}/${accession}-index.html`,
            {
              headers,
              signal: AbortSignal.timeout(12_000),
            },
          );
          return response.ok
            ? extractExhibit99Names(await response.text())
            : [];
        } catch {
          return [];
        }
      })(),
    ]);
    const names = [...typedNames, ...directoryNames]
      .filter(
        (name, position, items) =>
          name !== primaryDocument && items.indexOf(name) === position,
      )
      .slice(0, 4);
    if (!names.length) return [];
    const attachments = await Promise.all(
      names.map(async (name): Promise<FilingAttachmentEvidence | null> => {
        const url = `${baseUrl}/${name}`;
        try {
          const response = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(12_000),
          });
          if (!response.ok) return null;
          const value = await response.text();
          if (
            !containsFinancialResultsEvidence(value) &&
            !textContainsManagementGuidance(value)
          ) {
            return null;
          }
          return {
            name,
            url,
            excerpt: selectRelevantFilingExcerpt(
              value,
              20_000,
              EARNINGS_RELEASE_KEYWORDS,
            ),
          };
        } catch {
          return null;
        }
      }),
    );
    return attachments.filter(
      (attachment): attachment is FilingAttachmentEvidence =>
        Boolean(attachment),
    );
  } catch {
    return [];
  }
}

function selectCoreFilingIndexes(
  recent: NonNullable<
    NonNullable<SecSubmissionPayload["filings"]>["recent"]
  >,
) {
  const forms = recent.form ?? [];
  const selected: number[] = [];
  const add = (index: number) => {
    if (index >= 0 && !selected.includes(index)) selected.push(index);
  };
  add(forms.findIndex((form) => form === "10-Q"));
  add(forms.findIndex((form) => form === "10-K" || form === "20-F"));
  add(forms.findIndex((form) => form === "8-K" || form === "6-K"));
  add(
    forms.findIndex(
      (form, index) =>
        form === "8-K" &&
        (recent.items?.[index] ?? "")
          .split(",")
          .map((item) => item.trim())
          .includes("2.02"),
    ),
  );
  return selected.sort((a, b) => a - b);
}

function filingContainsFinancialResults(filing: FilingEvidence) {
  return (
    containsFinancialResultsEvidence(filing.excerpt) ||
    filing.attachments.length > 0
  );
}

async function resolveFiling(
  recent: NonNullable<
    NonNullable<SecSubmissionPayload["filings"]>["recent"]
  >,
  index: number,
  cikWithoutPadding: string,
  headers: Record<string, string>,
) {
  const accession = recent.accessionNumber?.[index];
  const document = recent.primaryDocument?.[index];
  if (!accession || !document) return null;
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cikWithoutPadding}/${accession.replaceAll("-", "")}`;
  const url = `${baseUrl}/${document}`;
  const form = recent.form?.[index] ?? "";
  let excerpt = "";
  try {
    const filingResponse = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(12_000),
    });
    if (filingResponse.ok) {
      excerpt = selectRelevantFilingExcerpt(
        await filingResponse.text(),
        form === "8-K" || form === "6-K" ? 20_000 : 18_000,
        form === "8-K" || form === "6-K"
          ? EARNINGS_RELEASE_KEYWORDS
          : PRIMARY_FILING_KEYWORDS,
      );
    }
  } catch {
    excerpt = "";
  }
  const attachments =
    form === "8-K" || form === "6-K"
      ? await fetchEarningsAttachments(
          baseUrl,
          accession,
          document,
          headers,
        )
      : [];
  return {
    form,
    filingDate: recent.filingDate?.[index] ?? "",
    reportDate: recent.reportDate?.[index] ?? "",
    url,
    excerpt,
    attachments,
  } satisfies FilingEvidence;
}

async function findRecentFinancialResults6K(
  recent: NonNullable<
    NonNullable<SecSubmissionPayload["filings"]>["recent"]
  >,
  selectedIndexes: number[],
  cikWithoutPadding: string,
  headers: Record<string, string>,
) {
  const candidates = (recent.form ?? [])
    .map((form, index) => ({ form, index }))
    .filter(
      ({ form, index }) =>
        form === "6-K" && !selectedIndexes.includes(index),
    )
    .slice(0, 12);
  for (const { index } of candidates) {
    const filing = await resolveFiling(
      recent,
      index,
      cikWithoutPadding,
      headers,
    );
    if (filing && filingContainsFinancialResults(filing)) {
      return filing;
    }
  }
  return null;
}

async function fetchSecTickerLookup(headers: Record<string, string>) {
  if (secTickerCache && secTickerCache.expiresAt > Date.now()) {
    return secTickerCache.lookup;
  }
  if (secTickerRequest) return secTickerRequest;

  secTickerRequest = (async () => {
    const response = await fetch(
      "https://www.sec.gov/files/company_tickers_exchange.json",
      {
        headers,
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) {
      throw new Error(`SEC ticker mapping returned ${response.status}.`);
    }
    const tickers = (await response.json()) as SecTickerPayload;
    const fields = tickers.fields ?? [];
    const tickerIndex = fields.indexOf("ticker");
    const cikIndex = fields.indexOf("cik");
    if (tickerIndex < 0 || cikIndex < 0) {
      throw new Error("SEC ticker mapping is missing required fields.");
    }
    const lookup = new Map<string, string>();
    for (const row of tickers.data ?? []) {
      const ticker = String(row[tickerIndex] ?? "").toUpperCase();
      const rawCik = String(row[cikIndex] ?? "");
      if (ticker && rawCik) lookup.set(ticker, rawCik.padStart(10, "0"));
    }
    secTickerCache = {
      expiresAt: Date.now() + SEC_TICKER_CACHE_MS,
      lookup,
    };
    return lookup;
  })();

  try {
    return await secTickerRequest;
  } finally {
    secTickerRequest = undefined;
  }
}

export async function fetchSecEvidence(
  symbol: string,
): Promise<SecEvidenceResult> {
  const headers = {
    Accept: "application/json,text/html",
    "Accept-Encoding": "gzip, deflate",
    "User-Agent": process.env.SEC_USER_AGENT || DEFAULT_SEC_USER_AGENT,
  };
  let cik = SEC_CIK_FALLBACK[symbol.toUpperCase()];
  if (!cik) {
    try {
      const lookup = await fetchSecTickerLookup(headers);
      cik =
        lookup.get(symbol.toUpperCase()) ??
        lookup.get(symbol.toUpperCase().replaceAll(".", "-"));
    } catch {
      return { filings: [], status: "mapping_unavailable" };
    }
  }
  if (!cik) return { filings: [], status: "ticker_unresolved" };

  try {
    const submissionResponse = await fetch(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      {
        headers,
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!submissionResponse.ok) {
      return { filings: [], status: "submissions_unavailable" };
    }
    const submission =
      (await submissionResponse.json()) as SecSubmissionPayload;
    const recent = submission.filings?.recent;
    if (!recent?.form?.length) {
      return { filings: [], status: "no_recent_filings" };
    }
    const selectedIndexes = selectCoreFilingIndexes(recent);
    if (!selectedIndexes.length) {
      return { filings: [], status: "no_recent_filings" };
    }
    const cikWithoutPadding = String(Number(cik));
    const filings = await Promise.all(
      selectedIndexes.map((index) =>
        resolveFiling(recent, index, cikWithoutPadding, headers),
      ),
    );
    const resolved: FilingEvidence[] = filings.filter(
      (filing): filing is FilingEvidence => Boolean(filing),
    );
    const selectedSixKHasFinancialResults = selectedIndexes.some(
      (index, position) =>
        recent.form?.[index] === "6-K" &&
        filings[position] !== null &&
        filingContainsFinancialResults(filings[position]),
    );
    if (
      recent.form.includes("6-K") &&
      !selectedSixKHasFinancialResults
    ) {
      const financialResults6K = await findRecentFinancialResults6K(
        recent,
        selectedIndexes,
        cikWithoutPadding,
        headers,
      );
      if (
        financialResults6K &&
        !resolved.some((filing) => filing.url === financialResults6K.url)
      ) {
        resolved.push(financialResults6K);
      }
    }
    resolved.sort((a, b) => b.filingDate.localeCompare(a.filingDate));
    return {
      filings: resolved,
      status: resolved.length ? "ok" : "no_recent_filings",
    };
  } catch {
    return { filings: [], status: "submissions_unavailable" };
  }
}
