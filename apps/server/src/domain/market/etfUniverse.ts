/**
 * ETF research universe for the KRW 500,000 virtual ETF rotation. Chosen 2026-10-07 from the public KRX ETF list:
 * no leverage, inverse, covered-call, active, money-market or short-bond products; price KRW 3,000–100,000 (plus a
 * 3-year treasury and a silver fund); traded value at least KRW 1bn that day; one fund per tracked theme.
 * See docs/ETF_MOMENTUM_RESEARCH_2026-10-07.md. Review monthly; bump the version on any change.
 */
export const ETF_UNIVERSE = {
  version: 'krx-etf-2026-10-v1',
  symbols: [
    ['360750', 'TIGER 미국S&P500'], ['379810', 'KODEX 미국나스닥100'], ['487240', 'KODEX AI전력핵심설비'],
    ['229200', 'KODEX 코스닥150'], ['396500', 'TIGER 반도체TOP10'], ['395160', 'KODEX AI반도체TOP2플러스'],
    ['455850', 'SOL AI반도체소부장'], ['395270', 'HANARO Fn K-반도체'], ['305720', 'KODEX 2차전지산업'], ['361580', 'RISE 200TR'],
    ['471990', 'KODEX AI반도체핵심장비'], ['475300', 'SOL 반도체전공정'], ['228790', 'TIGER 화장품'], ['475310', 'SOL 반도체후공정'],
    ['364980', 'TIGER 2차전지TOP10'], ['381180', 'TIGER 미국필라델피아반도체나스닥'], ['390390', 'KODEX 미국반도체'],
    ['462010', 'TIGER 2차전지소재Fn'], ['434730', 'HANARO 원자력iSelect'], ['457990', 'PLUS 태양광&ESS'],
    ['471760', 'TIGER AI반도체핵심공정'], ['305540', 'TIGER 2차전지테마'], ['487230', 'KODEX 미국AI전력핵심인프라'],
    ['469150', 'ACE AI반도체TOP3+'], ['466920', 'SOL 조선TOP3플러스'], ['461950', 'KODEX 2차전지핵심소재10'],
    ['458730', 'TIGER 미국배당다우존스'], ['449450', 'PLUS K방산'], ['475050', 'ACE KPOP포커스'], ['117700', 'KODEX 건설'],
    ['292150', 'TIGER 코리아TOP10'], ['466940', 'TIGER 은행고배당플러스TOP10'], ['463250', 'TIGER K방산&우주'],
    ['367760', 'RISE 네트워크인프라'], ['433500', 'ACE 원자력TOP10'], ['484880', 'SOL 금융지주플러스고배당'], ['491820', 'HANARO 전력설비투자'],
    ['091170', 'KODEX 은행'], ['381170', 'TIGER 미국테크TOP10 INDXX'], ['237350', 'KODEX 코스피100'],
    ['494670', 'TIGER 조선TOP10'], ['411060', 'ACE KRX금현물'], ['465580', 'ACE 미국빅테크TOP7 Plus'], ['102780', 'KODEX 삼성그룹'],
    ['284430', 'KODEX 200미국채혼합50'], ['446770', 'ACE 글로벌반도체TOP4 Plus'], ['476260', 'HANARO 반도체핵심공정주도주'],
    ['102970', 'KODEX 증권'], ['161510', 'PLUS 고배당주'], ['244580', 'KODEX 바이오'], ['455860', 'SOL 2차전지소부장Fn'],
    ['364970', 'TIGER 바이오TOP10'], ['226490', 'KODEX 코스피'], ['329200', 'TIGER 리츠부동산인프라'],
    ['497570', 'TIGER 미국필라델피아AI반도체나스닥'], ['377990', 'TIGER Fn신재생에너지'], ['418670', 'TIGER 글로벌AI사이버보안'],
    ['315960', 'RISE 대형고배당10TR'], ['314250', 'KODEX 미국빅테크10(H)'], ['138540', 'TIGER 현대차그룹플러스'],
    ['114820', 'TIGER 국채3년'], ['144600', 'KODEX 은선물(H)'],
  ] as const satisfies readonly (readonly [string, string])[],
} as const;

export const etfSymbols = (): string[] => ETF_UNIVERSE.symbols.map(([symbol]) => symbol);
export const etfName = (symbol: string): string | undefined => ETF_UNIVERSE.symbols.find(([code]) => code === symbol)?.[1];
