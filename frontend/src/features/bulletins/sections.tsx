'use client';
import { useState, useLayoutEffect } from 'react';
import { Modal } from '@/components/Modal';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Field, Fields } from '@/components/Fields';
import { emptyPerson, emptyTeam, personSchema, positionLabel, roles, transport, type BulletinData } from '@/schemas/bulletin';

export function OccurrenceHeaderForm({suggestions = []}: {suggestions?: string[]}) {
  const {register, watch} = useFormContext<BulletinData>();
  return <><Field name="recipient_email" type="email" required />
    <p className="hint">Uma cópia será enviada para este endereço e outra para o batalhão, separadamente.</p>
    <p>Nº do BO: <strong>{watch('bo_number') || 'Será gerado automaticamente na emissão'}</strong></p>
    <div className="form-grid"><Field name="dispatch_number" /><label className="field">Tipo de ocorrência *<input id="occurrence_type" list="occurrence-types" {...register('occurrence_type')} required maxLength={200}/><datalist id="occurrence-types">{[...new Set([...suggestions, 'Outro'])].map(s => <option key={s} value={s}/>)}</datalist></label><label className="field">Descrição breve da ocorrência<input id="occurrence_summary" {...register('occurrence_summary')} maxLength={80}/><small>Não informe nomes, CPF, RG ou outros dados pessoais neste campo.</small></label><Field name="occurrence_date" type="date" required /><Field name="occurrence_time" type="time" required /></div>
  </>;
}
export function LocationForm() { return <div className="form-grid"><Field name="location.street" required /><Field name="location.number" /><Fields prefix="location" names={['neighborhood', 'complement', 'zip_code', 'reference']} /><Field name="location.city" required /><Field name="location.location_type" /></div>; }
export function PhysicalCharacteristicsForm({ prefix }: { prefix: string }) { return <><h4>Características físicas</h4><div className="form-grid three"><Fields prefix={prefix} names={['eyes', 'hair', 'skin', 'beard', 'scar', 'build', 'height', 'tattoo', 'accessory', 'distinguishing_features']} /></div></>; }
export function InjuryForm({ prefix }: { prefix: string }) { return <div className="form-grid"><Field name={`${prefix}.injury_level`} options={['', 'Leve', 'Grave', 'Gravíssima', 'Ileso']} /><Field name={`${prefix}.injury_notes`} /></div>; }
export function TwoInvolvedExtraFields({ index }: { index: number }) {
  const { register } = useFormContext<BulletinData>();
  const prefix = `people.${index}.extras`;
  return <><h4>Informações complementares</h4><Field name={`${prefix}.clothing`} /><fieldset className="checkboxes"><legend>Meios de locomoção</legend>{transport.map(t => <label key={t}><input type="checkbox" value={t} {...register(`people.${index}.extras.transportation`)} />{t}</label>)}</fieldset><Field name={`${prefix}.transportation_notes`} />
    {([
      ['firearm', 'Arma de fogo', ['type', 'number', 'brand', 'caliber']],
      ['drug', 'Droga', ['type', 'quantity', 'packaging']],
      ['vehicle', 'Veículo', ['brand_model', 'plate', 'color', 'year']],
      ['melee_weapon', 'Arma branca', ['type', 'quantity']],
    ] as const).map(([key, title, fields]) => <fieldset className="extra-box" key={key}><legend><label><input type="checkbox" {...register(`people.${index}.extras.${key}.selected`)} /> {title}</label></legend><div className="form-grid"><Fields prefix={`${prefix}.${key}`} names={[...fields]} /></div></fieldset>)}
  </>;
}
export function InvolvedForm({initialIndex = 0}: {initialIndex?: number}) {
  const { control, watch, getValues, setValue, trigger } = useFormContext<BulletinData>();
  const { fields, append, remove } = useFieldArray({control, name: 'people', keyName: 'fieldKey'});
  const [open, setOpen] = useState(initialIndex);
  const [removing, setRemoving] = useState<number | null>(null);
  const people = watch('people');
  const activeKey = fields[open]?.fieldKey;
  useLayoutEffect(() => {
    if (!activeKey) return;
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(`person-${activeKey}`);
      card?.scrollIntoView({block:'start', behavior:'smooth'});
      card?.querySelector<HTMLElement>('select,input')?.focus({preventScroll:true});
    });
    return () => cancelAnimationFrame(frame);
  }, [activeKey]);
  function discard(index: number) {
    remove(index); setOpen(Math.max(0, index - 1)); setRemoving(null);
  }
  function add() {
    append({...emptyPerson(), id: crypto.randomUUID()}, {shouldFocus:false}); setOpen(fields.length);
  }
  const complete = people.filter(p => personSchema.safeParse(p).success).length;
  return <><p>{fields.length} cadastrados · {complete} completos · {fields.length-complete} com pendência</p>{fields.map((field, i) => <section id={`person-${field.fieldKey}`} className="person-section" key={field.fieldKey}>
    <div className="section-line"><h3>Envolvido {positionLabel(i)}</h3><button className="secondary" type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>Editar envolvido {positionLabel(i)}</button></div>
    <p>{people[i]?.role || 'Classificação não informada'} · {people[i]?.name || 'Nome não informado'}</p><p>{personSchema.safeParse(people[i]).success ? 'Dados obrigatórios preenchidos' : 'Existem pendências'}</p>
    {open === i && <><div className="form-grid"><Field name={`people.${i}.role`} options={roles}/><Field name={`people.${i}.name`}/><Field name={`people.${i}.gender`}/><Field name={`people.${i}.birth_date`} type="date"/><Fields prefix={`people.${i}`} names={['address', 'city', 'phone', 'mother_name', 'cpf', 'motivation', 'rg']}/></div><PhysicalCharacteristicsForm prefix={`people.${i}`}/><InjuryForm prefix={`people.${i}`}/><TwoInvolvedExtraFields index={i}/><Field name={`people.${i}.observations`}/></>}
    {open === i && <div className="action-row"><button type="button" className="secondary" onClick={() => setValue(`people.${i}.city`, getValues('location.city'), {shouldDirty:true})}>Usar município da ocorrência: {getValues('location.city') || 'não informado'}</button><button type="button" className="secondary" disabled={!i} onClick={() => setOpen(i-1)}>← Envolvido anterior</button>{i < fields.length-1 ? <button type="button" className="secondary" onClick={() => setOpen(i+1)}>Próximo envolvido →</button> : <button type="button" className="secondary" onClick={add}>+ Adicionar outro envolvido</button>}<button type="button" className="text-button" onClick={async () => {if(await trigger(`people.${i}`)) {if(i < fields.length-1) setOpen(i+1); else add();}}}>Continuar para próximo envolvido</button></div>}
    <button className="text-button" type="button" disabled={fields.length <= 1} onClick={() => {
      const {id: _id, ...person} = getValues(`people.${i}`); void _id;
      if (JSON.stringify(person) !== JSON.stringify(emptyPerson())) setRemoving(i); else discard(i);
    }}>Remover envolvido {positionLabel(i)}</button>
  </section>)}<button className="secondary" type="button" onClick={add}>+ Adicionar envolvido</button>
  {removing !== null && <Modal title={`Remover envolvido ${positionLabel(removing)}`} onClose={() => setRemoving(null)}><p>Os dados desta pessoa serão removidos do formulário. As demais pessoas serão mantidas.</p><button className="primary" type="button" onClick={() => discard(removing)}>Confirmar remoção</button></Modal>}</>;
}
export function HistoryForm() { return <><p className="hint">Registre os fatos com clareza. O texto completo será incluído no documento, com páginas adicionais quando necessário.</p><Field name="history" large required /></>; }
export function SeizedMaterialForm() { return <><p className="hint">Campo opcional. Nenhum texto será preenchido automaticamente.</p><Field name="seized_material" large /></>; }
export function PoliceTeamForm() {
  const { control } = useFormContext<BulletinData>();
  const { fields, append, remove } = useFieldArray({ control, name: 'team' });
  return <>{fields.map((f, i) => <section className="person-section" key={f.id}><div className="section-line"><h3>Equipe {i+1}</h3>{fields.length > 1 && <button className="text-button" type="button" onClick={() => remove(i)}>Remover equipe</button>}</div><div className="form-grid"><Fields prefix={`team.${i}`} names={['vehicle', 'commander_name', 'commander_registration', 'patrol_officer_name', 'patrol_officer_registration']} /></div></section>)}<button className="secondary" type="button" onClick={() => append(emptyTeam())}>+ Adicionar equipe</button></>;
}
export function DeliveryForm() { return <><div className="form-grid"><Field name="delivery.unit" /><Field name="delivery.date" type="date" /><Field name="delivery.time" type="time" /><Fields prefix="delivery" names={['registration', 'name']} /></div><p className="hint">O PDF terá um espaço para assinatura manual na unidade de entrega.</p></>; }
