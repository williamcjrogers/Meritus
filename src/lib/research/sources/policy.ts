export function sourceMode(provider: string, hasDeliveryAgreement: boolean): 'api' | 'import' | 'manual' { if (provider === 'bailii')
    return 'manual'; if (['court-listings', 'glenigan', 'barbour-abi', 'creditsafe', 'commercial-import'].includes(provider))
    return 'import'; return hasDeliveryAgreement ? 'api' : 'import'; }
