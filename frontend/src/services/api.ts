// '/' serves the API from the same origin as the frontend (reverse proxy deployments).
const configured = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const base = configured === '/' ? '' : configured.replace(/\/$/, '');
// An expired or revoked JWT returns the user to login without clearing local drafts.
function expired(status: number, token?: string) { if (status === 401 && token && typeof window !== 'undefined') window.dispatchEvent(new Event('bo24:session-expired')); }
export async function pdfUrl(path: string, token: string, data?: unknown) {
  const response = await fetch(`${base}${path}`, {method: data ? 'POST' : 'GET', cache:'no-store', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, ...(data ? {body:JSON.stringify(data)} : {})});
  if(!response.ok) { expired(response.status, token); throw new ApiError('Não foi possível gerar ou abrir o PDF. Confira os dados.', response.status); }
  return URL.createObjectURL(await response.blob());
}
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  } catch { throw new ApiError('Não foi possível conectar à API. Seu rascunho foi preservado.', 0); }
  if (!response.ok) {
    expired(response.status, token);
    const data = await response.json().catch(() => ({}));
    throw new ApiError(typeof data.detail === 'string' ? data.detail : 'Não foi possível concluir a operação.', response.status);
  }
  return response.json() as Promise<T>;
}
export async function downloadPdf(id: string, token: string, version?: number) {
  const response = await fetch(`${base}/api/bo/${id}/${version ? `revisions/${version}/pdf` : 'pdf'}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) { expired(response.status, token); throw new ApiError('Não foi possível baixar o PDF.', response.status); }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `BO_${id}.pdf`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
