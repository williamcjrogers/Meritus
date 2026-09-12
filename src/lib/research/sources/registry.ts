import type { SourceConnector } from '../contracts';
import { isSupportedProvider, validateSourceJobPayload, importSelectionSchema, caseSelectionSchema } from './selection';
import { createCompaniesHouseConnector } from './companies-house';
import { createOcdsConnector } from './ocds';
import { createPaymentConnector } from './payment-practices';
import { createGazetteConnector } from './gazette';
import { createCaseLawConnector } from './find-case-law';
import { createBuildingSafetyConnector } from './building-safety';
import { createPublicationConnector, type PublicationSelection } from './publications';
import { createImportConnector } from '../imports/connector';
export function getConnector(provider: string, payload: unknown): SourceConnector | null { if (!isSupportedProvider(provider))
    return null; const { selection } = validateSourceJobPayload(provider, payload); switch (provider) {
    case 'companies-house': return createCompaniesHouseConnector(selection as {
        companyNumber: string;
    });
    case 'find-a-tender':
    case 'contracts-finder': return createOcdsConnector(provider);
    case 'payment-practices': {
        const value = selection as {
            objectKey: string;
            snapshotHash: string;
        };
        if (!value.objectKey || !value.snapshotHash)
            throw new Error('Payment snapshot must be prepared first');
        return createPaymentConnector(value);
    }
    case 'gazette': return createGazetteConnector(selection as {
        noticeTypes: string[];
    });
    case 'find-case-law': return createCaseLawConnector(caseSelectionSchema.parse(selection));
    case 'building-safety': return createBuildingSafetyConnector(selection as {
        publicationUrl: string;
    });
    case 'publications': return createPublicationConnector(selection as PublicationSelection);
    default: return createImportConnector(importSelectionSchema.parse(selection), provider);
} }
export { prepareSourceJob } from './prepare';
