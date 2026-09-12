// Canonical values accepted by the workflow service and scoring engine.
export const pipelineStages = ['review', 'shortlisted', 'introduction_considered', 'contacted', 'conversation', 'instruction', 'dismissed', 'snoozed'] as const
export const signalFamilies = ['insolvency', 'proceedings', 'procurement_performance', 'corporate_governance_finance', 'payment_practice', 'project_delivery', 'context_amplifiers', 'evidence_only'] as const
export const calendarKinds = ['legal_deadline', 'limitation', 'limitation_expiry', 'legal_review', 'warranty', 'warranty_expiry', 'practical_completion', 'certified_practical_completion', 'hearing', 'contract_notice', 'review'] as const
export const calendarPrecisions = ['day', 'month', 'year', 'approximate'] as const
export const calendarStatuses = ['provisional', 'confirmed', 'illustrative', 'pending', 'rejected', 'uncertain'] as const
export const professionalRoles = ['adviser', 'barrister', 'counsel', 'expert', 'funder', 'introduction_route', 'practitioner', 'solicitor'] as const
