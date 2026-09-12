// @vitest-environment node
// Synthetic official-host pages test navigation, not factual publication metrics.
import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('../safe-fetch',()=>({safeFetch:vi.fn()}));
import {safeFetch} from '../safe-fetch';
import {createBuildingSafetyConnector,normaliseGatewayMetric} from './building-safety';
import type {ConnectorContext} from '../contracts';
beforeEach(()=>vi.resetAllMocks());
it('keeps cohorts separate from project-level delay',()=>{expect(normaliseGatewayMetric({periodFrom:'2026-06-01',periodTo:'2026-08-31',category:'synthetic',measure:'median',value:22,denominator:null,sourceLocator:'3'}).value).not.toHaveProperty('projectId');});
it('traverses a collection through a publication to the actual attachment',async()=>{
 const root='https://www.gov.uk/government/collections/building-safety-synthetic',publication='https://www.gov.uk/government/publications/building-safety-synthetic',pdf='https://assets.publishing.service.gov.uk/synthetic.pdf';
 const ctx:ConnectorContext={source:{id:'source',provider:'building-safety',hosts:['www.gov.uk','assets.publishing.service.gov.uk'],status:'ready',credentialRef:null},window:{from:'2026-01-01T00:00:00Z',to:'2026-09-12T00:00:00Z'},cursor:null,signal:new AbortController().signal};
 const response=(url:string,text:string,type='text/html')=>({url,body:Buffer.from(text),contentType:type,status:200});
 vi.mocked(safeFetch).mockResolvedValueOnce(response(root,`<a href="${publication}">Publication</a>`)).mockResolvedValueOnce(response(publication,`<a href="${pdf}">Download PDF</a>`)).mockResolvedValueOnce(response(pdf,'%PDF-synthetic','application/pdf'));
 const connector=createBuildingSafetyConnector({publicationUrl:root});const first=await connector.fetchPage(ctx);expect(first.nextCursor).not.toBeNull();const second=await connector.fetchPage({...ctx,cursor:first.nextCursor});const third=await connector.fetchPage({...ctx,cursor:second.nextCursor});expect(third.records[0].url).toBe(pdf);expect(third.nextCursor).toBeNull();expect(third.coverage.complete).toBe(true);
});
it('reports missing attachments as incomplete coverage',async()=>{vi.mocked(safeFetch).mockResolvedValue({url:'https://www.gov.uk/government/collections/building-safety-synthetic',body:Buffer.from('<p>No supplied attachments</p>'),contentType:'text/html',status:200});const page=await createBuildingSafetyConnector({publicationUrl:'https://www.gov.uk/government/collections/building-safety-synthetic'}).fetchPage({source:{id:'s',provider:'building-safety',hosts:['www.gov.uk'],status:'ready',credentialRef:null},window:{from:'2026-01-01T00:00:00Z',to:'2026-09-12T00:00:00Z'},cursor:null,signal:new AbortController().signal});expect(page.coverage.complete).toBe(false);});
