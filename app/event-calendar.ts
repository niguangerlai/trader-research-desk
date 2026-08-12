import type { CalendarEventTemplate } from "./types";

export const CALENDAR_EVENT_TEMPLATES: CalendarEventTemplate[] = [
  {
    id: "us-cpi",
    date: "2026-08-12",
    title: "美国 7 月 CPI",
    kind: "macro",
    impact: "high",
    preparation:
      "事件前记录核心通胀预期、2年/10年美债收益率和关键位；事件后只判断预期差与价格是否同向。",
    source: "https://www.bls.gov/schedule/news_release/cpi.htm",
    defaultSymbols: ["QQQ"],
  },
  {
    id: "us-ppi",
    date: "2026-08-13",
    title: "美国 7 月 PPI",
    kind: "macro",
    impact: "high",
    preparation:
      "事件前记录市场通胀路径；事件后观察长端利率与高估值资产是否形成一致反馈。",
    source: "https://www.bls.gov/schedule/news_release/ppi.htm",
    defaultSymbols: ["QQQ"],
  },
  {
    id: "jackson-hole",
    date: "2026-08-27",
    title: "Jackson Hole 经济政策研讨会",
    kind: "macro",
    impact: "high",
    preparation:
      "会前记录利率路径与期限溢价预期；会后优先看美债收益率、美元和相对强度，不凭讲话标题直接交易。",
    source:
      "https://www.kansascityfed.org/research/jackson-hole-economic-symposium/",
    defaultSymbols: ["QQQ"],
  },
  {
    id: "fomc",
    date: "2026-09-16",
    title: "FOMC 利率决议与经济预测",
    kind: "macro",
    impact: "high",
    preparation:
      "会前记录降息路径、点阵图与期限溢价预期；会后判断收益率、美元和风险资产是否给出同向确认。",
    source: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    defaultSymbols: ["QQQ"],
  },
];
