import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Generator } from '@/features/bulletins/Generator';
import { Wizard } from '@/features/bulletins/Wizard';
import { roleLabel, roleLabels } from '@/types/api';

Element.prototype.scrollIntoView = vi.fn();
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
afterEach(() => vi.unstubAllGlobals());

describe('Usuário básico', () => {
  it('tem rótulo próprio entre os três perfis', () => {
    expect(roleLabel('BASICO')).toBe('Usuário básico');
    expect(Object.values(roleLabels)).toEqual(['Administrador', 'Usuário comum', 'Usuário básico']);
  });
  it('lista somente os próprios rascunhos e mostra comprovante sem dados', async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(json(url.includes('/api/bo')
      ? { items: [{ id: 'b1', occurrence_type: 'FURTO FICTÍCIO', draft_step: 2, updated_at: '2026-10-06T10:00:00Z' }], total: 1, page: 1, size: 50 }
      : { items: [{ id: 'r1', occurrence_type: 'ROUBO FICTÍCIO', updated_at: '2026-10-06T10:00:00Z' }], total: 1, page: 1, size: 50 })));
    vi.stubGlobal('fetch', fetch);
    const continueReport = vi.fn();
    render(<Generator token="t" receipt={{ kind: 'report', number: '7/2026', status: 'ISSUED', date: '2026-10-06T10:00:00Z' }} onDismiss={() => {}}
      onNewBulletin={() => {}} onNewReport={() => {}} onContinueBulletin={() => {}} onContinueReport={continueReport} />);
    expect(screen.getByRole('status', { name: 'Comprovante de emissão' })).toHaveTextContent('7/2026');
    expect(screen.getByRole('button', { name: /Novo boletim/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Novo Relatório Analítico/ })).toBeVisible();
    await screen.findByText(/FURTO FICTÍCIO/);
    const urls = fetch.mock.calls.map(c => String(c[0]));
    expect(urls.every(u => u.includes('status=DRAFT'))).toBe(true);
    await userEvent.click(screen.getAllByRole('button', { name: 'Continuar rascunho' })[1]);
    expect(continueReport).toHaveBeenCalledWith('r1');
    expect(screen.queryByText(/Baixar/)).toBeNull();
  });
  it('não consulta sugestões de registros anteriores', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ occurrence_types: [], team: [], delivery: {} }));
    vi.stubGlobal('fetch', fetch);
    render(<Wizard user={{ id: 'basico-ficticio', email: null, name: 'Básico fictício', role: 'BASICO', active: true }} token="t" onComplete={() => {}} onBack={() => {}} />);
    expect(screen.getByRole('button', { name: /Início/ })).toBeVisible();
    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });
});
