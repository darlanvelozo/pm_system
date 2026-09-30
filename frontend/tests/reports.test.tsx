import {describe,it,expect} from 'vitest';
import {initialReport,reportSchema,reportPayload,normalizeReport} from '../src/features/analytical-reports/schema';
import {clearUserDrafts} from '../src/hooks/useDraft';

describe('analytical reports',()=>{
  it('requires the fields and all three solution answers from the source form',()=>{
    const data={...initialReport(),recipient_email:'fictional@example.com',occurrence_type:'Teste',location:'Local fictício',occurrence_date:'2026-09-30',occurrence_time:'12:30',narrative:'Relato fictício',measures:'Providências fictícias'};
    expect(reportSchema.safeParse(data).success).toBe(false);
    expect(reportSchema.safeParse({...data,fled:'NÃO',samu:'SIM',icrim:'NÃO'}).success).toBe(true);
  });
  it('keeps optional people empty and supports incomplete draft dates',()=>{
    const data=initialReport();expect(data.victims).toBe('');expect(reportPayload(data).occurrence_date).toBeNull();
    expect(normalizeReport({...data,occurrence_date:null as unknown as string}).occurrence_date).toBe('');
  });
  it('clears only the signed-out user report drafts and pending attempts',()=>{
    localStorage.setItem('bo24:report-draft:alice:new','private');localStorage.setItem('bo24:report-emission:alice:123','attempt');
    localStorage.setItem('bo24:report-draft:bob:new','other');clearUserDrafts('alice');
    expect(localStorage.getItem('bo24:report-draft:alice:new')).toBeNull();expect(localStorage.getItem('bo24:report-emission:alice:123')).toBeNull();
    expect(localStorage.getItem('bo24:report-draft:bob:new')).toBe('other');localStorage.removeItem('bo24:report-draft:bob:new');
  });
});
