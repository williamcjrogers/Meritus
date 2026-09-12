export type CaseSearch = {
    query?: string;
    courts?: string[];
    party?: string;
    judge?: string;
    from?: string;
    to?: string;
    citation?: string;
    order?: '-transformation' | '-updated';
};
export type CaseFeedEntry = {
    uri: string;
    title: string;
    identifiers: {
        type: string;
        value: string;
        slug: string;
    }[];
    xmlUrl: string | null;
    pdfUrl: string | null;
    publishedAt: string | null;
    transformedAt: string | null;
    contentHash: string | null;
};
export type CaseHit = {
    documentId: string;
    versionId: string;
    title: string;
    identifiers: {
        type: string;
        value: string;
    }[];
    passageIds: string[];
    coverage: string[];
};
