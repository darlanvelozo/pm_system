import type { BulletinData, BulletinType } from '@/schemas/bulletin';
export type User = { id: string; name: string; username?: string; email: string | null; role: 'ADMIN' | 'OPERADOR'; active: boolean };
export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED';
export type Bulletin = { id: string; bo_number: string; bulletin_type: BulletinType; recipient_email: string; created_by: string; created_by_name?: string; created_by_username?: string; cancellation_reason?: string; cancelled_at?: string; status: 'DRAFT' | 'ISSUED' | 'CANCELLED'; version: number; data: BulletinData; pdf_generated_at: string | null; recipient_email_status: EmailStatus; battalion_email_status: EmailStatus };
export type BulletinSummary = Omit<Bulletin, 'data' | 'version' | 'recipient_email'> & { occurrence_type: string; occurrence_date: string };
export type BulletinList = { items: BulletinSummary[]; page: number; size: number; total: number };
