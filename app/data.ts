import type { Asset, CategoryDefinition } from "./types";
import { CALENDAR_EVENT_TEMPLATES } from "./event-calendar.ts";

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: "type1",
    short: "第一类",
    title: "基本面向上，价格确认",
    description:
      "订单、盈利预期和价格趋势同时改善。上涨不是只靠叙事，市场正在持续提高盈利与估值假设。",
    action: "顺趋势处理回撤；失效点放在盈利预期转弱或关键趋势破位。",
  },
  {
    id: "type2",
    short: "第二类",
    title: "基本面尚强，估值与仓位出清",
    description:
      "需求或财报仍然强，但好消息无法继续抬高股价。市场在消化拥挤仓位、估值或资本回报率担忧。",
    action: "不凭利好抄底；等待重新站回关键均线、相对强度转正和好消息能够留住涨幅。",
  },
  {
    id: "type3",
    short: "第三类",
    title: "基本面与价格共同下修",
    description:
      "订单、价格、毛利率或盈利预期开始下降，同时估值继续压缩，形成盈利与倍数双杀。",
    action: "等待盈利预测停止下修；反弹默认视为减仓窗口，直到基本面领先指标企稳。",
  },
  {
    id: "unclassified",
    short: "待分类",
    title: "证据不足",
    description:
      "目前没有足够信息判断是趋势、估值出清还是基本面下行。",
    action: "先补订单、财报指引、行业价格和技术结构，不用观点填补数据空白。",
  },
];

export const DEFAULT_ASSETS: Asset[] = [
  {
    id: "qqq",
    symbol: "QQQ",
    name: "Invesco QQQ",
    market: "NASDAQ",
    sector: "指数 / 大型科技",
    status: "watching",
    category: "type2",
    conviction: "high",
    updatedAt: "2026-07-22",
    dataFreshness: "日线数据截至 2026-07-22 收盘",
    valuationLogic:
      "QQQ的定价取决于成分股盈利增速、长端利率、风险溢价和市场宽度。当前盈利并未整体崩塌，但市场开始要求AI资本开支证明自由现金流回报。",
    thesis:
      "长期趋势仍在200日线上方，短线跌破20日与50日均线。当前更像长期上升趋势中的中级别调整，而不是已经确认的熊市。",
    catalyst: [
      "大型科技财报继续上修盈利预期",
      "指数重新站上20日与50日均线",
      "半导体与软件的市场宽度同步修复",
    ],
    keyEvents: [
      ...CALENDAR_EVENT_TEMPLATES.filter((event) =>
        event.defaultSymbols.includes("QQQ"),
      ).map((event) => ({
        id: `qqq-${event.id}-${event.date}`,
        date: event.date,
        title: event.title,
        kind: event.kind,
        impact: event.impact,
        status: "scheduled" as const,
        preparation: event.preparation,
        source: event.source,
      })),
    ],
    invalidation: [
      "放量跌破686.76并无法快速收回",
      "100日线670附近失守",
      "盈利预期开始连续下修",
    ],
    fundamentalSignals: [
      {
        id: "qqq-earnings",
        label: "盈利预期",
        state: "positive",
        note: "大型科技需求仍强，尚未出现指数级盈利塌陷。",
      },
      {
        id: "qqq-valuation",
        label: "估值压力",
        state: "warning",
        note: "AI资本开支转向ROIC与自由现金流审查。",
      },
      {
        id: "qqq-price",
        label: "价格确认",
        state: "negative",
        note: "收于705.35，低于20日线714.25和50日线719.17。",
      },
    ],
    technical: {
      trend: "长期上升，中期调整，短线弱反弹",
      momentum: "RSI(14)约46.7，未进入极端超卖",
      structure:
        "6月初748.65附近见高后形成降低的高点；7月17日下探686.76后反弹，但反弹成交量不足。",
      levels: [
        { label: "第一阻力", value: "714–719", role: "resistance" },
        { label: "确认区", value: "719–725", role: "resistance" },
        { label: "核心支撑", value: "695–686.76", role: "support" },
        { label: "100日线", value: "670.04", role: "support" },
        { label: "200日线", value: "642.35", role: "pivot" },
      ],
      action:
        "站回719并保持，才算修复；放量跌破686.76，先看670。区间中部不适合追逐短期期权。",
    },
    sources: ["Nasdaq QQQ历史行情", "本对话技术推演"],
  },
  {
    id: "googl",
    symbol: "GOOGL",
    name: "Alphabet",
    market: "NASDAQ",
    sector: "云计算 / 广告 / AI",
    status: "watching",
    category: "type2",
    conviction: "high",
    updatedAt: "2026-07-22",
    dataFreshness: "Q2 2026财报与电话会",
    valuationLogic:
      "核心定价是Search现金牛能否继续增长、Cloud增速与利润率，以及巨额AI资本开支最终能否转化为自由现金流。单看收入增长不足以决定估值。",
    thesis:
      "需求和商业化强，但自由现金流转负、资本开支继续上修。股票面临的不是AI需求消失，而是市场提高了对投资回报率的要求。",
    catalyst: [
      "Cloud积压订单转化为收入与现金流",
      "AI搜索提高查询量且不侵蚀广告货币化",
      "资本开支增速放缓而收入仍保持高增",
    ],
    invalidation: [
      "Search增速与份额同时恶化",
      "Cloud增速降温且利润率回落",
      "折旧与能源成本持续压制经营利润",
    ],
    fundamentalSignals: [
      {
        id: "googl-cloud",
        label: "Cloud需求",
        state: "positive",
        note: "收入同比增长82%至247.7亿美元，积压订单5140亿美元。",
      },
      {
        id: "googl-search",
        label: "Search",
        state: "positive",
        note: "Search与其他收入增长17%，AI功能暂未摧毁核心广告引擎。",
      },
      {
        id: "googl-fcf",
        label: "自由现金流",
        state: "negative",
        note: "经营现金流390.7亿美元，资本开支449.2亿美元，季度FCF约为负58.6亿美元。",
      },
      {
        id: "googl-capex",
        label: "资本开支",
        state: "warning",
        note: "全年指引升至1950亿–2050亿美元，2027年预计继续显著增长。",
      },
    ],
    technical: {
      trend: "财报后进入好基本面、弱价格反应的第二类",
      momentum: "盘后下跌反映市场先交易现金流与资本回报压力",
      structure:
        "后续需要观察正式交易日能否收复财报缺口，以及相对QQQ是否重新转强。",
      levels: [
        { label: "事件锚点", value: "7/22收盘", role: "pivot" },
        { label: "确认方式", value: "收复财报缺口", role: "resistance" },
        { label: "失效方式", value: "反弹缩量且再破低", role: "support" },
      ],
      action:
        "不能用Cloud高增直接追Call；等待坏消息跌不动或重新收复缺口，才是价格确认。",
    },
    sources: ["Alphabet Q2 2026财报", "Alphabet Q2 2026电话会"],
  },
  {
    id: "mu",
    symbol: "MU",
    name: "Micron",
    market: "NASDAQ",
    sector: "HBM / DRAM / NAND",
    status: "watching",
    category: "type2",
    conviction: "high",
    updatedAt: "2026-07-22",
    dataFreshness: "逻辑框架；价格与订单需刷新",
    valuationLogic:
      "盈利主要由HBM出货、DRAM/NAND ASP、位元成本和毛利率共同决定。市场不会只交易AI服务器数量，还交易存储价格是否接近周期峰值。",
    thesis:
      "Google资本开支上调验证AI需求，但不能直接证明存储ASP继续加速。当前属于需求尚强、估值与拥挤仓位出清。",
    catalyst: [
      "HBM订单与认证继续上修",
      "DRAM合约价继续上涨且库存保持健康",
      "毛利率指引持续高于市场预期",
    ],
    invalidation: [
      "HBM增量订单放缓",
      "DRAM现货与合约价转跌",
      "扩产导致2027–2028供给预期显著上升",
    ],
    fundamentalSignals: [
      {
        id: "mu-demand",
        label: "AI需求",
        state: "positive",
        note: "超大规模云厂商资本开支仍在增长。",
      },
      {
        id: "mu-asp",
        label: "ASP持续性",
        state: "warning",
        note: "市场开始担心价格和毛利率接近周期高点。",
      },
      {
        id: "mu-price",
        label: "价格反应",
        state: "warning",
        note: "利好能够带来盘后上涨，但尚不足以完成板块重定价。",
      },
    ],
    technical: {
      trend: "第二类出清，等待重新确认相对强度",
      momentum: "好消息只带来有限涨幅，说明上方供应仍重",
      structure:
        "观察正式盘能否守住盘后涨幅，并跑赢SOXX与QQQ。",
      levels: [
        { label: "第一确认", value: "守住财报后涨幅", role: "pivot" },
        { label: "趋势确认", value: "收复20日/50日线", role: "resistance" },
        { label: "风险信号", value: "好消息高开低走", role: "support" },
      ],
      action:
        "先看相对强度与收盘，不依据Google总CapEx单独追涨。",
    },
    sources: ["Micron财报", "Hyperscaler资本开支", "DRAM/HBM价格与订单"],
  },
  {
    id: "skhynix",
    symbol: "000660",
    name: "SK hynix",
    market: "KRX",
    sector: "HBM / DRAM / NAND",
    status: "watching",
    category: "type2",
    conviction: "high",
    updatedAt: "2026-07-23",
    dataFreshness: "逻辑框架；韩股价格需刷新",
    valuationLogic:
      "海力士的核心定价来自HBM份额、客户认证、供货价格、先进封装能力和扩产回报。HBM领先可以支撑盈利，但高估值需要持续上修而不仅是维持高景气。",
    thesis:
      "基本面仍强，但高拥挤仓位、融资与扩产预期令价格对利好钝化。当前更像多头仓位出清，而非已经确认的需求崩塌。",
    catalyst: [
      "HBM4认证与客户份额继续领先",
      "2027产能预售和价格继续上修",
      "韩国本地股与美股存储同步恢复相对强度",
    ],
    invalidation: [
      "客户认证或份额明显丢失",
      "HBM价格与毛利率指引转弱",
      "扩产速度超过需求增长",
    ],
    fundamentalSignals: [
      {
        id: "hynix-hbm",
        label: "HBM领导力",
        state: "positive",
        note: "仍是AI服务器存储中最直接的受益环节之一。",
      },
      {
        id: "hynix-position",
        label: "仓位结构",
        state: "negative",
        note: "估值与拥挤度较高，利好容易被兑现。",
      },
      {
        id: "hynix-capacity",
        label: "扩产风险",
        state: "warning",
        note: "需要持续跟踪2027–2028供给增长而非只看当前售罄。",
      },
    ],
    technical: {
      trend: "多头出清阶段，尚未完成趋势修复",
      momentum: "波动放大，好消息响应减弱",
      structure:
        "若利好日无法跑赢韩国半导体指数，说明主动买盘仍弱。",
      levels: [
        { label: "相对强度", value: "对KOSPI半导体转正", role: "pivot" },
        { label: "趋势确认", value: "收复关键均线", role: "resistance" },
        { label: "风险信号", value: "利好日继续破低", role: "support" },
      ],
      action:
        "把‘需求强’与‘股价见底’分开；等待价格先确认。",
    },
    sources: ["SK hynix财报与订单", "HBM认证进度", "韩国交易所价格"],
  },
  {
    id: "sndk",
    symbol: "SNDK",
    name: "SanDisk",
    market: "NASDAQ",
    sector: "NAND / 企业级SSD",
    status: "watching",
    category: "type2",
    conviction: "medium",
    updatedAt: "2026-07-22",
    dataFreshness: "逻辑框架；价格与NAND数据需刷新",
    valuationLogic:
      "核心变量是NAND ASP、企业级SSD份额、位元出货、渠道库存和毛利率。AI资本开支对企业SSD有帮助，但映射弱于HBM。",
    thesis:
      "Google提高资本开支是二阶利好；服务器投入并不等于NAND采购同比例增长。",
    catalyst: [
      "企业级SSD订单与产品认证上修",
      "NAND合约价持续上涨",
      "毛利率改善快于位元成本变化",
    ],
    invalidation: [
      "NAND现货与合约价转弱",
      "渠道库存上升",
      "企业SSD份额或认证不及预期",
    ],
    fundamentalSignals: [
      {
        id: "sndk-enterprise",
        label: "企业SSD",
        state: "positive",
        note: "AI数据中心扩张提供需求支撑。",
      },
      {
        id: "sndk-mapping",
        label: "CapEx映射",
        state: "warning",
        note: "Google服务器预算优先流向加速器、网络和HBM。",
      },
      {
        id: "sndk-cycle",
        label: "NAND周期",
        state: "warning",
        note: "供给纪律和价格持续性仍是决定利润的核心。",
      },
    ],
    technical: {
      trend: "需求验证，但价格确认不足",
      momentum: "盘后反应弱于HBM/DRAM方向",
      structure: "观察是否能在正式盘守住利好涨幅并扩大成交量。",
      levels: [
        { label: "第一确认", value: "守住事件日涨幅", role: "pivot" },
        { label: "趋势确认", value: "跑赢MU与SOXX", role: "resistance" },
        { label: "风险信号", value: "高开低走", role: "support" },
      ],
      action: "不要把NAND当作HBM交易；订单和价格数据优先于总CapEx。",
    },
    sources: ["SanDisk财报", "NAND合约价", "企业SSD订单"],
  },
  {
    id: "wdc",
    symbol: "WDC",
    name: "Western Digital",
    market: "NASDAQ",
    sector: "Nearline HDD",
    status: "watching",
    category: "type2",
    conviction: "medium",
    updatedAt: "2026-07-22",
    dataFreshness: "逻辑框架；价格与出货需刷新",
    valuationLogic:
      "分拆后WDC更偏HDD。核心变量是云厂商Nearline需求、exabyte出货、单位容量成本、价格和供应纪律。",
    thesis:
      "AI数据中心最终会增加冷数据与近线存储，但传导慢于GPU、HBM和网络。",
    catalyst: [
      "Nearline exabyte出货增长",
      "云客户订单能见度提高",
      "价格与毛利率保持纪律",
    ],
    invalidation: [
      "云客户库存消化拉长",
      "单位价格转弱",
      "供应增长快于exabyte需求",
    ],
    fundamentalSignals: [
      {
        id: "wdc-cloud",
        label: "云存储需求",
        state: "positive",
        note: "AI工作负载增加长期数据保存需求。",
      },
      {
        id: "wdc-lag",
        label: "传导时滞",
        state: "warning",
        note: "总CapEx上调不会立即转化为HDD收入。",
      },
      {
        id: "wdc-price",
        label: "定价纪律",
        state: "neutral",
        note: "需由公司订单与毛利率指引验证。",
      },
    ],
    technical: {
      trend: "事件驱动小幅受益，仍需验证",
      momentum: "相对HBM反应较弱属于合理映射",
      structure: "正式盘守住涨幅比盘后瞬时价格更重要。",
      levels: [
        { label: "确认", value: "事件日收盘强于SOXX", role: "pivot" },
        { label: "风险", value: "利好日冲高回落", role: "support" },
      ],
      action: "等待云订单和exabyte数据，不用AI叙事代替HDD周期数据。",
    },
    sources: ["Western Digital财报", "Nearline出货", "云厂商存储订单"],
  },
  {
    id: "orcl",
    symbol: "ORCL",
    name: "Oracle",
    market: "NYSE",
    sector: "云基础设施 / 软件",
    status: "watching",
    category: "type2",
    conviction: "medium",
    updatedAt: "2026-07-23",
    dataFreshness: "逻辑框架；财报数据需刷新",
    valuationLogic:
      "Oracle的定价核心是OCI收入、剩余履约义务转化速度、数据中心资本开支、融资成本和自由现金流，而不是单看合同总额。",
    thesis:
      "订单能见度强，但巨额基础设施投入与融资会放大执行风险。属于高增长能见度与现金流压力并存。",
    catalyst: [
      "RPO按计划转化为OCI收入",
      "云收入增长快于折旧和利息",
      "自由现金流拐点提前",
    ],
    invalidation: [
      "数据中心交付延误",
      "融资成本上升",
      "RPO转化明显慢于指引",
    ],
    fundamentalSignals: [
      {
        id: "orcl-rpo",
        label: "订单能见度",
        state: "positive",
        note: "RPO与AI云合同提供中期收入基础。",
      },
      {
        id: "orcl-funding",
        label: "融资与CapEx",
        state: "warning",
        note: "增长需要持续投入，现金流与资产负债表是估值约束。",
      },
      {
        id: "orcl-execution",
        label: "交付执行",
        state: "neutral",
        note: "关键不在签约，而在容量交付和收入确认。",
      },
    ],
    technical: {
      trend: "高波动增长股，价格需要验证资本开支回报",
      momentum: "对融资、利率与CapEx新闻敏感",
      structure: "观察财报缺口、20日线与相对QQQ表现。",
      levels: [
        { label: "确认", value: "财报缺口上方收稳", role: "resistance" },
        { label: "风险", value: "好订单、弱股价", role: "support" },
      ],
      action: "订单只完成第一步；必须继续验证交付、收入、现金流和价格反应。",
    },
    sources: ["Oracle财报", "OCI增长与RPO", "资本开支与融资"],
  },
  {
    id: "crcl",
    symbol: "CRCL",
    name: "Circle",
    market: "NYSE",
    sector: "稳定币 / 金融科技",
    status: "watching",
    category: "unclassified",
    conviction: "pending",
    updatedAt: "2026-07-23",
    dataFreshness: "逻辑框架；利率与USDC数据需刷新",
    valuationLogic:
      "Circle的核心不是简单的‘稳定币普及’，而是USDC流通量、储备收益率、分销分成、非利息收入和监管框架共同决定单位经济。",
    thesis:
      "USDC增长可以推高储备收入，但降息会压低单位储备收益；估值必须拆成流通量增长与利率敏感性。",
    catalyst: [
      "USDC流通量和市场份额提高",
      "非利息收入占比提升",
      "监管明确并扩大机构采用",
    ],
    invalidation: [
      "USDC份额下降",
      "降息快于流通量增长",
      "分销与渠道成本吞噬储备收益",
    ],
    fundamentalSignals: [
      {
        id: "crcl-supply",
        label: "USDC流通量",
        state: "neutral",
        note: "需要按周跟踪净发行与链上使用。",
      },
      {
        id: "crcl-rates",
        label: "利率敏感性",
        state: "warning",
        note: "短端利率下降会直接压低储备资产收益率。",
      },
      {
        id: "crcl-reg",
        label: "监管",
        state: "positive",
        note: "清晰规则有利于机构采用，但需观察竞争门槛。",
      },
    ],
    technical: {
      trend: "高叙事、高波动，证据不足以分类",
      momentum: "对监管与利率预期高度敏感",
      structure: "IPO与事件驱动阶段优先看成交量、缺口和锁定期供应。",
      levels: [
        { label: "确认", value: "放量突破后回踩不破", role: "resistance" },
        { label: "风险", value: "消息刺激冲高回落", role: "support" },
      ],
      action: "先拆USDC量与储备收益率，不用稳定币总市值直接推导利润。",
    },
    sources: ["Circle财报", "USDC链上流通量", "美国短端利率与监管"],
  },
  {
    id: "nok",
    symbol: "NOK",
    name: "Nokia",
    market: "NYSE",
    sector: "电信设备 / 光网络",
    status: "watching",
    category: "unclassified",
    conviction: "pending",
    updatedAt: "2026-07-23",
    dataFreshness: "逻辑框架；订单与利润率需刷新",
    valuationLogic:
      "Nokia的定价取决于网络基础设施订单、运营商资本开支、数据中心互联、毛利率和现金回报。AI叙事必须最终体现为光网络订单。",
    thesis:
      "数据中心网络是潜在增量，但传统运营商支出仍可能拖累。需要订单结构而不是概念归类。",
    catalyst: [
      "光网络与数据中心互联订单加速",
      "毛利率改善",
      "运营商资本开支企稳",
    ],
    invalidation: [
      "订单增长只来自低利润项目",
      "运营商需求继续下修",
      "自由现金流弱于利润",
    ],
    fundamentalSignals: [
      {
        id: "nok-optical",
        label: "光网络订单",
        state: "neutral",
        note: "是AI数据中心逻辑能否兑现的核心验证。",
      },
      {
        id: "nok-telco",
        label: "运营商周期",
        state: "warning",
        note: "传统业务可能抵消数据中心增量。",
      },
      {
        id: "nok-margin",
        label: "利润率",
        state: "neutral",
        note: "订单质量比收入总额更重要。",
      },
    ],
    technical: {
      trend: "待分类，先等订单与价格共同确认",
      momentum: "概念驱动不能代替基本面",
      structure: "突破需要成交量与盈利上修共同支持。",
      levels: [
        { label: "确认", value: "放量突破并保持", role: "resistance" },
        { label: "风险", value: "订单利好无法留住涨幅", role: "support" },
      ],
      action: "先验证光网络订单，再决定它是AI顺风股还是传统设备周期股。",
    },
    sources: ["Nokia财报", "网络基础设施订单", "运营商CapEx"],
  },
  {
    id: "aaoi",
    symbol: "AAOI",
    name: "Applied Optoelectronics",
    market: "NASDAQ",
    sector: "光模块 / 数据中心",
    status: "watching",
    category: "type2",
    conviction: "medium",
    updatedAt: "2026-07-23",
    dataFreshness: "逻辑框架；客户订单需刷新",
    valuationLogic:
      "AAOI的盈利弹性来自800G/1.6T产品放量、客户订单、产能利用率、良率和毛利率；客户集中度会放大任何订单变化。",
    thesis:
      "AI网络需求提供高弹性，但估值需要由明确订单和毛利率兑现。强叙事、弱订单透明度时容易出现第二类出清。",
    catalyst: [
      "800G/1.6T订单与认证上修",
      "产能利用率和良率改善",
      "客户结构更加分散",
    ],
    invalidation: [
      "大客户订单推迟",
      "良率不及预期",
      "收入增长但毛利率不升",
    ],
    fundamentalSignals: [
      {
        id: "aaoi-orders",
        label: "客户订单",
        state: "neutral",
        note: "必须由公司指引与交付数据验证。",
      },
      {
        id: "aaoi-network",
        label: "AI网络需求",
        state: "positive",
        note: "高速互联是AI集群的必要投入。",
      },
      {
        id: "aaoi-concentration",
        label: "客户集中",
        state: "warning",
        note: "单一客户变化会显著放大盈利波动。",
      },
    ],
    technical: {
      trend: "高Beta第二类，等待量价确认",
      momentum: "利好环境下若不跑赢SOXX，属于弱势",
      structure: "观察突破是否有成交量和订单数据共同支撑。",
      levels: [
        { label: "确认", value: "放量突破前高", role: "resistance" },
        { label: "风险", value: "利好日长上影", role: "support" },
      ],
      action: "订单确认前控制合约期限与仓位，避免只交易推特叙事。",
    },
    sources: ["AAOI财报", "客户订单与认证", "800G/1.6T行业数据"],
  },
  {
    id: "axti",
    symbol: "AXTI",
    name: "AXT",
    market: "NASDAQ",
    sector: "InP / GaAs衬底",
    status: "watching",
    category: "unclassified",
    conviction: "pending",
    updatedAt: "2026-07-23",
    dataFreshness: "逻辑框架；出口与订单需刷新",
    valuationLogic:
      "AXTI的核心是InP/GaAs衬底需求、光通信订单、客户集中、产能利用率和中国供应链/出口限制。它处于产业链更上游，传导有时滞。",
    thesis:
      "AI光通信可以改善InP需求，但政策、客户和库存风险足以抵消行业景气。现阶段证据不足以直接归类。",
    catalyst: [
      "InP订单与产能利用率上升",
      "光通信客户库存正常化",
      "出口与合规风险缓解",
    ],
    invalidation: [
      "出口限制影响交付",
      "客户库存继续消化",
      "收入增长无法带动毛利率",
    ],
    fundamentalSignals: [
      {
        id: "axti-inp",
        label: "InP需求",
        state: "neutral",
        note: "需由光模块客户订单和公司指引验证。",
      },
      {
        id: "axti-policy",
        label: "政策风险",
        state: "negative",
        note: "供应链与出口限制可能改变交付能力。",
      },
      {
        id: "axti-upstream",
        label: "上游时滞",
        state: "warning",
        note: "云厂商CapEx不会立即等比例传导至衬底收入。",
      },
    ],
    technical: {
      trend: "待分类，事件敏感度高",
      momentum: "容易受订单传闻与政策消息驱动",
      structure: "需要价格突破与盈利预测上修同步出现。",
      levels: [
        { label: "确认", value: "突破后回踩不破", role: "resistance" },
        { label: "风险", value: "政策消息下放量破位", role: "support" },
      ],
      action: "把政策风险当作一等变量；不要用光模块需求直接替代AXTI订单。",
    },
    sources: ["AXT财报", "InP/GaAs订单", "出口与供应链政策"],
  },
  {
    id: "gold-futures",
    symbol: "GC=F",
    name: "黄金期货",
    market: "COMEX",
    sector: "大宗商品 / 贵金属",
    status: "watching",
    category: "unclassified",
    conviction: "pending",
    updatedAt: "2026-07-24",
    dataFreshness: "研究框架已建立；价格由行情接口自动读取",
    valuationLogic:
      "黄金主要由实际利率、美元、央行与ETF需求、期货仓位、地缘风险和通胀尾部共同定价。单一避险叙事不足以决定趋势。",
    thesis:
      "先观察实际利率与美元方向是否和价格形成同向确认，再判断是趋势延续、拥挤出清还是宏观预期反转。",
    catalyst: [
      "实际利率回落且美元转弱",
      "央行与黄金ETF净需求上升",
      "突破关键阻力后持仓未出现过热",
    ],
    invalidation: [
      "实际利率与美元同步走强",
      "ETF持续流出且期货净多仓拥挤",
      "利多事件无法让价格保留涨幅",
    ],
    fundamentalSignals: [
      {
        id: "gold-real-yield",
        label: "实际利率",
        state: "neutral",
        note: "待接入美债实际收益率并验证与金价的方向关系。",
      },
      {
        id: "gold-flows",
        label: "ETF与央行需求",
        state: "neutral",
        note: "待核验ETF持仓和官方储备变化。",
      },
      {
        id: "gold-positioning",
        label: "期货仓位",
        state: "neutral",
        note: "待核验CFTC持仓与期限结构。",
      },
    ],
    technical: {
      trend: "由K线页动态验证",
      momentum: "观察RSI、均线斜率与突破后的留存幅度",
      structure: "优先看前高前低、20/50/200日均线与波动区间。",
      levels: [],
      action: "宏观变量与价格同时确认后再定方向；不只因避险新闻追价。",
    },
    sources: ["CME/COMEX黄金期货", "CFTC持仓报告", "黄金ETF与央行储备数据"],
  },
  {
    id: "silver-futures",
    symbol: "SI=F",
    name: "白银期货",
    market: "COMEX",
    sector: "大宗商品 / 贵金属与工业金属",
    status: "watching",
    category: "unclassified",
    conviction: "pending",
    updatedAt: "2026-07-24",
    dataFreshness: "研究框架已建立；价格由行情接口自动读取",
    valuationLogic:
      "白银同时受黄金货币属性、工业需求、库存、矿端供给和金银比影响，通常波动高于黄金，不能只用黄金方向线性外推。",
    thesis:
      "需要黄金趋势、工业需求预期与白银自身库存/持仓共同确认，才把高波动视为趋势而非挤仓。",
    catalyst: [
      "黄金上行且金银比下降",
      "工业与光伏需求预期上修",
      "交易所库存下降并伴随价格突破",
    ],
    invalidation: [
      "工业需求预期下修",
      "库存回升且金银比重新走高",
      "突破后快速跌回区间",
    ],
    fundamentalSignals: [
      {
        id: "silver-ratio",
        label: "金银比",
        state: "neutral",
        note: "待验证白银相对黄金的强弱是否持续。",
      },
      {
        id: "silver-demand",
        label: "工业需求",
        state: "neutral",
        note: "待核验光伏、电子与制造业需求。",
      },
      {
        id: "silver-inventory",
        label: "库存与仓位",
        state: "neutral",
        note: "待核验COMEX库存和CFTC仓位。",
      },
    ],
    technical: {
      trend: "由K线页动态验证",
      momentum: "重点观察相对白银/黄金比与波动扩张",
      structure: "高波动品种需要突破、回踩与成交量共同确认。",
      levels: [],
      action: "仓位按更高波动率折减，避免用黄金仓位尺度直接套用。",
    },
    sources: ["CME/COMEX白银期货", "CFTC持仓报告", "交易所库存与工业需求数据"],
  },
  {
    id: "wti-futures",
    symbol: "CL=F",
    name: "WTI原油期货",
    market: "NYMEX",
    sector: "大宗商品 / 能源",
    status: "watching",
    category: "unclassified",
    conviction: "pending",
    updatedAt: "2026-07-24",
    dataFreshness: "研究框架已建立；价格由行情接口自动读取",
    valuationLogic:
      "WTI由全球需求、OPEC+供给、美国库存与产量、炼厂开工、期限结构和地缘供应风险共同定价。现货紧张需由库存和月差验证。",
    thesis:
      "先用库存、期限结构和价格反应区分真实供需紧张与短期地缘溢价，再决定是否追随趋势。",
    catalyst: [
      "库存持续下降且近月升水扩大",
      "OPEC+实际减产强于市场预期",
      "需求预期上修并伴随裂解价差改善",
    ],
    invalidation: [
      "库存连续累积且期限结构走弱",
      "实际增产或需求预测下修",
      "供应中断新闻无法让价格保留涨幅",
    ],
    fundamentalSignals: [
      {
        id: "wti-inventory",
        label: "EIA库存",
        state: "neutral",
        note: "待核验原油、汽油和馏分油库存变化。",
      },
      {
        id: "wti-curve",
        label: "期限结构",
        state: "neutral",
        note: "待验证近远月价差是否支持现货紧张。",
      },
      {
        id: "wti-supply",
        label: "OPEC+与美国产量",
        state: "neutral",
        note: "待核验实际产量而非仅看口头配额。",
      },
    ],
    technical: {
      trend: "由K线页动态验证",
      momentum: "观察事件跳空能否在收盘保留",
      structure: "结合期限结构判断突破是否由现货驱动。",
      levels: [],
      action: "地缘事件只作触发器，库存和月差不确认时控制追价。",
    },
    sources: ["NYMEX WTI期货", "EIA周度石油库存", "OPEC月报与期限结构"],
  },
  {
    id: "btc-perpetual",
    symbol: "BTC-USD",
    name: "Bitcoin 永续",
    market: "BINANCE FUTURES",
    sector: "加密资产 / BTCUSDT永续",
    status: "watching",
    category: "unclassified",
    conviction: "pending",
    updatedAt: "2026-07-24",
    dataFreshness: "K线、标记价格、资金费率与持仓量使用Binance USDⓈ-M Futures",
    valuationLogic:
      "BTC主要受全球流动性、现货ETF资金流、长期持有者供给、永续合约杠杆与风险偏好共同定价。价格上涨若伴随资金费率和持仓量过热，预期收益会下降。",
    thesis:
      "把现货趋势与永续杠杆分开：趋势向上但资金费率、基差和持仓量不过热，才更接近可持续上涨。",
    catalyst: [
      "现货需求与ETF净流入持续",
      "价格突破且资金费率保持温和",
      "持仓量增长由现货成交配合而非单纯杠杆推动",
    ],
    invalidation: [
      "价格跌破关键结构且持仓量不降",
      "资金费率持续过热后价格无法创新高",
      "现货资金流转负并伴随长期持有者供给上升",
    ],
    fundamentalSignals: [
      {
        id: "btc-funding",
        label: "永续资金费率",
        state: "neutral",
        note: "由Binance Futures接口读取并判断杠杆拥挤度。",
      },
      {
        id: "btc-open-interest",
        label: "未平仓合约",
        state: "neutral",
        note: "由Binance Futures接口读取，需与价格和成交量联动判断。",
      },
      {
        id: "btc-spot-flow",
        label: "现货与ETF资金流",
        state: "neutral",
        note: "待接入现货ETF和链上供给证据。",
      },
    ],
    technical: {
      trend: "使用BTCUSDT永续日线动态计算",
      momentum: "结合标记价格、资金费率与持仓量判断",
      structure: "优先识别去杠杆后的价格留存，而非只看单根大阳线。",
      levels: [],
      action: "资金费率和持仓量过热时降低杠杆；失效点必须按标记价格口径复核。",
    },
    sources: ["Binance USDⓈ-M Futures BTCUSDT永续", "现货ETF资金流", "链上供给数据"],
  },
  {
    id: "eth-perpetual",
    symbol: "ETH-USD",
    name: "Ethereum 永续",
    market: "BINANCE FUTURES",
    sector: "加密资产 / ETHUSDT永续",
    status: "watching",
    category: "unclassified",
    conviction: "pending",
    updatedAt: "2026-07-24",
    dataFreshness: "K线、标记价格、资金费率与持仓量使用Binance USDⓈ-M Futures",
    valuationLogic:
      "ETH由网络活动与费用、L2价值捕获、质押供给、ETF资金流、监管预期、ETH/BTC相对强度和永续杠杆共同定价。",
    thesis:
      "不仅看加密大盘方向，还要验证ETH/BTC、网络经济活动和永续仓位是否同步改善。",
    catalyst: [
      "ETH/BTC相对强度转正",
      "网络费用与稳定币/DeFi活动改善",
      "现货资金流上升且永续资金费率温和",
    ],
    invalidation: [
      "ETH/BTC继续破低",
      "网络活动改善但价值无法沉淀到ETH",
      "持仓量和资金费率过热而价格滞涨",
    ],
    fundamentalSignals: [
      {
        id: "eth-funding",
        label: "永续资金费率",
        state: "neutral",
        note: "由Binance Futures接口读取并判断多空拥挤。",
      },
      {
        id: "eth-open-interest",
        label: "未平仓合约",
        state: "neutral",
        note: "由Binance Futures接口读取，需结合标记价格。",
      },
      {
        id: "eth-network",
        label: "网络与资金流",
        state: "neutral",
        note: "待接入链上活动、质押与ETF资金流。",
      },
    ],
    technical: {
      trend: "使用ETHUSDT永续日线动态计算",
      momentum: "结合ETH/BTC、资金费率与持仓量判断",
      structure: "相对强度未修复前，不把BTC上涨自动映射为ETH趋势。",
      levels: [],
      action: "先看ETH/BTC和永续拥挤度；高杠杆环境下缩短失效确认窗口。",
    },
    sources: ["Binance USDⓈ-M Futures ETHUSDT永续", "ETH现货ETF资金流", "链上与质押数据"],
  },
];
