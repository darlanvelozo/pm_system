const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  } catch { throw new ApiError('Não foi possível conectar à API. Seu rascunho foi preservado.', 0); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(typeof data.detail === 'string' ? data.detail : 'Não foi possível concluir a operação.', response.status);
  }
  return response.json() as Promise<T>;
}
export async function downloadPdf(id: string, token: string) {
  const response = await fetch(`${base}/api/bo/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new ApiError('Não foi possível baixar o PDF.', response.status);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = `BO_${id}.pdf`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
