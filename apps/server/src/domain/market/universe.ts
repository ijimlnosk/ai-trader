/**
 * Reviewed trading universe. Codes and names were verified against KIS daily-chart responses on
 * 2026-09-30; all had 20-session average turnover above KRW 13.3bn. Review monthly; bump the
 * version on any change. Order matters only for collection (005930 first: the live loop symbol).
 */
export const UNIVERSE = {
  version: 'krx-liquid-2026-09-v1',
  symbols: [
    ['005930', '삼성전자'], ['000660', 'SK하이닉스'], ['373220', 'LG에너지솔루션'], ['207940', '삼성바이오로직스'],
    ['005380', '현대차'], ['000270', '기아'], ['068270', '셀트리온'], ['005490', 'POSCO홀딩스'], ['035420', 'NAVER'],
    ['035720', '카카오'], ['051910', 'LG화학'], ['006400', '삼성SDI'], ['105560', 'KB금융'], ['055550', '신한지주'],
    ['012330', '현대모비스'], ['028260', '삼성물산'], ['066570', 'LG전자'], ['003550', 'LG'], ['034730', 'SK'],
    ['096770', 'SK이노베이션'], ['017670', 'SK텔레콤'], ['030200', 'KT'], ['032830', '삼성생명'], ['086790', '하나금융지주'],
    ['316140', '우리금융지주'], ['018260', '삼성에스디에스'], ['009150', '삼성전기'], ['010130', '고려아연'], ['011200', 'HMM'],
    ['015760', '한국전력'], ['033780', 'KT&G'], ['003670', '포스코퓨처엠'], ['010950', 'S-Oil'], ['012450', '한화에어로스페이스'],
    ['042660', '한화오션'], ['009540', 'HD한국조선해양'], ['329180', 'HD현대중공업'], ['267260', 'HD현대일렉트릭'],
    ['034020', '두산에너빌리티'], ['259960', '크래프톤'], ['352820', '하이브'], ['323410', '카카오뱅크'], ['000810', '삼성화재'],
    ['024110', '기업은행'], ['047810', '한국항공우주'], ['010140', '삼성중공업'], ['011070', 'LG이노텍'], ['000100', '유한양행'],
    ['128940', '한미약품'], ['138040', '메리츠금융지주'], ['247540', '에코프로비엠'], ['086520', '에코프로'], ['196170', '알테오젠'],
    ['028300', 'HLB'],
  ] as const satisfies readonly (readonly [string, string])[],
} as const;

export type UniverseSymbol = (typeof UNIVERSE.symbols)[number][0];
export const universeSymbols = (): string[] => UNIVERSE.symbols.map(([symbol]) => symbol);
export const universeName = (symbol: string): string | undefined => UNIVERSE.symbols.find(([code]) => code === symbol)?.[1];
