import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { initialData, changeProfile, bulletinSchema, apiPayload, type BulletinData } from '@/schemas/bulletin';
import { OccurrenceHeaderForm, InvolvedForm } from '@/features/bulletins/sections';
import { ReviewStep } from '@/features/bulletins/ReviewStep';
import { Wizard } from '@/features/bulletins/Wizard';
import { draftKey, loadDraft } from '@/hooks/useDraft';
import { api } from '@/services/api';

function ProfileForm() {
  const form = useForm<BulletinData>({ defaultValues: initialData() });
  return <FormProvider {...form}><OccurrenceHeaderForm /><InvolvedForm /></FormProvider>;
}
const user = { id: 'fictional-user-id', email: 'operator@example.com', name: 'Operador fictício', role: 'OPERADOR' as const, active: true };
function validData() {
  return { ...initialData(), recipient_email: 'recipient@example.com', bo_number: 'TEST-01', occurrence_type: 'Teste', occurrence_date: '2026-01-01', occurrence_time: '12:00', location: { ...initialData().location, street: 'Rua fictícia', city: 'Cidade fictícia' }, history: 'Histórico de teste' };
}
describe('perfis e validação', () => {
  it('alterna BO 02 e BO 04 e muda campos individuais', async () => {
    render(<ProfileForm />);
    expect(screen.getAllByLabelText('Vestimentas')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: /04 envolvidos/ }));
    expect(screen.queryByLabelText('Vestimentas')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Nome')).toHaveLength(4);
    expect(screen.getAllByLabelText('Observação')).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: /02 envolvidos/ }));
    expect(screen.getAllByLabelText('Vestimentas')).toHaveLength(2);
  }, 15000);
  it('valida e-mail e impede extras no BO 04', () => {
    expect(bulletinSchema.safeParse(validData()).success).toBe(true);
    expect(bulletinSchema.safeParse({ ...validData(), recipient_email: 'invalid' }).success).toBe(false);
    const four = changeProfile(validData(), 'FOUR_INVOLVED');
    expect(four.people).toHaveLength(4);
    expect(four.people.every(p => p.extras === null)).toBe(true);
    expect(apiPayload(four).delivery.date).toBeNull();
  });
  it('revisão mostra destinatário e histórico', () => {
    render(<ReviewStep data={validData()} />);
    expect(screen.getByText('recipient@example.com')).toBeInTheDocument();
    expect(screen.getByText('Histórico de teste')).toBeInTheDocument();
  });
});
describe('rascunho, etapas e API', () => {
  it('recupera rascunho por usuário e ignora dados corrompidos', () => {
    localStorage.setItem(draftKey(user.id), JSON.stringify({ savedAt: Date.now(), data: validData() }));
    expect(loadDraft(user.id)?.bo_number).toBe('TEST-01');
    expect(loadDraft('another-user')).toBeNull();
    localStorage.setItem(draftKey(user.id), '{broken');
    expect(loadDraft(user.id)).toBeNull();
  });
  it('impede avançar sem preenchimento e preserva rascunho ao digitar', async () => {
    render(<Wizard user={user} token="fictional-token" onBack={vi.fn()} onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByText('ETAPA 1 DE 8')).toBeInTheDocument();
    expect(screen.getByText('Informe um e-mail válido')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/E-mail para recebimento/), 'draft@example.com');
    await waitFor(() => expect(loadDraft(user.id)?.recipient_email).toBe('draft@example.com'));
  });
  it('avança e volta sem perder dados recuperados', async () => {
    localStorage.setItem(draftKey(user.id), JSON.stringify({ savedAt: Date.now(), data: validData() }));
    render(<Wizard user={user} token="fictional-token" onBack={vi.fn()} onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByText('ETAPA 2 DE 8')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Voltar e corrigir/ }));
    expect(screen.getByLabelText(/Nº do BO/)).toHaveValue('TEST-01');
  });
  it('retorna erros seguros da API e falhas de conexão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ detail: 'Número já utilizado' }) }));
    await expect(api('/api/bo')).rejects.toThrow('Número já utilizado');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(api('/api/bo')).rejects.toThrow('Seu rascunho foi preservado');
    vi.unstubAllGlobals();
  });
});
