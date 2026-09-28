'use client';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Field, Fields } from '@/components/Fields';
import { bulletinProfiles, changeProfile, emptyTeam, roles, transport, type BulletinData, type BulletinType } from '@/schemas/bulletin';

export function OccurrenceHeaderForm() {
  const form = useFormContext<BulletinData>();
  const selected = form.watch('bulletin_type');
  function choose(type: BulletinType) {
    if (type === selected) return;
    if (form.formState.isDirty && !window.confirm('A troca do modelo remove os campos incompatíveis e pode remover envolvidos. Continuar?')) return;
    form.reset(changeProfile(form.getValues(), type), { keepDirty: true });
  }
  return <><Field name="recipient_email" type="email" required />
    <p className="hint">Uma cópia será enviada para este endereço e outra para o batalhão, separadamente.</p>
    <div className="model-options">{(Object.keys(bulletinProfiles) as BulletinType[]).map(type => <button type="button" className={`model-option ${selected === type ? 'selected' : ''}`} aria-pressed={selected === type} key={type} onClick={() => choose(type)}><span className="radio-dot" /><strong>{bulletinProfiles[type].title}</strong><small>{bulletinProfiles[type].description}</small></button>)}</div>
    <div className="form-grid"><Field name="bo_number" required /><Field name="dispatch_number" /><Field name="occurrence_type" required /><Field name="occurrence_date" type="date" required /><Field name="occurrence_time" type="time" required /></div>
  </>;
}
export function LocationForm() { return <div className="form-grid"><Field name="location.street" required /><Field name="location.number" /><Fields prefix="location" names={['neighborhood', 'complement', 'zip_code', 'reference']} /><Field name="location.city" required /><Field name="location.location_type" /></div>; }
export function PhysicalCharacteristicsForm({ prefix }: { prefix: string }) { return <><h4>Características físicas</h4><div className="form-grid three"><Fields prefix={prefix} names={['eyes', 'hair', 'skin', 'beard', 'scar', 'build', 'height', 'tattoo', 'accessory', 'distinguishing_features']} /></div></>; }
export function InjuryForm({ prefix }: { prefix: string }) { return <div className="form-grid"><Field name={`${prefix}.injury_level`} options={['', 'Leve', 'Grave', 'Gravíssima', 'Ileso']} /><Field name={`${prefix}.injury_notes`} /></div>; }
export function TwoInvolvedExtraFields({ index }: { index: number }) {
  const { register } = useFormContext<BulletinData>();
  const prefix = `people.${index}.extras`;
  return <><h4>Informações complementares · BO 02</h4><Field name={`${prefix}.clothing`} /><fieldset className="checkboxes"><legend>Meios de locomoção</legend>{transport.map(t => <label key={t}><input type="checkbox" value={t} {...register(`people.${index}.extras.transportation`)} />{t}</label>)}</fieldset><Field name={`${prefix}.transportation_notes`} />
    {([
      ['firearm', 'Arma de fogo', ['type', 'number', 'brand', 'caliber']],
      ['drug', 'Droga', ['type', 'quantity', 'packaging']],
      ['vehicle', 'Veículo', ['brand_model', 'plate', 'color', 'year']],
      ['melee_weapon', 'Arma branca', ['type', 'quantity']],
    ] as const).map(([key, title, fields]) => <fieldset className="extra-box" key={key}><legend><label><input type="checkbox" {...register(`people.${index}.extras.${key}.selected`)} /> {title}</label></legend><div className="form-grid"><Fields prefix={`${prefix}.${key}`} names={[...fields]} /></div></fieldset>)}
  </>;
}
export function InvolvedForm() {
  const { watch } = useFormContext<BulletinData>();
  const profile = bulletinProfiles[watch('bulletin_type')];
  return <>{Array.from({ length: profile.count }, (_, i) => <section className="person-section" key={i}><h3><span className="letter">{String.fromCharCode(65+i)}</span> Envolvido {String.fromCharCode(65+i)}</h3><div className="form-grid"><Field name={`people.${i}.role`} options={roles} /><Field name={`people.${i}.name`} /><Field name={`people.${i}.gender`} /><Field name={`people.${i}.birth_date`} type="date" /><Fields prefix={`people.${i}`} names={['address', 'city', 'phone', 'mother_name', 'cpf', 'motivation', 'rg']} /></div><PhysicalCharacteristicsForm prefix={`people.${i}`} /><InjuryForm prefix={`people.${i}`} />{profile.extras ? <TwoInvolvedExtraFields index={i} /> : <Field name={`people.${i}.observations`} />}</section>)}</>;
}
export function HistoryForm() { return <><p className="hint">Registre os fatos com clareza. O texto completo será incluído no documento, com páginas adicionais quando necessário.</p><Field name="history" large required /></>; }
export function SeizedMaterialForm() { return <><p className="hint">Campo opcional. Nenhum texto será preenchido automaticamente.</p><Field name="seized_material" large /></>; }
export function PoliceTeamForm() {
  const { control } = useFormContext<BulletinData>();
  const { fields, append, remove } = useFieldArray({ control, name: 'team' });
  return <>{fields.map((f, i) => <section className="person-section" key={f.id}><div className="section-line"><h3>Equipe {i+1}</h3>{fields.length > 1 && <button className="text-button" type="button" onClick={() => remove(i)}>Remover equipe</button>}</div><div className="form-grid"><Fields prefix={`team.${i}`} names={['vehicle', 'commander_name', 'commander_registration', 'patrol_officer_name', 'patrol_officer_registration']} /></div></section>)}<button className="secondary" type="button" disabled={fields.length >= 20} onClick={() => append(emptyTeam())}>+ Adicionar equipe</button></>;
}
export function DeliveryForm() { return <><div className="form-grid"><Field name="delivery.unit" /><Field name="delivery.date" type="date" /><Field name="delivery.time" type="time" /><Fields prefix="delivery" names={['registration', 'name']} /></div><p className="hint">O PDF terá um espaço para assinatura manual na unidade de entrega.</p></>; }
