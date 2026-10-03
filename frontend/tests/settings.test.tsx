import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '@/features/admin/Settings';
import { Guide } from '@/features/guide/Guide';
import { roleLabel, settingFields } from '@/types/api';

const empty = Object.fromEntries(settingFields.map(f => [f, null]));
const defaults = { ...Object.fromEntries(settingFields.map(f => [f, ''])), unit_name: '24º Batalhão de Polícia Militar', unit_short_name: '24º BPM', unit_city: 'Coroatá/MA', battalion_email: 'batalhao@example.com' };
const diagnostics = { email: { provider: 'smtp', provider_label: 'SMTP', configured: false, sender_configured: false, credentials_configured: false, battalion_email: 'batalhao@example.com', reply_to: null }, app: { version: '0.1.0', bo_pdf_layout: '2026.4', report_pdf_layout: '2026.1' }, database: { reachable: true, dialect: 'postgresql', revision: 'x', head: 'x', up_to_date: true }, environment: 'development', frontend_url: 'http://localhost:3000' };
function respond(body: unknown) { return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })); }

describe('perfis', () => {
  it('rotula OPERADOR como Usuário comum', () => {
    expect(roleLabel('OPERADOR')).toBe('Usuário comum');
    expect(roleLabel('ADMIN')).toBe('Administrador');
  });
});
describe('Configurações', () => {
  it('mostra padrão do servidor, detecta alteração e salva', async () => {
    const calls: RequestInit[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/admin/diagnostics')) return respond(diagnostics);
      if (init?.method === 'PUT') { calls.push(init); return respond({ values: { ...empty, unit_short_name: 'BPM Fictício' }, defaults, effective: { ...defaults, unit_short_name: 'BPM Fictício' }, updated_at: '2026-10-02T12:00:00Z', updated_by_name: 'Admin', changed: ['unit_short_name'] }); }
      return respond({ values: empty, defaults, effective: defaults, updated_at: null, updated_by_name: null });
    });
    const dirty = vi.fn();
    render(<Settings token="t" onDirtyChange={dirty}/>);
    expect(await screen.findByText('Usando valor padrão do servidor: 24º BPM')).toBeInTheDocument();
    expect(await screen.findByText('Não configurado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar configurações/ })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Nome abreviado'), 'BPM Fictício');
    expect(screen.getByText('Há alterações não salvas.')).toBeInTheDocument();
    expect(dirty).toHaveBeenLastCalledWith(true);
    expect(screen.getByText(/Rodapé do BO: “BPM Fictício • Página 1”/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Salvar configurações/ }));
    await waitFor(() => expect(screen.getByText(/Configurações salvas \(Nome abreviado\)/)).toBeInTheDocument());
    expect(JSON.parse(String(calls[0].body)).unit_short_name).toBe('BPM Fictício');
    expect(dirty).toHaveBeenLastCalledWith(false);
  });
});
describe('Guia de uso', () => {
  it('mostra guia do administrador somente para ADMIN', async () => {
    const { unmount } = render(<Guide audience="common"/>);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Índice do guia' })).toBeInTheDocument();
    unmount();
    render(<Guide audience="admin"/>);
    await userEvent.click(screen.getByRole('tab', { name: /Guia do administrador/ }));
    expect(screen.getByRole('heading', { name: 'A7. Configurações' })).toBeInTheDocument();
  });
});
