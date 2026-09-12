import {expect,it,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
vi.mock('./ResearchControls',async()=>{const actual=await vi.importActual<typeof import('./ResearchControls')>('./ResearchControls');return {...actual,api:vi.fn().mockResolvedValue([])};});
import {EntitiesReview} from './EntitiesReview';
it('shows the evidence prerequisite and escapes source text',async()=>{const empty=render(<EntitiesReview/>);await waitFor(()=>expect(screen.getByText('Source evidence required')).toBeInTheDocument());empty.unmount();const result=render(<EntitiesReview evidence={[{documentId:'d',versionId:'v',passageId:'p',title:'Synthetic source',text:'<script>malicious()</script>'}]}/>);await waitFor(()=>expect(screen.getByText('Confirm an identifier from source evidence')).toBeInTheDocument());expect(result.container.querySelector('script')).toBeNull();expect(result.container.querySelector('input[name="documentId"]')).toBeNull();});
