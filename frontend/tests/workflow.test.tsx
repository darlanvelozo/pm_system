import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { initialData, changeProfile, bulletinSchema, apiPayload, validCpf, positionLabel, emptyPerson, type BulletinData } from '@/schemas/bulletin';
import { OccurrenceHeaderForm, InvolvedForm } from '@/features/bulletins/sections';
import { ReviewStep } from '@/features/bulletins/ReviewStep';
import { Wizard } from '@/features/bulletins/Wizard';
import { draftKey, loadDraft, clearUserDrafts } from '@/hooks/useDraft';
import { api } from '@/services/api';

Element.prototype.scrollIntoView = vi.fn();
function ProfileForm() {
  const form = useForm<BulletinData>({ defaultValues: initialData() });
  return <FormProvider {...form}><OccurrenceHeaderForm /><InvolvedForm /></FormProvider>;
}
const user = { id: 'fictional-user-id', email: 'operator@example.com', name: 'Operador fictício', role: 'OPERADOR' as const, active: true };
function validData() {
  return { ...initialData(), recipient_email: 'recipient@example.com', bo_number: 'TEST-01', occurrence_type: 'Teste', occurrence_date: '2026-01-01', occurrence_time: '12:00', location: { ...initialData().location, street: 'Rua fictícia', city: 'Cidade fictícia' }, history: 'Histórico de teste' };
}
describe('perfis e validação', () => {
  it('adiciona pessoas sem apagar dados complementares', async () => {
    render(<ProfileForm />);
    expect(screen.getAllByLabelText('Vestimentas')).toHaveLength(1);
    await userEvent.type(screen.getByLabelText('Nome', {exact:true}), 'Pessoa A');
    await userEvent.type(screen.getByLabelText('Vestimentas'), 'Roupa A');
    await userEvent.click(screen.getByRole('button', {name: /Adicionar envolvido/}));
    await userEvent.type(screen.getByLabelText('Nome', {exact:true}), 'Pessoa B');
    await userEvent.click(screen.getByRole('button', {name: 'Editar envolvido A'}));
    expect(screen.getByLabelText('Nome', {exact:true})).toHaveValue('Pessoa A');
    expect(screen.getByLabelText('Vestimentas')).toHaveValue('Roupa A');
  }, 15000);
  it('valida email sem limitar quantidade ou apagar extras', () => {
    expect(bulletinSchema.safeParse(validData()).success).toBe(true);
    expect(bulletinSchema.safeParse({...validData(), recipient_email:'invalid'}).success).toBe(false);
    const original = validData();
    const changed = changeProfile(original, 'FOUR_INVOLVED');
    expect(changed.people).toEqual(original.people);
    expect(apiPayload(changed).delivery.date).toBeNull();
  });
  it('revisão mostra destinatário e histórico', () => {
    render(<ReviewStep data={validData()} />);
    expect(screen.getByText('recipient@example.com')).toBeInTheDocument();
    expect(screen.getByText('Histórico de teste')).toBeInTheDocument();
  });
});
describe('rascunho, etapas e API', () => {
  it('separa registros e rejeita rascunho de versão antiga', () => {
    localStorage.setItem(draftKey(user.id, 'record-a'), JSON.stringify({version: 3, savedAt: Date.now(), data: validData()}));
    expect(loadDraft(user.id, 'record-a', 3)?.bo_number).toBe('TEST-01');
    expect(loadDraft(user.id, 'record-a', 4)).toBeNull();
    expect(loadDraft(user.id, 'record-b', 3)).toBeNull();
    localStorage.setItem(draftKey('other-user'), 'preserve');
    clearUserDrafts(user.id);
    expect(loadDraft(user.id, 'record-a', 3)).toBeNull();
    expect(localStorage.getItem(draftKey('other-user'))).toBe('preserve');
  });
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
    expect(screen.getByLabelText(/Tipo de ocorrência/)).toHaveValue('Teste');
  });
  it('retorna erros seguros da API e falhas de conexão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ detail: 'Número já utilizado' }) }));
    await expect(api('/api/bo')).rejects.toThrow('Número já utilizado');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(api('/api/bo')).rejects.toThrow('Seu rascunho foi preservado');
    vi.unstubAllGlobals();
  });
});

describe('quantidade dinâmica e CPF opcional', () => {
  it.each([1,2,3,4,5,8,12,30])('aceita %i envolvidos', count => {
    expect(bulletinSchema.safeParse({...validData(), people: Array.from({length:count}, () => emptyPerson())}).success).toBe(true);
  });
  it('mantém sequência depois de Z e valida dígitos do CPF', () => {
    expect([25,26,29].map(positionLabel)).toEqual(['Z','AA','AD']);
    expect(validCpf('')).toBe(true);
    expect(validCpf('111.111.111-11')).toBe(false);
    expect(validCpf('529.982.247-25')).toBe(true);
  });
});
