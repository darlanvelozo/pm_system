import {z} from 'zod';
const text = (max=20000) => z.string().max(max);
export const reportSchema = z.object({
  recipient_email:z.string().email('Informe um e-mail válido'), occurrence_type:z.string().trim().min(1,'Informe o tipo').max(200),
  location:z.string().trim().min(1,'Informe o local').max(2000), occurrence_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Informe a data'),
  occurrence_time:z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/,'Informe a hora'),
  victims:text(), involved:text(), witnesses:text(), seized_material:text(), weapon_type:text(500), others:text(),
  fled:z.enum(['SIM','NÃO']), samu:z.enum(['SIM','NÃO']), icrim:z.enum(['SIM','NÃO']), cause:text(), teams:text(),
  narrative:z.string().trim().min(1,'Informe o relato').max(80000), measures:z.string().trim().min(1,'Informe as providências').max(80000),
  closing_location:text(200), closing_date:z.string(), draft_step:z.number().int().min(0).max(7),
});
export type ReportData = Omit<z.infer<typeof reportSchema>,'fled'|'samu'|'icrim'> & {fled:''|'SIM'|'NÃO';samu:''|'SIM'|'NÃO';icrim:''|'SIM'|'NÃO'};
export const initialReport = ():ReportData => ({recipient_email:'',occurrence_type:'',location:'',occurrence_date:'',occurrence_time:'',victims:'',involved:'',witnesses:'',seized_material:'',weapon_type:'',others:'',fled:'',samu:'',icrim:'',cause:'',teams:'',narrative:'',measures:'',closing_location:'',closing_date:'',draft_step:0});
export const reportLabels:Record<string,string>={recipient_email:'E-mail para recebimento',occurrence_type:'Código/Tipo de Ocorrência',location:'Local',occurrence_date:'Data da ocorrência',occurrence_time:'Hora da ocorrência',victims:'Vítima(s)',involved:'Envolvido(s)',witnesses:'Testemunha(s)',seized_material:'Materiais apreendidos',weapon_type:'Tipo de arma usada',others:'Outros (veículos, drogas, objetos)',fled:'EVADIU-SE',samu:'SAMU',icrim:'ICRIM',cause:'Causa/Motivo',teams:'Viatura(s) e guarnições envolvidas',narrative:'RELATO DA OCORRÊNCIA',measures:'PROVIDÊNCIAS ADOTADAS',closing_location:'Local de emissão (município)',closing_date:'Data de emissão'};
export const reportPayload=(d:ReportData)=>({...d,occurrence_date:d.occurrence_date||null,occurrence_time:d.occurrence_time||null,closing_date:d.closing_date||null});
export const normalizeReport=(d:ReportData):ReportData=>({...initialReport(),...d,occurrence_date:d.occurrence_date||'',occurrence_time:d.occurrence_time||'',closing_date:d.closing_date||''});
