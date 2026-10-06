import type {EmailStatus} from '@/types/api';
import type {ReportData} from './schema';
export type Report={id:string;report_number:string|null;status:'DRAFT'|'ISSUED'|'CANCELLED'|'REMOVED';version:number;current_revision:number;created_by_name:string;created_by_username:string;data:ReportData;occurrence_type:string;occurrence_date:string;occurrence_time:string;city:string;updated_at?:string;pdf_generated_at?:string|null;recipient_email_status:EmailStatus;battalion_email_status:EmailStatus;edit_reason?:string;cancellation_reason?:string;deletion_reason?:string;edited_by_name?:string;edited_by_username?:string;cancelled_by_name?:string;cancelled_by_username?:string;deleted_by_name?:string;deleted_by_username?:string};
export type ReportList={items:Report[];total:number;size:number;page:number};
export type ReportRevision={version:number;created_at:string;actor_name_snapshot:string;actor_username_snapshot:string;reason:string;pdf_sha256:string};
