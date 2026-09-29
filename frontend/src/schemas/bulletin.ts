import { z } from 'zod';

const text = z.string().trim().max(500, 'Máximo de 500 caracteres');
const required = text.min(1, 'Campo obrigatório');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida');
const optionalDate = z.union([date, z.literal(''), z.null()]);
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Informe um horário válido');
export const roles = ['', 'Autor', 'Suspeito', 'Vítima', 'Testemunha', 'Comunicante', 'Vítima Fatal'] as const;
export const transport = ['Automóvel', 'Motocicleta', 'Bicicleta', 'Animal', 'A pé', 'Outros'] as const;
const extrasSchema = z.object({
  clothing: text, transportation: z.array(z.enum(transport)), transportation_notes: text,
  firearm: z.object({ selected: z.boolean(), type: text, number: text, brand: text, caliber: text }),
  drug: z.object({ selected: z.boolean(), type: text, quantity: text, packaging: text }),
  vehicle: z.object({ selected: z.boolean(), brand_model: text, plate: text, color: text, year: text }),
  melee_weapon: z.object({ selected: z.boolean(), type: text, quantity: text }),
});
export function validCpf(value: string): boolean {
  if (!value) return true;
  if (!/^[0-9.-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || new Set(digits).size === 1) return false;
  return [9,10].every(length => ((Array.from(digits.slice(0,length)).reduce((sum,n,i) => sum + Number(n)*(length+1-i),0)*10 % 11)%10) === Number(digits[length]));
}
export const personSchema = z.object({
  id: z.uuid().optional(),
  role: z.enum(roles), name: text, gender: text, birth_date: optionalDate,
  address: text, city: text, phone: text, mother_name: text, cpf: text.max(14).refine(validCpf, 'CPF inválido'), motivation: text, rg: text,
  eyes: text, hair: text, skin: text, beard: text, scar: text, build: text, height: text, tattoo: text,
  accessory: text, distinguishing_features: text,
  injury_level: z.enum(['', 'Leve', 'Grave', 'Gravíssima', 'Ileso']), injury_notes: text, observations: text,
  extras: extrasSchema.nullable(),
});
export const teamSchema = z.object({ vehicle: text, commander_name: text, commander_registration: text, patrol_officer_name: text, patrol_officer_registration: text });
export const bulletinSchema = z.object({
  bulletin_type: z.enum(['DYNAMIC', 'TWO_INVOLVED', 'FOUR_INVOLVED']), recipient_email: z.email('Informe um e-mail válido'),
  bo_number: z.string().nullable().optional(), occurrence_summary: z.string().trim().max(80), draft_step: z.number().int().min(0).max(7), dispatch_number: text, occurrence_type: required.max(200), occurrence_date: date, occurrence_time: time,
  location: z.object({ street: required, number: text, neighborhood: text, complement: text, zip_code: text.max(9), reference: text, city: required, location_type: text }),
  people: z.array(personSchema).min(1), history: z.string().trim().min(1, 'Descreva o histórico').max(40000), seized_material: z.string().max(20000),
  team: z.array(teamSchema).min(1), delivery: z.object({ unit: text, date: optionalDate, time: z.union([time, z.literal(''), z.null()]), registration: text, name: text }),
});
export type BulletinData = z.infer<typeof bulletinSchema>;
export type BulletinType = BulletinData['bulletin_type'];
export const bulletinProfiles = {
  DYNAMIC: { count: 1, extras: true, title: 'Boletim', description: 'Envolvidos dinâmicos' },
  TWO_INVOLVED: { count: 2, extras: true, title: '02 envolvidos', description: 'Com vestimentas, locomoção e objetos por envolvido' },
  FOUR_INVOLVED: { count: 4, extras: false, title: '04 envolvidos', description: 'Identificação, características físicas e observações' },
} as const;
export function emptyExtras(): z.infer<typeof extrasSchema> {
  return { clothing: '', transportation: [], transportation_notes: '', firearm: { selected: false, type: '', number: '', brand: '', caliber: '' }, drug: { selected: false, type: '', quantity: '', packaging: '' }, vehicle: { selected: false, brand_model: '', plate: '', color: '', year: '' }, melee_weapon: { selected: false, type: '', quantity: '' } };
}
export function emptyPerson(extras = true): z.infer<typeof personSchema> {
  return { role: '', name: '', gender: '', birth_date: '', address: '', city: '', phone: '', mother_name: '', cpf: '', motivation: '', rg: '', eyes: '', hair: '', skin: '', beard: '', scar: '', build: '', height: '', tattoo: '', accessory: '', distinguishing_features: '', injury_level: '', injury_notes: '', observations: '', extras: extras ? emptyExtras() : null };
}
export const emptyTeam = () => ({ vehicle: '', commander_name: '', commander_registration: '', patrol_officer_name: '', patrol_officer_registration: '' });
export function initialData(): BulletinData {
  return { bulletin_type: 'DYNAMIC', recipient_email: '', bo_number: null, occurrence_summary: '', draft_step: 0, dispatch_number: '', occurrence_type: '', occurrence_date: '', occurrence_time: '', location: { street: '', number: '', neighborhood: '', complement: '', zip_code: '', reference: '', city: '', location_type: '' }, people: [{...emptyPerson(), id: crypto.randomUUID()}], history: '', seized_material: '', team: [emptyTeam(), emptyTeam()], delivery: { unit: '', date: '', time: '', registration: '', name: '' } };
}
// Compatibility helper: legacy layout metadata must never remove personal data.
export function changeProfile(data: BulletinData, type: BulletinType): BulletinData {
  return { ...data, bulletin_type: type };
}
export function positionLabel(index: number): string {
  let result = ''; let value = index + 1;
  while (value > 0) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
  return result;
}
export function normalizeData(data: BulletinData): BulletinData {
  return {...initialData(), ...data, occurrence_date: data.occurrence_date || '', occurrence_time: data.occurrence_time || '', people: data.people.map(p => ({...emptyPerson(), ...p, extras: p.extras || emptyExtras()}))};
}
export function apiPayload(data: BulletinData) {
  return { ...data, people: data.people.map(p => ({ ...p, birth_date: p.birth_date || null })), delivery: { ...data.delivery, date: data.delivery.date || null, time: data.delivery.time || null } };
}
