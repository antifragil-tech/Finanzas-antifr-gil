export type InvoiceStatus =
  | 'pending'
  | 'en_propiedad'
  | 'en_finanzas'
  | 'paid'
  | 'paid_archived'
  | 'rejected';

export type UserRole = 'direccion' | 'propiedad' | 'finanzas';

export type Invoice = {
  id: string;
  date: string;
  provider: string;
  project: string;
  amount: number;
  status: InvoiceStatus;
  fileUrl?: string;
  rejectionReason?: string;
};
