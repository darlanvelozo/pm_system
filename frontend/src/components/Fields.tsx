'use client';
import { useFormContext, type FieldPath } from 'react-hook-form';
import type { BulletinData } from '@/schemas/bulletin';

export const labels: Record<string, string> = {
  bulletin_type: 'Modelo', recipient_email: 'E-mail para recebimento do Boletim', bo_number: 'Nº do BO', dispatch_number: 'Nº do despacho',
  occurrence_type: 'Tipo de ocorrência', occurrence_date: 'Data', occurrence_time: 'Hora', location: 'Local', street: 'Logradouro', number: 'Número', neighborhood: 'Bairro', complement: 'Complemento', zip_code: 'CEP', reference: 'Referência', city: 'Município', location_type: 'Tipo de local', people: 'Envolvidos',
  role: 'Classificação', name: 'Nome', gender: 'Sexo', birth_date: 'Data de nascimento', address: 'Endereço', phone: 'Telefone', mother_name: 'Mãe', cpf: 'CPF', motivation: 'Motivação', rg: 'RG', eyes: 'Olhos', hair: 'Cabelos', skin: 'Pele', beard: 'Barba', scar: 'Cicatriz', build: 'Compleição', height: 'Altura', tattoo: 'Tatuagem', accessory: 'Adereço', distinguishing_features: 'Características marcantes', injury_level: 'Lesão', injury_notes: 'Observação da lesão', observations: 'Observação', extras: 'Campos do BO 02', clothing: 'Vestimentas', transportation: 'Meios de locomoção', transportation_notes: 'Descrição da locomoção', firearm: 'Arma de fogo', drug: 'Droga', vehicle: 'Veículo / VTR', melee_weapon: 'Arma branca', selected: 'Presente', type: 'Tipo', brand: 'Marca', caliber: 'Calibre', quantity: 'Quantidade', packaging: 'Embalagem', brand_model: 'Marca/modelo', plate: 'Placa', color: 'Cor', year: 'Ano', history: 'Histórico da ocorrência', seized_material: 'Material apreendido', team: 'Efetivo empenhado', commander_name: 'Posto / Nome do comandante', commander_registration: 'Matrícula do comandante', patrol_officer_name: 'Posto / Nome do patrulheiro', patrol_officer_registration: 'Matrícula do patrulheiro', delivery: 'Unidade de entrega', unit: 'Unidade', date: 'Data', time: 'Hora', registration: 'Matrícula',
};
export function Field({ name, label, type = 'text', options, required = false, large = false }: { name: string; label?: string; type?: string; options?: readonly string[]; required?: boolean; large?: boolean }) {
  const { register, getFieldState, formState } = useFormContext<BulletinData>();
  const path = name as FieldPath<BulletinData>;
  const error = getFieldState(path, formState).error;
  const id = name.replaceAll('.', '-');
  const props = { id, ...register(path), 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : undefined };
  return <div className={large ? 'field wide' : 'field'}>
    <label htmlFor={id}>{label || labels[name.split('.').at(-1)!] || name}{required && <span className="required"> *</span>}</label>
    {options ? <select {...props}>{options.map(o => <option key={o} value={o}>{o || 'Não informado'}</option>)}</select> : large ? <textarea {...props} rows={name === 'history' ? 12 : 5} maxLength={name === 'history' ? 40000 : 20000} /> : <input {...props} type={type} maxLength={500} />}
    {error && <small id={`${id}-error`} className="error-text">{error.message}</small>}
  </div>;
}
export function Fields({ prefix = '', names }: { prefix?: string; names: string[] }) {
  return <>{names.map(n => <Field key={n} name={prefix ? `${prefix}.${n}` : n} />)}</>;
}
