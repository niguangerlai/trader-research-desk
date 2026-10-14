import type {
  Asset,
  ResearchComparison,
  ResearchSnapshot,
  ResearchVerdict,
  TechnicalLevel,
} from "./types";

const GENERATED_AT = "2026-09-30T11:00:00+08:00";
const UPDATED_AT = "2026-09-30";

type ResearchUpdate = ResearchSnapshot & {
  symbol: string;
  modifiedAt: string;
  lastComparison: ResearchComparison;
};

function liveLevels(): TechnicalLevel[] {
  return [
    { label: "短线确认", value: "页面实时20日线", role: "resistance" },
    { label: "中期防守", value: "页面实时50日线", role: "support" },
    { label: "长期趋势", value: "页面实时200日线", role: "pivot" },
  ];
}

function comparison(
  evidenceAsOf: string,
  changeSummary: string[],
  drivers: string[],
  verdicts: ResearchVerdict[],
): ResearchComparison {
  return {
    generatedAt: GENERATED_AT,
    evidenceAsOf,
    changeSummary,
    drivers,
    verdicts,
    recentNews: [],
  };
}

export const RESEARCH_UPDATES_2026_09_30: ResearchUpdate[] = [
  {
    symbol: "QQQ",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness:
      "政策证据截至2026-09-16；成分股财报证据截至2026-09-10；价格结构由页面行情动态刷新。",
    category: "type2",
    conviction: "high",
    valuationLogic:
      "QQQ仍由大型科技盈利修正、AI资本开支回报、长端利率与市场宽度共同定价。9月FOMC加息25bp至3.75%–4.00%，使久期估值门槛重新抬高；但Alphabet Cloud与Oracle OCI仍在高速增长，基本面尚未进入全面下修。",
    thesis:
      "逻辑从“等待降息缓解估值”改为“盈利增长能否跑赢重新收紧的贴现率”。因此仍归第二类：盈利主线强，但利率、集中度和资本开支回报限制估值扩张，必须等价格与市场宽度重新确认。",
    catalyst: [
      "大型科技下一轮财报继续上修收入和自由现金流",
      "长端收益率回落且QQQ重新站稳页面实时20日线",
      "上涨从少数AI龙头扩散到软件、半导体和非科技成分股",
    ],
    keyEvents: [
      {
        id: "qqq-fomc-2026-10-28",
        date: "2026-10-28",
        title: "FOMC利率决议",
        kind: "macro",
        impact: "high",
        status: "scheduled",
        preparation:
          "记录10年收益率、美元、QQQ相对50日线和市场宽度；只在价格与利率同向确认后调整风险。",
        source: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      },
    ],
    invalidation: [
      "大型科技盈利预期连续下修",
      "高利率与资本开支共同压缩自由现金流且价格跌破长期趋势",
      "指数创新高但等权与行业宽度持续恶化",
    ],
    fundamentalSignals: [
      {
        id: "qqq-fed-sep26",
        label: "政策贴现率",
        state: "negative",
        note: "9月FOMC加息25bp至3.75%–4.00%，估值扩张需要更强盈利兑现。",
      },
      {
        id: "qqq-ai-demand",
        label: "AI需求",
        state: "positive",
        note: "Alphabet Cloud与Oracle OCI/RPO仍显示企业AI基础设施需求强。",
      },
      {
        id: "qqq-breadth",
        label: "市场宽度",
        state: "warning",
        note: "必须由页面实时相对强度和行业扩散确认，不能用少数龙头替代整体趋势。",
      },
    ],
    technical: {
      trend: "价格层由页面实时行情判断；人工结论不锁死过期点位。",
      momentum: "优先观察QQQ相对等权指数、20/50日线与长端收益率的同向变化。",
      structure: "基本面强、贴现率收紧，属于需要价格二次确认的高位再定价。",
      levels: liveLevels(),
      action:
        "站稳20日线且市场宽度改善再提高风险；跌破50日线同时收益率上行，则先降低久期暴露。",
    },
    sources: [
      "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm",
      "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      "https://www.invesco.com/qqq-etf/en/about.html",
    ],
    lastComparison: comparison(
      "2026-09-16",
      [
        "改变：9月FOMC由预期观察变成已加息25bp，利率约束进一步强化。",
        "保留：指数基本面尚未全面转弱，仍不是第三类。",
      ],
      ["FOMC政策利率", "大型科技最新财报", "页面实时趋势与宽度"],
      [
        {
          claim: "利率会自然缓解成长估值压力",
          verdict: "invalidated",
          explanation: "9月FOMC实际加息，短期贴现率方向与旧假设相反。",
        },
        {
          claim: "盈利尚未进入指数级下修",
          verdict: "confirmed",
          explanation: "云与AI基础设施龙头仍披露高增长和强订单。",
        },
      ],
    ),
  },
  {
    symbol: "GOOGL",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness:
      "Alphabet Q2 2026财报与10-Q截至2026-07-23；价格结构由页面行情动态刷新。",
    category: "type2",
    conviction: "high",
    valuationLogic:
      "Alphabet的估值核心已从单纯Search防守转为Search增长、Cloud AI收入与利润、以及超大规模基础设施投入的现金回报。Q2收入1198亿美元同比增24%，Cloud收入248亿美元增82%、经营利润88亿美元；但季度资本开支449亿美元高于经营现金流391亿美元，并进行了大额股权和债务融资。",
    thesis:
      "AI商业化已经由叙事进入收入和利润验证，Search也维持17%增长；真正的争议转为资本强度、稀释和自由现金流。基本面明显增强，但估值仍需证明每一轮算力投入能持续带来高回报，因此维持第二类。",
    catalyst: [
      "Cloud高增长同时继续扩大经营利润率",
      "Search AI功能增加查询量且不牺牲广告货币化",
      "资本开支增速放缓、自由现金流重新转正",
    ],
    keyEvents: [],
    invalidation: [
      "Cloud增速或利润率明显回落",
      "Search商业查询增长被AI答案侵蚀",
      "资本开支、债务和股权融资持续快于经营现金流增长",
    ],
    fundamentalSignals: [
      {
        id: "googl-q226-growth",
        label: "收入与Search",
        state: "positive",
        note: "Q2总收入同比增24%，Search及其他收入增17%。",
      },
      {
        id: "googl-q226-cloud",
        label: "Cloud兑现",
        state: "positive",
        note: "Cloud收入增82%至247.68亿美元，经营利润升至88.14亿美元。",
      },
      {
        id: "googl-q226-fcf",
        label: "资本回报",
        state: "warning",
        note: "季度资本开支449.24亿美元，高于经营现金流390.69亿美元。",
      },
      {
        id: "googl-q226-financing",
        label: "融资与稀释",
        state: "warning",
        note: "Q2净募集约496亿美元股权资金，并发行约203亿美元净额债券。",
      },
    ],
    technical: {
      trend: "用页面实时趋势判断强基本面是否已被价格充分计入。",
      momentum: "重点看财报缺口能否守住及相对QQQ强度。",
      structure: "基本面加速与资本强度上升同时存在，不能只看Cloud增速。",
      levels: liveLevels(),
      action:
        "价格站稳20日线且相对QQQ转强才加权；若跌破50日线并伴随自由现金流预期下修，按估值出清处理。",
    },
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1652044/000165204426000066/googexhibit991q22026.htm",
      "https://www.sec.gov/Archives/edgar/data/1652044/000165204426000071/goog-20260630.htm",
    ],
    lastComparison: comparison(
      "2026-07-23",
      [
        "强化：Cloud增速和利润率显著加速，AI商业化已被财报验证。",
        "新增：大额资本开支、股权与债务融资使每股自由现金流成为核心约束。",
      ],
      ["Search收入", "Cloud收入与经营利润", "经营现金流、资本开支和融资"],
      [
        {
          claim: "AI需求能转化为Alphabet收入和利润",
          verdict: "confirmed",
          explanation: "Q2 Cloud收入和经营利润均大幅增长。",
        },
        {
          claim: "高资本开支不会影响每股现金回报",
          verdict: "open",
          explanation: "Q2资本开支超过经营现金流，仍需后续季度验证。",
        },
      ],
    ),
  },
  {
    symbol: "MU",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness:
      "Micron FQ3 2026财报截至2026-06-24；FQ4财报将在2026-09-30美股盘后发布。",
    category: "type2",
    conviction: "high",
    valuationLogic:
      "Micron仍按HBM出货、DRAM/NAND价格、位元成本和毛利率定价。FQ3验证HBM4已进入主要客户高量出货，并给出FQ4约500亿美元收入、约86%毛利率的极强指引；当前最大风险不是需求是否存在，而是今晚财报能否延续价格、产能和2027订单的高斜率。",
    thesis:
      "基本面处于景气高位，但FQ4财报是新的定价锚，不能在结果前把指引当作已兑现。维持第二类，等待实际收入、毛利率、HBM4认证与2027供需同时确认后再判断是否升级为第一类。",
    catalyst: [
      "FQ4实际收入和毛利率达到或超过指引",
      "HBM4多客户认证与2027产能锁单继续扩大",
      "DRAM/NAND价格上涨而库存和资本开支仍受控",
    ],
    keyEvents: [
      {
        id: "mu-fq4-2026",
        date: "2026-09-30",
        title: "Micron FQ4 2026财报",
        kind: "earnings",
        impact: "high",
        status: "scheduled",
        preparation:
          "核对收入、毛利率、HBM4客户认证、2027供需与资本开支；盘后价格只作反馈，不替代财报内容。",
        source:
          "https://investors.micron.com/news/press-release/2026/Micron-Technology-to-Report-Fiscal-Fourth-Quarter-Results-on-September-30-2026/default.aspx",
      },
    ],
    invalidation: [
      "FQ4收入或毛利率低于指引区间",
      "HBM4认证/出货节奏延后",
      "供给扩张快于需求并导致存储价格拐头",
    ],
    fundamentalSignals: [
      {
        id: "mu-hbm4",
        label: "HBM4量产",
        state: "positive",
        note: "FQ3披露HBM4已为主要客户平台高量出货，并向多个客户送样。",
      },
      {
        id: "mu-fq4-guide",
        label: "FQ4指引",
        state: "positive",
        note: "公司指引收入约500亿美元、毛利率约86%，盈利弹性极高。",
      },
      {
        id: "mu-event-risk",
        label: "事件风险",
        state: "warning",
        note: "FQ4财报尚未发布，旧逻辑必须在结果后重新校准。",
      },
    ],
    technical: {
      trend: "财报前价格结构仅用于仓位管理，不用于替代结果判断。",
      momentum: "重点看财报后缺口能否保留三至五个交易日。",
      structure: "高预期、高波动、单一事件重新锚定估值。",
      levels: liveLevels(),
      action:
        "财报前控制事件仓位；结果后只有基本面超预期且价格守住缺口，才确认第一类趋势。",
    },
    sources: [
      "https://investors.micron.com/news/press-release/2026/Micron-Technology-Inc--Reports-Record-Results-for-the-Third-Quarter-of-Fiscal-2026/default.aspx",
      "https://investors.micron.com/news/press-release/2026/Micron-Technology-to-Report-Fiscal-Fourth-Quarter-Results-on-September-30-2026/default.aspx",
    ],
    lastComparison: comparison(
      "2026-09-30",
      [
        "强化：HBM4已从样品阶段进入主要客户高量出货。",
        "新增：FQ4财报今天发布，所有旧判断进入事件复核。",
      ],
      ["FQ4实际值与指引", "HBM4认证与出货", "2027存储供需"],
      [
        {
          claim: "HBM4量产正在兑现",
          verdict: "confirmed",
          explanation: "FQ3官方披露主要客户平台已高量出货。",
        },
        {
          claim: "高毛利率可持续进入2027年",
          verdict: "open",
          explanation: "需要FQ4结果和2027供需指引确认。",
        },
      ],
    ),
  },
  {
    symbol: "000660",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "SK hynix Q2 2026财报截至2026-07-29；价格由页面行情动态刷新。",
    category: "type1",
    conviction: "high",
    valuationLogic:
      "SK hynix的核心定价是HBM份额、良率、封装能力、长期协议和资本纪律。Q2创纪录业绩、HBM4开始量产出货，并与约10家核心客户签订长期协议，令需求能见度从单季订单延伸到多年。",
    thesis:
      "HBM4量产、长期协议和高价值DRAM/NAND共同确认基本面上行，升级为第一类。需要警惕的是高景气下的扩产速度、竞争对手认证和存储价格峰值，而不是泛化的AI叙事。",
    catalyst: [
      "HBM4下半年顺利爬坡并扩大客户范围",
      "更多客户转为多年LTA",
      "先进DRAM/NAND价格与良率继续改善",
    ],
    keyEvents: [],
    invalidation: [
      "HBM4良率或客户认证出现延迟",
      "竞争对手份额快速提升并压低价格",
      "扩产导致2027供给明显超过锁定需求",
    ],
    fundamentalSignals: [
      {
        id: "hynix-q226",
        label: "业绩趋势",
        state: "positive",
        note: "Q2披露创纪录业绩，高价值DRAM/HBM与NAND共同驱动。",
      },
      {
        id: "hynix-hbm4",
        label: "HBM4",
        state: "positive",
        note: "HBM4在Q2开始量产出货，下半年计划继续爬坡。",
      },
      {
        id: "hynix-lta",
        label: "需求能见度",
        state: "positive",
        note: "已与约10家关键客户完成长期协议，并继续扩展谈判。",
      },
      {
        id: "hynix-capex",
        label: "资本纪律",
        state: "warning",
        note: "高利润会刺激全行业供给，需持续核对新增产能与锁单比例。",
      },
    ],
    technical: {
      trend: "基本面趋势明确向上，价格是否过热由页面实时均线与成交结构判断。",
      momentum: "观察相对韩国半导体指数和Micron的强弱变化。",
      structure: "订单能见度强，但高景气阶段波动会随估值和供给预期放大。",
      levels: liveLevels(),
      action: "回撤守住50日线且HBM4爬坡未变，可按第一类处理；跌破长期趋势并伴随供给预期上修则降级。",
    },
    sources: ["https://news.skhynix.com/en/q2-2026-business-results/"],
    lastComparison: comparison(
      "2026-07-29",
      ["升级：HBM4由认证预期进入量产出货。", "新增：约10家客户长期协议提高多年能见度。"],
      ["HBM4出货与良率", "长期协议", "先进存储价格与产能"],
      [
        {
          claim: "HBM需求已从叙事转为订单和出货",
          verdict: "confirmed",
          explanation: "公司披露HBM4量产出货和多家客户长期协议。",
        },
        {
          claim: "高景气不会诱发供给过剩",
          verdict: "open",
          explanation: "仍需跟踪2027产能、竞争份额和价格。",
        },
      ],
    ),
  },
  {
    symbol: "SNDK",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Sandisk FY2026 Q4财报截至2026-08-05；价格由页面行情动态刷新。",
    category: "type1",
    conviction: "high",
    valuationLogic:
      "Sandisk由NAND价格、数据中心组合、Kioxia供给协同和新商业模式协议定价。Q4收入89.7亿美元环比增51%，其中约三分之二增长来自价格；全年数据中心收入增437%，显示高价值组合与价格周期同时驱动。",
    thesis:
      "基本面与价格周期同步上行，升级为第一类；但当前盈利弹性高度依赖NAND定价，不能把一次高价周期永久资本化。真正的验证是数据中心占比、NBM协议和供给纪律能否降低下一轮周期波动。",
    catalyst: [
      "数据中心SSD持续高增并改善产品组合",
      "更多NBM长期协议锁定价格与需求",
      "NAND供给纪律延续、库存保持健康",
    ],
    keyEvents: [],
    invalidation: [
      "NAND价格见顶且库存回升",
      "数据中心收入增速显著落后行业",
      "Kioxia协同或新商业模式协议执行不及预期",
    ],
    fundamentalSignals: [
      {
        id: "sndk-q426-revenue",
        label: "收入与定价",
        state: "positive",
        note: "Q4收入89.7亿美元环比增51%，约三分之二增长来自价格。",
      },
      {
        id: "sndk-datacenter",
        label: "数据中心",
        state: "positive",
        note: "FY2026数据中心收入同比增437%，组合向高价值客户迁移。",
      },
      {
        id: "sndk-cycle",
        label: "周期暴露",
        state: "warning",
        note: "盈利弹性仍高度依赖NAND ASP，价格拐点会快速反向。",
      },
    ],
    technical: {
      trend: "基本面进入第一类，页面价格用于判断是否已透支周期。",
      momentum: "观察财报后高点、20日线和相对MU/WDC强度。",
      structure: "价格周期与高价值组合同时改善，但高波动不可避免。",
      levels: liveLevels(),
      action: "优先等待回撤守住20/50日线；若NAND价格转弱且股价跌破50日线，先锁定周期收益。",
    },
    sources: [
      "https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-fourth-quarter-2026-financial-results",
    ],
    lastComparison: comparison(
      "2026-08-05",
      ["升级：收入、利润和数据中心业务均给出强兑现。", "明确：当前上涨同时包含NAND提价与产品组合改善。"],
      ["NAND ASP", "数据中心收入", "NBM协议与供给纪律"],
      [
        {
          claim: "数据中心正在成为增长核心",
          verdict: "confirmed",
          explanation: "FY2026数据中心收入同比增437%。",
        },
        {
          claim: "高盈利已脱离NAND周期",
          verdict: "open",
          explanation: "Q4增长约三分之二仍来自价格。",
        },
      ],
    ),
  },
  {
    symbol: "WDC",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Western Digital FY2026 Q4财报截至2026-08-05；价格由页面行情动态刷新。",
    category: "type1",
    conviction: "high",
    valuationLogic:
      "WDC由近线HDD容量需求、单盘容量路线、云客户采购节奏、毛利率和现金流定价。Q4收入37.5亿美元同比增44%，GAAP毛利率54.1%，自由现金流12.8亿美元，说明AI数据持久化需求已经转化为盈利与现金。",
    thesis:
      "从单纯等待订单验证升级为第一类：收入、利润率和现金流同向改善。核心问题转为云客户集中度、产能纪律和单位容量价格能否持续，而不是AI数据是否需要存储。",
    catalyst: [
      "Q1 FY2027收入实现42%–49%同比增长指引",
      "高容量近线HDD出货和每盘容量继续提高",
      "自由现金流保持强劲并用于降杠杆/回购",
    ],
    keyEvents: [],
    invalidation: [
      "云客户采购延后导致容量出货下滑",
      "行业增产压低单位容量价格和毛利率",
      "自由现金流连续弱于利润增长",
    ],
    fundamentalSignals: [
      {
        id: "wdc-q426-growth",
        label: "收入增长",
        state: "positive",
        note: "Q4收入37.5亿美元，同比增44%。",
      },
      {
        id: "wdc-q426-margin",
        label: "盈利质量",
        state: "positive",
        note: "GAAP毛利率54.1%，经营杠杆明显兑现。",
      },
      {
        id: "wdc-q426-fcf",
        label: "自由现金流",
        state: "positive",
        note: "季度自由现金流12.8亿美元，现金兑现与利润同向。",
      },
    ],
    technical: {
      trend: "基本面第一类，页面实时价格决定追随还是等待回撤。",
      momentum: "重点观察财报后高点、20日线及相对存储板块强度。",
      structure: "现金流改善支撑趋势，但云客户采购具有季度波动。",
      levels: liveLevels(),
      action: "回撤守住50日线且容量/价格未变可顺趋势；若指引下修并破50日线则降级。",
    },
    sources: ["https://investor.wdc.com/node/28586"],
    lastComparison: comparison(
      "2026-08-05",
      ["升级：收入、毛利率和自由现金流形成三重确认。", "焦点转向：高景气能否跨越云客户采购波动。"],
      ["Nearline容量出货", "毛利率", "自由现金流"],
      [
        {
          claim: "AI数据存储需求正在兑现为现金流",
          verdict: "confirmed",
          explanation: "Q4自由现金流达到12.8亿美元。",
        },
        {
          claim: "高毛利率可跨周期维持",
          verdict: "open",
          explanation: "仍受客户集中、产能与价格纪律影响。",
        },
      ],
    ),
  },
  {
    symbol: "ORCL",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Oracle FY2027 Q1财报截至2026-09-10；下一次财报日期为2026-12-14。",
    category: "type2",
    conviction: "high",
    valuationLogic:
      "Oracle的估值已转为AI云订单兑现速度减去数据中心资本与融资成本。Q1收入193亿美元增30%，OCI增121%至74亿美元，RPO升至6640亿美元；但季度资本开支285亿美元、自由现金流约负54亿美元，并完成200亿美元ATM股权融资。",
    thesis:
      "订单和收入加速已经确认，但现金流、融资和交付能力成为同等重要的约束。维持第二类：好基本面不是直接追价理由，必须看到RPO转收入、产能交付与每股现金回报同步改善。",
    catalyst: [
      "OCI继续保持三位数增长且新产能按期交付",
      "RPO转收入速度快于资本开支增长",
      "自由现金流拐点明确、融资需求下降",
    ],
    keyEvents: [
      {
        id: "orcl-q2-fy27",
        date: "2026-12-14",
        title: "Oracle FY2027 Q2财报",
        kind: "earnings",
        impact: "high",
        status: "scheduled",
        preparation: "核对OCI增速、RPO转化、资本开支、融资与自由现金流。",
        source: "https://investor.oracle.com/faq/default.aspx",
      },
    ],
    invalidation: [
      "RPO增长但交付延迟、收入转化放慢",
      "资本开支持续上升且自由现金流恶化",
      "新增股权/债务融资对每股价值形成持续稀释",
    ],
    fundamentalSignals: [
      {
        id: "orcl-q127-oci",
        label: "OCI收入",
        state: "positive",
        note: "Q1 OCI收入74亿美元，同比增121%。",
      },
      {
        id: "orcl-q127-rpo",
        label: "订单能见度",
        state: "positive",
        note: "RPO达到6640亿美元，同比增加2090亿美元。",
      },
      {
        id: "orcl-q127-fcf",
        label: "自由现金流",
        state: "negative",
        note: "Q1资本开支约285亿美元，季度自由现金流约负54亿美元。",
      },
      {
        id: "orcl-q127-dilution",
        label: "融资稀释",
        state: "warning",
        note: "Q1完成约200亿美元ATM股权融资。",
      },
    ],
    technical: {
      trend: "价格需要消化订单爆发与融资/现金流压力的双重信息。",
      momentum: "观察财报缺口、20日线和相对云软件指数强度。",
      structure: "高增长、高资本强度、高融资需求并存。",
      levels: liveLevels(),
      action: "站稳20日线且现金流预期改善再加权；若跌破50日线并伴随融资扩大，先降风险。",
    },
    sources: [
      "https://investor.oracle.com/investor-news/news-details/2026/Oracle-Announces-Q1-Results-Driven-by-Triple-Digit-Growth-in-Cloud-Infrastructure-Revenues/default.aspx",
      "https://investor.oracle.com/faq/default.aspx",
    ],
    lastComparison: comparison(
      "2026-09-10",
      ["强化：OCI与RPO远超旧版订单证据。", "新增：负自由现金流与200亿美元ATM融资必须进入估值主逻辑。"],
      ["OCI收入", "RPO转化", "资本开支、自由现金流与融资"],
      [
        {
          claim: "AI云订单真实且正在转收入",
          verdict: "confirmed",
          explanation: "OCI收入增121%，RPO达6640亿美元。",
        },
        {
          claim: "增长无需持续外部融资",
          verdict: "invalidated",
          explanation: "Q1完成200亿美元ATM股权融资且自由现金流为负。",
        },
      ],
    ),
  },
  {
    symbol: "CRCL",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Circle Q2 2026财报截至2026-08-05；Arc后续采用情况待持续核验。",
    category: "type2",
    conviction: "high",
    valuationLogic:
      "Circle由USDC流通量、储备收益率、分销成本、非利息收入和Arc/支付网络价值捕获共同定价。Q2 USDC流通733亿美元增19%、链上交易量14.8万亿美元增151%，但总收入仅增7%，储备收益率降66bp至3.5%，说明规模增长仍被利率下降与分销成本部分抵消。",
    thesis:
      "网络规模和监管地位增强，但股票盈利仍高度依赖利率与储备收益。维持第二类：要从“稳定币余额乘利率”升级为平台型估值，必须看到RLDC、其他收入和Arc真实使用量持续增长。",
    catalyst: [
      "USDC流通量恢复高增长并扩大稳定币份额",
      "其他收入、CPN和Arc使用增长快于储备收益",
      "RLDC利润率保持或提升",
    ],
    keyEvents: [],
    invalidation: [
      "USDC份额持续下降或大额净赎回",
      "利率下降导致储备收入下滑且其他收入无法补位",
      "Arc采用、合规或治理风险导致预期价值无法兑现",
    ],
    fundamentalSignals: [
      {
        id: "crcl-q226-usdc",
        label: "USDC规模",
        state: "positive",
        note: "期末流通量733亿美元，同比增19%；链上交易量增151%。",
      },
      {
        id: "crcl-q226-rldc",
        label: "收入质量",
        state: "positive",
        note: "RLDC利润率41%，同比提高302bp。",
      },
      {
        id: "crcl-q226-rates",
        label: "利率敏感性",
        state: "warning",
        note: "储备收益率3.5%，同比下降66bp，总收入仅增7%。",
      },
      {
        id: "crcl-q226-arc",
        label: "平台化",
        state: "neutral",
        note: "Arc生态与机构合作明确，但真实链上使用和价值捕获仍需后续数据。",
      },
    ],
    technical: {
      trend: "股价同时交易USDC增长、利率路径与Arc期权价值。",
      momentum: "优先看20/50日线与USDC流通量变化是否同向。",
      structure: "高成长网络与利率敏感收入模型并存，波动率应高于传统支付公司。",
      levels: liveLevels(),
      action: "USDC和RLDC改善且价格站稳20日线才提高确信度；只靠Arc叙事上涨不追。",
    },
    sources: [
      "https://s206.q4cdn.com/265218871/files/doc_news/2026/Aug/05/CIRCLE_Q2-2026.pdf",
      "https://investor.circle.com/overview/default.aspx",
    ],
    lastComparison: comparison(
      "2026-08-05",
      ["确认：USDC规模与链上使用继续增长。", "转弱：储备收益率下降，收入增速明显落后于流通量。"],
      ["USDC流通量与份额", "储备收益率和RLDC", "Arc/CPN非利息收入"],
      [
        {
          claim: "USDC网络仍在扩张",
          verdict: "confirmed",
          explanation: "期末流通量增19%，链上交易量增151%。",
        },
        {
          claim: "平台收入已足以摆脱利率依赖",
          verdict: "open",
          explanation: "储备收入仍占绝大部分，其他收入规模较小。",
        },
      ],
    ),
  },
  {
    symbol: "NOK",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Nokia Q2 2026财报截至2026-07-23；Q3财报计划于2026-10-22发布。",
    category: "type1",
    conviction: "high",
    valuationLogic:
      "Nokia由光网络/IP网络AI订单、移动基础设施利润率、供应约束和制造扩张回报定价。Q2净销售额按固定汇率增9%，网络基础设施增12%，AI与Cloud客户销售增105%；可比经营利润率升至9.0%。",
    thesis:
      "AI网络需求已经从叙事变成订单和收入，升级为第一类。下一步验证是28亿欧元AI/Cloud订单能否按期转化、供应约束能否缓解，以及美国InP产能扩张能否改善长期回报。",
    catalyst: [
      "AI与Cloud订单按期转收入",
      "光网络/IP网络继续双位数增长并扩大毛利率",
      "美国光器件产能爬坡缓解供应瓶颈",
    ],
    keyEvents: [
      {
        id: "nok-q3-2026",
        date: "2026-10-22",
        title: "Nokia Q3 2026财报",
        kind: "earnings",
        impact: "high",
        status: "scheduled",
        preparation: "核对AI/Cloud订单转化、光网络增速、供应约束和利润率。",
        source:
          "https://www.nokia.com/about-us/investors/investor-relations-events/",
      },
    ],
    invalidation: [
      "AI/Cloud订单转化明显延迟",
      "供应瓶颈导致收入或毛利率下修",
      "网络基础设施增速与订单同时回落",
    ],
    fundamentalSignals: [
      {
        id: "nok-q226-ai",
        label: "AI与Cloud",
        state: "positive",
        note: "Q2相关客户销售同比增105%，订单流入28亿欧元。",
      },
      {
        id: "nok-q226-network",
        label: "网络基础设施",
        state: "positive",
        note: "固定汇率销售增12%，光网络增20%、IP网络增16%。",
      },
      {
        id: "nok-q226-margin",
        label: "利润率",
        state: "positive",
        note: "可比经营利润率9.0%，同比提高70bp。",
      },
      {
        id: "nok-q226-supply",
        label: "供给能力",
        state: "warning",
        note: "公司明确供应仍是行业主要约束，正在扩大美国InP制造与封测。",
      },
    ],
    technical: {
      trend: "基本面升级为第一类，价格需确认订单兑现未被过度提前交易。",
      momentum: "观察相对通信设备板块强度和20/50日线。",
      structure: "订单强、供应紧，回撤更适合用订单转化验证而非猜顶。",
      levels: liveLevels(),
      action: "守住50日线且Q3订单转化继续，可顺趋势；若供应问题造成指引下修则降级。",
    },
    sources: [
      "https://www.nokia.com/newsroom/nokia-corporation-report-for-q2-and-half-year-2026/",
      "https://www.nokia.com/about-us/investors/investor-relations-events/",
    ],
    lastComparison: comparison(
      "2026-07-23",
      ["升级：AI与Cloud销售增105%，订单和利润率提供双重确认。", "新增：供应能力成为增长上限和关键风险。"],
      ["AI/Cloud订单", "光网络与IP网络收入", "利润率和供应扩张"],
      [
        {
          claim: "AI网络需求正在转为收入",
          verdict: "confirmed",
          explanation: "Q2 AI与Cloud客户销售增105%。",
        },
        {
          claim: "供应不会限制订单兑现",
          verdict: "open",
          explanation: "公司仍将供应列为主要行业约束。",
        },
      ],
    ),
  },
  {
    symbol: "AAOI",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "AAOI Q2 2026财报截至2026-08-06；价格由页面行情动态刷新。",
    category: "type1",
    conviction: "high",
    valuationLogic:
      "AAOI由800G/1.6T客户认证、产能爬坡、客户集中度和毛利率定价。Q2连续第五个季度创收入纪录、800G出货环比超过翻倍，并恢复非GAAP盈利；公司预计需求至少到2027年中仍超过产能。",
    thesis:
      "订单、出货和盈利方向一致，升级为第一类。主要风险从‘有没有需求’转为‘能不能稳定生产、扩产且不牺牲毛利率’，以及单一大客户节奏。",
    catalyst: [
      "800G持续放量且1.6T进入实质收入",
      "新增产能按计划爬坡并改善毛利率",
      "客户结构扩展、集中度下降",
    ],
    keyEvents: [],
    invalidation: [
      "800G客户拉货放缓或认证延迟",
      "扩产良率不足导致毛利率恶化",
      "大客户订单取消或价格压力扩大",
    ],
    fundamentalSignals: [
      {
        id: "aaoi-q226-record",
        label: "收入趋势",
        state: "positive",
        note: "Q2为连续第五个创纪录季度。",
      },
      {
        id: "aaoi-q226-800g",
        label: "800G爬坡",
        state: "positive",
        note: "800G产品销量环比超过翻倍。",
      },
      {
        id: "aaoi-q226-profit",
        label: "盈利拐点",
        state: "positive",
        note: "公司在Q2恢复非GAAP盈利。",
      },
      {
        id: "aaoi-q226-capacity",
        label: "产能约束",
        state: "warning",
        note: "公司预计需求到2027年中仍高于产能，执行成为主要约束。",
      },
    ],
    technical: {
      trend: "基本面第一类，但小盘高波动需要价格结构配合。",
      momentum: "重点看财报后高点、20日线及成交量是否同步。",
      structure: "需求超过产能，任何良率或客户节奏变化都会放大波动。",
      levels: liveLevels(),
      action: "只在回撤守住20/50日线且产能数据未恶化时顺趋势；放量破50日线先减事件风险。",
    },
    sources: [
      "https://investors.ao-inc.com/news-releases/news-release-details/applied-optoelectronics-reports-second-quarter-2026-results",
    ],
    lastComparison: comparison(
      "2026-08-06",
      ["升级：800G放量和非GAAP盈利同时兑现。", "焦点转移：产能与良率而非需求成为主要瓶颈。"],
      ["800G/1.6T出货", "产能和良率", "客户集中度"],
      [
        {
          claim: "800G需求正在转化为收入",
          verdict: "confirmed",
          explanation: "Q2 800G销量环比超过翻倍。",
        },
        {
          claim: "扩产可以不牺牲毛利率",
          verdict: "open",
          explanation: "仍需后续季度验证产能爬坡和成本。",
        },
      ],
    ),
  },
  {
    symbol: "AXTI",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "AXT Q2 2026财报截至2026-07-30；价格由页面行情动态刷新。",
    category: "type1",
    conviction: "high",
    valuationLogic:
      "AXTI由InP衬底需求、出口许可、客户长约、产能与良率定价。Q2收入4760万美元，较Q1的2690万美元和上年同期1800万美元显著增长；GAAP毛利率升至44.9%，净利润1110万美元，显示光互联需求已穿透到上游材料。",
    thesis:
      "收入、毛利率和利润形成明确拐点，升级为第一类。由于公司规模较小且供应链/出口许可集中，估值必须给政策和产能执行留出更高折扣。",
    catalyst: [
      "InP收入继续创新高并扩大长单",
      "产能和生产效率同步提升",
      "出口许可和中国供应链不再限制交付",
    ],
    keyEvents: [],
    invalidation: [
      "出口许可延迟或客户订单取消",
      "扩产导致良率和毛利率回落",
      "InP需求未能延续至2027订单",
    ],
    fundamentalSignals: [
      {
        id: "axti-q226-revenue",
        label: "收入拐点",
        state: "positive",
        note: "Q2收入4760万美元，环比增77%、同比增164%。",
      },
      {
        id: "axti-q226-margin",
        label: "毛利率",
        state: "positive",
        note: "GAAP毛利率升至44.9%，较Q1的29.6%明显改善。",
      },
      {
        id: "axti-q226-profit",
        label: "盈利",
        state: "positive",
        note: "Q2 GAAP净利润1110万美元，由上年同期亏损转正。",
      },
      {
        id: "axti-export",
        label: "出口许可",
        state: "warning",
        note: "InP衬底出口许可仍是交付与估值折扣的关键风险。",
      },
    ],
    technical: {
      trend: "基本面进入第一类，但小盘材料股波动与流动性风险高。",
      momentum: "观察放量突破后能否守住20/50日线。",
      structure: "收入弹性大，政策与单季订单也能快速反向。",
      levels: liveLevels(),
      action: "回撤不破50日线且出口许可/订单未变可持有；政策风险升级时不等技术破位。",
    },
    sources: [
      "https://investors.axt.com/Investors/news/news-details/2026/AXT-Inc--Announces-Second-Quarter-2026-Financial-Results/default.aspx",
    ],
    lastComparison: comparison(
      "2026-07-30",
      ["升级：收入、毛利率和净利润形成三重拐点。", "保留：出口许可与供应链集中风险仍需折价。"],
      ["InP收入", "毛利率和良率", "出口许可"],
      [
        {
          claim: "AI光互联需求已传导到InP衬底",
          verdict: "confirmed",
          explanation: "Q2 InP收入和公司整体收入大幅增长。",
        },
        {
          claim: "政策风险已经消除",
          verdict: "open",
          explanation: "出口许可仍被公司列为重要不确定性。",
        },
      ],
    ),
  },
  {
    symbol: "GC=F",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "World Gold Council数据截至2026-09-18；FOMC政策截至2026-09-16。",
    category: "type1",
    conviction: "high",
    valuationLogic:
      "黄金由实际利率、美元、ETF/期货资金流、财政信用和避险需求共同定价。8月金价上涨13%，ETF与期货资金流是主驱动；9月FOMC加息、美元和收益率走强仍未破坏金价上涨，表明财政与配置需求暂时压过传统机会成本。",
    thesis:
      "结构性配置需求已经强于单一的‘降息交易’，维持第一类；但高位期权与动量拥挤使回撤风险上升。交易上要区分长期财政信用逻辑与短期资金流过热。",
    catalyst: [
      "全球黄金ETF继续净流入",
      "财政赤字/长端国债压力继续强化实物资产配置",
      "地缘风险上升但美元未同步大幅走强",
    ],
    keyEvents: [
      {
        id: "gold-fomc-2026-10-28",
        date: "2026-10-28",
        title: "FOMC利率决议",
        kind: "macro",
        impact: "high",
        status: "scheduled",
        preparation: "记录金价、美元、实际利率和ETF资金流，避免用单一利率方向解释全部波动。",
        source: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      },
    ],
    invalidation: [
      "ETF与期货资金流持续转负",
      "实际利率上行且财政信用担忧明显缓解",
      "跌破长期趋势并伴随实物需求走弱",
    ],
    fundamentalSignals: [
      {
        id: "gold-aug26-flow",
        label: "资金流",
        state: "positive",
        note: "8月ETF、期货和期权买盘共同推动金价上涨13%。",
      },
      {
        id: "gold-fed-sep26",
        label: "利率逆风",
        state: "warning",
        note: "9月FOMC加息且长端收益率偏高，传统机会成本仍存在。",
      },
      {
        id: "gold-structural",
        label: "结构性配置",
        state: "positive",
        note: "加息和美元走强未能终止上涨，显示买盘不只依赖降息。",
      },
      {
        id: "gold-crowding",
        label: "拥挤度",
        state: "warning",
        note: "期权与动量买盘强，高位波动和获利回吐风险增加。",
      },
    ],
    technical: {
      trend: "中长期趋势强，短线是否过热由页面实时价格和波动率判断。",
      momentum: "重点看金价与实际利率背离能否持续。",
      structure: "结构性配置和动量交易叠加，回撤会比普通趋势更剧烈。",
      levels: liveLevels(),
      action: "不在加速段追涨；回撤守住20/50日线且ETF未转负，可继续按第一类处理。",
    },
    sources: [
      "https://www.gold.org/goldhub/research/gold-market-commentary-august-2026",
      "https://www.gold.org/goldhub/gold-focus/2026/09/weekly-markets-monitor-all-together-now",
      "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm",
    ],
    lastComparison: comparison(
      "2026-09-18",
      ["强化：黄金在加息和美元走强下仍上涨，结构性需求强于旧版。", "新增：资金流和期权拥挤成为主要短期风险。"],
      ["ETF/期货资金流", "实际利率与美元", "财政信用与地缘风险"],
      [
        {
          claim: "黄金只依赖降息上涨",
          verdict: "invalidated",
          explanation: "9月加息后黄金仍获跨地区ETF流入并继续上涨。",
        },
        {
          claim: "结构性配置需求仍强",
          verdict: "confirmed",
          explanation: "WGC观察到跨地区ETF流入和广泛配置需求。",
        },
      ],
    ),
  },
  {
    symbol: "SI=F",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Silver Institute 2026年度展望与World Silver Survey截至2026-04；宏观政策截至2026-09-16。",
    category: "type2",
    conviction: "medium",
    valuationLogic:
      "白银同时受贵金属资金流、工业需求、矿产供给和库存释放定价。2026年预计连续第六年短缺约6700万盎司、实物投资增20%；但工业加工预计下降2%，光伏节银/替代和回收增7%限制紧缺程度。",
    thesis:
      "结构性短缺真实，但高价已开始抑制工业与消费需求，并刺激回收。维持第二类：黄金趋势提供上行背景，白银自身需要ETF/实物投资持续流入，才能抵消工业需求降温。",
    catalyst: [
      "实物投资和ETP流入持续增强",
      "数据中心、汽车需求抵消光伏节银",
      "矿山供给或回收低于预期",
    ],
    keyEvents: [],
    invalidation: [
      "工业需求下滑幅度扩大",
      "回收与矿产供给明显高于预期",
      "黄金转弱且白银ETF同步流出",
    ],
    fundamentalSignals: [
      {
        id: "silver-deficit-2026",
        label: "供需缺口",
        state: "positive",
        note: "2026年预计连续第六年短缺，缺口约6700万盎司。",
      },
      {
        id: "silver-investment-2026",
        label: "实物投资",
        state: "positive",
        note: "预计增长20%至2.27亿盎司。",
      },
      {
        id: "silver-industrial-2026",
        label: "工业需求",
        state: "warning",
        note: "预计下降2%，光伏节银与替代是主要拖累。",
      },
      {
        id: "silver-recycling-2026",
        label: "回收供给",
        state: "warning",
        note: "高价预计推动回收增长7%，缓解部分紧缺。",
      },
    ],
    technical: {
      trend: "中期受黄金带动，但自身工业基本面更分化。",
      momentum: "重点看金银比、ETF流量和页面实时20/50日线。",
      structure: "高波动的双重属性资产，不能只用供应缺口单因子定价。",
      levels: liveLevels(),
      action: "金银比改善、资金流转正且站稳20日线才提高仓位；工业数据转弱时缩短止损。",
    },
    sources: [
      "https://silverinstitute.org/global-silver-investment-to-remain-strong-in-2026-against-the-backdrop-of-a-sixth-consecutive-annual-market-deficit/",
      "https://silverinstitute.org/wp-content/uploads/2026/04/World-Silver-Survey-2026.pdf",
    ],
    lastComparison: comparison(
      "2026-09-16",
      ["保留：结构性短缺继续存在。", "下调：工业需求下降与回收增长削弱单边紧缺逻辑。"],
      ["市场缺口", "工业加工需求", "实物投资与回收"],
      [
        {
          claim: "白银结构性短缺仍在",
          verdict: "confirmed",
          explanation: "Silver Institute预计2026年连续第六年出现缺口。",
        },
        {
          claim: "工业需求会持续加速",
          verdict: "invalidated",
          explanation: "2026年工业加工预计下降2%，光伏节银构成拖累。",
        },
      ],
    ),
  },
  {
    symbol: "CL=F",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "EIA周报截至2026-09-11，STEO截至2026-09；价格由页面行情动态刷新。",
    category: "type1",
    conviction: "medium",
    valuationLogic:
      "WTI由全球供应中断、库存、炼化利润、OPEC+政策和需求弹性定价。EIA预计供应中断导致全球库存大幅下降，油价在产量恢复和库存补充前保持高位；美国馏分油库存预计9月跌破1亿桶并长期低于五年区间。",
    thesis:
      "库存与供应冲击共同支持第一类，但当前包含较高地缘溢价，确信度只给中等。只要供应恢复或高价破坏需求，逻辑会比企业盈利更快反转。",
    catalyst: [
      "全球供应中断延续",
      "美国与全球商业库存继续下降",
      "裂解价差保持强、需求未被高价明显破坏",
    ],
    keyEvents: [],
    invalidation: [
      "受扰产量快速恢复、库存连续累积",
      "高油价导致需求和炼厂开工明显下滑",
      "OPEC+意外增产并改变供需平衡",
    ],
    fundamentalSignals: [
      {
        id: "oil-eia-disruption",
        label: "供应中断",
        state: "positive",
        note: "EIA 9月STEO预计供应中断导致全球库存大幅下降。",
      },
      {
        id: "oil-distillate",
        label: "成品油库存",
        state: "positive",
        note: "EIA预计美国馏分油库存9月跌破1亿桶并维持低位。",
      },
      {
        id: "oil-geopolitical",
        label: "地缘溢价",
        state: "warning",
        note: "价格对冲突进展高度敏感，供给恢复会快速挤出溢价。",
      },
      {
        id: "oil-demand-destruction",
        label: "需求破坏",
        state: "warning",
        note: "高价若持续，将通过交通与工业需求反向压低价格。",
      },
    ],
    technical: {
      trend: "供应驱动趋势向上，但事件跳空风险高。",
      momentum: "同步观察库存、裂解价差和页面实时20/50日线。",
      structure: "地缘冲击造成的高位趋势，失效速度可能快于普通周期。",
      levels: liveLevels(),
      action: "库存继续下降且守住20日线可持有；供应恢复消息出现时先降风险，再等数据确认。",
    },
    sources: [
      "https://www.eia.gov/outlooks/steo/pdf/steo_full.pdf",
      "https://www.eia.gov/petroleum/supply/weekly/pdf/wpsrall.pdf",
    ],
    lastComparison: comparison(
      "2026-09-11",
      ["升级：全球库存下降与供应中断使短期供需明显收紧。", "新增：高价需求破坏和地缘溢价回吐是主要失效路径。"],
      ["全球供应中断", "商业库存与裂解价差", "需求弹性"],
      [
        {
          claim: "库存与供给支持油价",
          verdict: "confirmed",
          explanation: "EIA预计全球库存下降、馏分油库存低于五年区间。",
        },
        {
          claim: "地缘溢价可以长期维持",
          verdict: "open",
          explanation: "取决于受扰产量恢复速度，事件风险极高。",
        },
      ],
    ),
  },
  {
    symbol: "BTC-USD",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Binance Research数据截至2026-09-28；永续资金费率与持仓量由页面动态获取。",
    category: "type2",
    conviction: "high",
    valuationLogic:
      "BTC由ETF/机构资金流、全球流动性、长端收益率、永续杠杆和长期持有者供给定价。9月ETF流入恢复、价格收复50周均线并形成黄金交叉，但10年期收益率升至约5.17%，令反弹重新面对贴现率和流动性压力。",
    thesis:
      "趋势修复得到资金流支持，但尚未摆脱宏观利率约束，维持第二类。确认条件不是单日突破，而是ETF持续净流入、50周均线守住以及永续杠杆不过热。",
    catalyst: [
      "现货ETF持续净流入并扩大年度净流入",
      "守住50周均线且突破近期高点",
      "长端收益率回落、美元流动性改善",
    ],
    keyEvents: [],
    invalidation: [
      "跌回50周均线下方且ETF重新连续流出",
      "长端收益率继续上冲并压缩风险偏好",
      "资金费率和持仓量过热而价格无法创新高",
    ],
    fundamentalSignals: [
      {
        id: "btc-etf-sep26",
        label: "ETF资金流",
        state: "positive",
        note: "9月21日单日流入约9.99亿美元，随后高收益率环境下仍保持净流入。",
      },
      {
        id: "btc-weekly-trend",
        label: "周线趋势",
        state: "positive",
        note: "价格收复50周均线并出现9月黄金交叉。",
      },
      {
        id: "btc-yields",
        label: "宏观利率",
        state: "warning",
        note: "美国10年期收益率约5.17%，仍是反弹的主要外部压力。",
      },
      {
        id: "btc-leverage",
        label: "永续杠杆",
        state: "neutral",
        note: "由页面实时资金费率、基差和持仓量确认是否拥挤。",
      },
    ],
    technical: {
      trend: "周线趋势改善，但尚属反转确认阶段。",
      momentum: "页面实时观察50周均线、资金费率和持仓量。",
      structure: "ETF买盘与高长端收益率对冲，容易形成大幅双向波动。",
      levels: [
        { label: "周线确认", value: "页面实时50周均线", role: "support" },
        { label: "短线确认", value: "页面实时20日线", role: "pivot" },
        { label: "突破验证", value: "近期摆动高点", role: "resistance" },
      ],
      action: "ETF持续流入且守住50周线才按趋势交易；杠杆升温但价格停滞时先减仓。",
    },
    sources: [
      "https://www.binance.com/en/research/analysis/weekly-market-commentary-2026-09-28",
      "https://www.binance.com/en/blog/otc/312776731690991130",
    ],
    lastComparison: comparison(
      "2026-09-28",
      ["改善：ETF流入和50周均线同时转正。", "保留：长端收益率高企使反转尚未完全确认。"],
      ["ETF净流入", "50周均线", "长端收益率与永续杠杆"],
      [
        {
          claim: "机构需求正在回归",
          verdict: "confirmed",
          explanation: "9月出现年内最大单日ETF流入且随后仍有净流入。",
        },
        {
          claim: "BTC已完全摆脱宏观利率约束",
          verdict: "invalidated",
          explanation: "收益率上行后BTC从高位回落，利率仍影响风险偏好。",
        },
      ],
    ),
  },
  {
    symbol: "ETH-USD",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Binance机构流数据截至2026-09；Ethereum路线图页面更新于2026-08-06；永续数据动态获取。",
    category: "type2",
    conviction: "medium",
    valuationLogic:
      "ETH由ETF资金流、ETH/BTC相对强度、网络费用/销毁、质押收益、L2结算价值和升级执行定价。8月机构ETF参与改善，Glamsterdam路线图提供中长期协议催化；但必须证明网络活动能沉淀到ETH，而不是只增加L2或应用层价值。",
    thesis:
      "机构需求改善但价值捕获仍未完全验证，维持第二类、确信度中等。不能用BTC趋势自动推导ETH；升级、ETF流和ETH/BTC必须同向才构成第一类。",
    catalyst: [
      "ETH ETF持续净流入并扩大机构配置",
      "ETH/BTC形成中期更高低点",
      "Glamsterdam推进同时主网费用、销毁或质押需求改善",
    ],
    keyEvents: [],
    invalidation: [
      "ETH/BTC继续破低",
      "网络使用增长但费用/销毁和质押需求不改善",
      "升级延迟或永续杠杆过热而价格滞涨",
    ],
    fundamentalSignals: [
      {
        id: "eth-etf-aug26",
        label: "机构资金",
        state: "positive",
        note: "8月BTC与ETH现货ETF流入同步改善，机构参与有所扩散。",
      },
      {
        id: "eth-roadmap",
        label: "协议升级",
        state: "positive",
        note: "Glamsterdam仍在Ethereum长期路线图中推进。",
      },
      {
        id: "eth-value-capture",
        label: "价值捕获",
        state: "warning",
        note: "仍需验证L2和应用增长能否提高ETH费用、销毁或质押需求。",
      },
      {
        id: "eth-relative",
        label: "ETH/BTC",
        state: "neutral",
        note: "相对强度由页面行情确认，不以BTC上涨替代。",
      },
    ],
    technical: {
      trend: "趋势是否成立以ETH/BTC和美元价格同时确认为准。",
      momentum: "页面实时观察资金费率、持仓量与ETH/BTC。",
      structure: "机构流入改善，但价值捕获证据弱于BTC的稀缺资产逻辑。",
      levels: [
        { label: "美元短线", value: "页面实时20日线", role: "pivot" },
        { label: "美元防守", value: "页面实时50日线", role: "support" },
        { label: "相对确认", value: "ETH/BTC中期高点", role: "resistance" },
      ],
      action: "美元价格与ETH/BTC同时转强才增加风险；只靠高资金费率推动的上涨不追。",
    },
    sources: [
      "https://www.binance.com/en/blog/otc/312776731690991130",
      "https://ethereum.org/roadmap/glamsterdam/",
    ],
    lastComparison: comparison(
      "2026-09-28",
      ["改善：机构ETF参与较年中恢复。", "未解决：网络增长向ETH本体的价值捕获仍需证据。"],
      ["ETH ETF流量", "ETH/BTC", "费用、销毁、质押与升级"],
      [
        {
          claim: "机构对ETH需求正在恢复",
          verdict: "confirmed",
          explanation: "8月机构ETF参与明显改善。",
        },
        {
          claim: "网络增长会自动转化为ETH价值",
          verdict: "open",
          explanation: "需要费用、销毁、质押和相对强度继续验证。",
        },
      ],
    ),
  },
  {
    symbol: "GLW",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Corning Q2 2026财报截至2026-07-28；价格由页面行情动态刷新。",
    category: "type1",
    conviction: "high",
    valuationLogic:
      "Corning由AI数据中心光纤/连接需求、长期客户协议、产能扩张、利润率和自由现金流定价。Q2核心销售额47.4亿美元增17%，光通信销售增32%、企业网络增65%，核心经营利润率升至20.9%，调整后自由现金流14.2亿美元。",
    thesis:
      "AI光互联已从订单预期转为收入、利润率和现金流，维持第一类。Amazon与NVIDIA长期协议提高能见度，但大规模扩产必须继续通过ROIC和现金流验证。",
    catalyst: [
      "Amazon/NVIDIA等长期协议按期转收入",
      "光通信增速与经营利润率继续提升",
      "扩产后ROIC和自由现金流同步增长",
    ],
    keyEvents: [],
    invalidation: [
      "长期客户协议转化延迟",
      "扩产导致利润率、ROIC或现金流下滑",
      "企业网络光通信增速显著放缓",
    ],
    fundamentalSignals: [
      {
        id: "glw-q226-optical",
        label: "光通信",
        state: "positive",
        note: "Q2光通信销售增32%，企业网络增65%。",
      },
      {
        id: "glw-q226-margin",
        label: "利润率",
        state: "positive",
        note: "核心经营利润率20.9%，同比提高190bp。",
      },
      {
        id: "glw-q226-fcf",
        label: "自由现金流",
        state: "positive",
        note: "调整后自由现金流14.2亿美元。",
      },
      {
        id: "glw-expansion",
        label: "扩产回报",
        state: "warning",
        note: "美国光纤与连接产能大扩张，需要持续验证ROIC。",
      },
    ],
    technical: {
      trend: "基本面第一类，页面价格用于判断长期协议是否已被充分计价。",
      momentum: "观察20/50日线与相对通信设备板块强度。",
      structure: "长约提高能见度，扩产和估值决定回撤幅度。",
      levels: liveLevels(),
      action: "回撤守住50日线且订单转化不变可持有；利润率或ROIC下修时立即降级。",
    },
    sources: [
      "https://investor.corning.com/news-and-events/news/news-details/2026/Cornings-Strong-Second-Quarter-2026-Financial-Results1-Demonstrate-Progress-on-Recently-Upgraded-Springboard-Plan/default.aspx",
    ],
    lastComparison: comparison(
      "2026-07-28",
      ["强化：光通信、利润率和自由现金流同时增长。", "新增：Amazon/NVIDIA长约提高能见度，扩产ROIC成为新风险。"],
      ["光通信收入", "长期客户协议", "经营利润率、ROIC与自由现金流"],
      [
        {
          claim: "AI光互联需求已兑现",
          verdict: "confirmed",
          explanation: "企业网络销售增65%，并签订多项长期协议。",
        },
        {
          claim: "扩产一定提高股东回报",
          verdict: "open",
          explanation: "仍需后续ROIC和现金流数据验证。",
        },
      ],
    ),
  },
];

export const NEW_ASSETS_2026_09_30: Asset[] = [
  {
    id: "be",
    symbol: "BE",
    name: "Bloom Energy",
    market: "NYSE",
    sector: "数据中心供电 / 固体氧化物燃料电池",
    status: "watching",
    category: "type1",
    conviction: "medium",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Bloom Energy Q2 2026财报截至2026-07-28；价格由页面行情动态刷新。",
    valuationLogic:
      "BE由数据中心快速供电需求、设备交付、燃料与服务经济性、毛利率和项目融资能力定价。Q2收入10.65亿美元同比增166%，产品收入增215%，毛利率33.4%，并将全年收入指引上调至39亿–42亿美元。",
    thesis:
      "AI数据中心对‘快速上线、独立于电网扩容’的电力需求已经转化为收入和毛利率，属于第一类；但项目制收入、客户集中、燃料成本与融资需求使确信度只给中等。",
    catalyst: [
      "全年收入达到上调后的39亿–42亿美元区间",
      "数据中心客户和项目区域继续分散",
      "毛利率与经营现金流随规模同步改善",
    ],
    keyEvents: [],
    invalidation: [
      "大型项目延迟或取消导致收入回落",
      "燃料/设备成本上升压低毛利率",
      "增长依赖持续融资而经营现金流未改善",
    ],
    fundamentalSignals: [
      {
        id: "be-q226-revenue",
        label: "收入增长",
        state: "positive",
        note: "Q2收入10.65亿美元，同比增165.5%。",
      },
      {
        id: "be-q226-product",
        label: "产品交付",
        state: "positive",
        note: "产品收入9.35亿美元，同比增215.4%。",
      },
      {
        id: "be-q226-margin",
        label: "毛利率",
        state: "positive",
        note: "GAAP毛利率33.4%，同比提高668bp。",
      },
      {
        id: "be-project-risk",
        label: "项目与融资",
        state: "warning",
        note: "大项目确认节奏、客户集中和现金流仍可能造成季度波动。",
      },
    ],
    technical: {
      trend: "基本面第一类，但高增速和项目制会放大估值波动。",
      momentum: "观察财报缺口、20/50日线与成交量。",
      structure: "数据中心供电瓶颈提供强需求，执行与融资决定可持续性。",
      levels: liveLevels(),
      action: "回撤守住50日线且订单/毛利率不变可跟随；项目延期或现金流恶化时不等待技术确认。",
    },
    sources: [
      "https://investor.bloomenergy.com/press-releases/press-release-details/2026/Bloom-Energy-Reports-Record-Second-Quarter-2026-Financial-Results-and-Raises-Full-Year-2026-Guidance/default.aspx",
    ],
    lastComparison: comparison(
      "2026-07-28",
      ["新增标的：收入、产品交付和毛利率已验证数据中心供电主线。"],
      ["数据中心订单", "产品交付和毛利率", "项目现金流与融资"],
      [
        {
          claim: "数据中心供电需求正在转为收入",
          verdict: "confirmed",
          explanation: "Q2收入同比增166%，产品收入增215%。",
        },
        {
          claim: "高增长可自然转化为稳定现金流",
          verdict: "open",
          explanation: "仍需项目交付与经营现金流持续验证。",
        },
      ],
    ),
  },
  {
    id: "intc",
    symbol: "INTC",
    name: "Intel",
    market: "NASDAQ",
    sector: "CPU / Foundry / AI基础设施",
    status: "watching",
    category: "type2",
    conviction: "high",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Intel Q2 2026财报与10-Q截至2026-07-24；价格由页面行情动态刷新。",
    valuationLogic:
      "Intel由客户端/服务器CPU份额、18A良率与外部客户、Foundry利用率、先进封装和资本强度定价。Q2收入161亿美元增25%，非GAAP毛利率41.8%、EPS 0.42美元；但GAAP净亏损110亿美元，18A外部客户与Foundry经济性仍需验证。",
    thesis:
      "产品和制造执行明显改善，但会计亏损、资本需求和外部代工客户证据仍未闭环，归第二类。真正的上行不是单季收入反弹，而是18A量产、外部客户和Foundry现金回报共同成立。",
    catalyst: [
      "Panther Lake/18A良率和出货按期扩大",
      "18A-P获得可量化外部客户订单",
      "Foundry亏损收窄、资本效率改善",
    ],
    keyEvents: [],
    invalidation: [
      "18A量产、良率或客户认证延迟",
      "数据中心CPU份额继续流失",
      "Foundry资本开支持续增加但外部收入不足",
    ],
    fundamentalSignals: [
      {
        id: "intc-q226-revenue",
        label: "收入修复",
        state: "positive",
        note: "Q2收入161亿美元，同比增25%。",
      },
      {
        id: "intc-q226-margin",
        label: "经营修复",
        state: "positive",
        note: "非GAAP毛利率41.8%，非GAAP EPS 0.42美元。",
      },
      {
        id: "intc-18a",
        label: "18A进度",
        state: "positive",
        note: "18A-P进入风险生产，部分Panther Lake已进入高量制造。",
      },
      {
        id: "intc-gaap-loss",
        label: "GAAP与Foundry",
        state: "warning",
        note: "Q2 GAAP净亏损110亿美元，Foundry长期回报仍需外部客户验证。",
      },
    ],
    technical: {
      trend: "基本面修复但尚未完成代工模式验证，价格需二次确认。",
      momentum: "观察财报缺口、20/50日线和相对半导体指数强度。",
      structure: "产品周期改善与Foundry高资本投入并存。",
      levels: liveLevels(),
      action: "站稳20/50日线且18A外部订单增加才提高仓位；只靠补贴或一次性项目上涨不追。",
    },
    sources: [
      "https://www.intc.com/news-events/press-releases/detail/1776/intel-reports-second-quarter-2026-financial-results",
      "https://www.intc.com/filings-reports/quarterly-reports/content/0000050863-26-000157/0000050863-26-000157.pdf",
    ],
    lastComparison: comparison(
      "2026-07-24",
      ["新增标的：收入与非GAAP利润修复明确，但Foundry回报尚未闭环。"],
      ["CPU份额", "18A良率与外部客户", "Foundry亏损和资本效率"],
      [
        {
          claim: "Intel产品与制造执行正在改善",
          verdict: "confirmed",
          explanation: "Q2收入、非GAAP利润和18A进度均改善。",
        },
        {
          claim: "Foundry商业模式已被外部客户验证",
          verdict: "open",
          explanation: "仍缺少足够的外部18A量产收入和现金回报证据。",
        },
      ],
    ),
  },
  {
    id: "tem",
    symbol: "TEM",
    name: "Tempus AI",
    market: "NASDAQ",
    sector: "精准医疗 / 医疗AI / 分子诊断",
    status: "watching",
    category: "type1",
    conviction: "medium",
    modifiedAt: GENERATED_AT,
    updatedAt: UPDATED_AT,
    dataFreshness: "Tempus Q2 2026财报截至2026-07-30；产品动态截至2026-09-28。",
    valuationLogic:
      "TEM由肿瘤诊断量、单测经济性、数据许可增长、AI产品监管审批、并购整合和现金消耗定价。Q2收入3.825亿美元增22%，肿瘤诊断量增31%，Insights收入增36%，并签订约2亿美元新数据与应用许可。",
    thesis:
      "诊断量和数据许可都在增长，且FDA产品审批增加，符合第一类；但并购整合、偿付政策、负债和盈利质量尚未完全验证，因此确信度只给中等。",
    catalyst: [
      "肿瘤诊断量维持30%以上增长并改善单测利润",
      "约2亿美元新许可按期转收入",
      "FDA批准产品商业化且并购协同兑现",
    ],
    keyEvents: [],
    invalidation: [
      "诊断量增长放缓或报销价格受压",
      "数据许可签约未能转收入",
      "并购整合推高现金消耗、债务或稀释",
    ],
    fundamentalSignals: [
      {
        id: "tem-q226-revenue",
        label: "收入增长",
        state: "positive",
        note: "Q2收入3.825亿美元，同比增22%。",
      },
      {
        id: "tem-q226-volume",
        label: "诊断量",
        state: "positive",
        note: "肿瘤诊断量同比增31%，MRD测试量环比由6500升至9000。",
      },
      {
        id: "tem-q226-data",
        label: "数据许可",
        state: "positive",
        note: "Insights收入增36%，新签约数据与应用许可约2亿美元。",
      },
      {
        id: "tem-integration",
        label: "并购与盈利",
        state: "warning",
        note: "多项并购扩大平台，但整合成本、债务和GAAP盈利仍需验证。",
      },
    ],
    technical: {
      trend: "基本面第一类，但医疗AI高估值需要持续业绩确认。",
      momentum: "观察FDA/合作消息后的缺口能否守住20/50日线。",
      structure: "高增长诊断与数据资产并存，监管和并购会放大波动。",
      levels: liveLevels(),
      action: "诊断量、许可收入与价格同向才加权；并购或融资推动的上涨不替代盈利验证。",
    },
    sources: [
      "https://investors.tempus.com/news-releases/news-release-details/tempus-reports-second-quarter-2026-results",
      "https://investors.tempus.com/",
    ],
    lastComparison: comparison(
      "2026-09-28",
      ["新增标的：诊断量、数据许可和FDA产品进展构成增长闭环初步证据。"],
      ["肿瘤诊断量与报销", "数据许可转收入", "并购整合与现金消耗"],
      [
        {
          claim: "医疗AI已转化为业务增长",
          verdict: "confirmed",
          explanation: "诊断量、Insights收入和新许可均增长。",
        },
        {
          claim: "并购扩张一定提高每股价值",
          verdict: "open",
          explanation: "仍需整合成本、现金流和稀释数据验证。",
        },
      ],
    ),
  },
];
