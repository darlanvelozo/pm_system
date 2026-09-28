import type { BulletinData, BulletinType } from '@/schemas/bulletin';
export type User = { id: string; name: string; email: string; role: 'ADMIN' | 'OPERADOR'; active: boolean };
export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED';
export type Bulletin = { id: string; bo_number: string; bulletin_type: BulletinType; recipient_email: string; created_by: string; status: 'DRAFT' | 'ISSUED'; version: number; data: BulletinData; pdf_generated_at: string | null; recipient_email_status: EmailStatus; battalion_email_status: EmailStatus };
export type BulletinSummary = Omit<Bulletin, 'data' | 'version' | 'recipient_email'> & { occurrence_type: string; occurrence_date: string };
export type BulletinList = { items: BulletinSummary[]; page: number; size: number; total: number };
