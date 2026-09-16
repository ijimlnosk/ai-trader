import {
  DEFAULT_RISK_POLICY, evaluateRisk, RiskRejection,
  type RiskContext, type RiskDecision, type RiskPolicy, type TradeProposal,
} from '../domain/risk/index.ts';

/** Supplies validated context; paper v1 initialization semantics are owned by its provider. */
export interface RiskContextProvider {
  getRiskContext(): Promise<RiskContext | null>;
}
export interface RiskEvaluation {
  proposal: TradeProposal;
  policy: Readonly<RiskPolicy>;
  context: RiskContext | null;
  decision: RiskDecision;
  evaluatedAt: string;
}

export function createRiskEvaluation(
  provider: RiskContextProvider,
  policy: Readonly<RiskPolicy> = DEFAULT_RISK_POLICY,
  now: () => Date = () => new Date(),
) {
  const configuredPolicy = Object.freeze({ ...policy });
  return async (input: Omit<TradeProposal, 'createdAt'>): Promise<RiskEvaluation> => {
    const proposal = { ...input, createdAt: now().toISOString() };
    const state = await provider.getRiskContext();
    const context = state === null ? null : { ...state };
    const decision: RiskDecision = context === null
      ? { approved: false, approvedQuantity: '0', reasons: [RiskRejection.INVALID_CONTEXT] }
      : evaluateRisk(proposal, context, configuredPolicy);
    return { proposal, policy: configuredPolicy, context, decision, evaluatedAt: now().toISOString() };
  };
}
