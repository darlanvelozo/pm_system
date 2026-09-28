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
export const personSchema = z.object({
  role: z.enum(roles), name: text, gender: text, birth_date: optionalDate,
  address: text, city: text, phone: text, mother_name: text, cpf: text.max(14), motivation: text, rg: text,
  eyes: text, hair: text, skin: text, beard: text, scar: text, build: text, height: text, tattoo: text,
  accessory: text, distinguishing_features: text,
  injury_level: z.enum(['', 'Leve', 'Grave', 'Gravíssima', 'Ileso']), injury_notes: text, observations: text,
  extras: extrasSchema.nullable(),
});
export const teamSchema = z.object({ vehicle: text, commander_name: text, commander_registration: text, patrol_officer_name: text, patrol_officer_registration: text });
export const bulletinSchema = z.object({
  bulletin_type: z.enum(['TWO_INVOLVED', 'FOUR_INVOLVED']), recipient_email: z.email('Informe um e-mail válido'),
  bo_number: required.max(100).regex(/^[^\r\n]+$/), dispatch_number: text, occurrence_type: required.max(200), occurrence_date: date, occurrence_time: time,
  location: z.object({ street: required, number: text, neighborhood: text, complement: text, zip_code: text.max(9), reference: text, city: required, location_type: text }),
  people: z.array(personSchema).min(2).max(4), history: z.string().trim().min(1, 'Descreva o histórico').max(40000), seized_material: z.string().max(20000),
  team: z.array(teamSchema).min(1).max(20), delivery: z.object({ unit: text, date: optionalDate, time: z.union([time, z.literal(''), z.null()]), registration: text, name: text }),
}).superRefine((data, context) => {
  const count = data.bulletin_type === 'TWO_INVOLVED' ? 2 : 4;
  if (data.people.length !== count) context.addIssue({ code: 'custom', path: ['people'], message: `Este modelo requer ${count} posições` });
  if (count === 4 && data.people.some(p => p.extras !== null)) context.addIssue({ code: 'custom', path: ['people'], message: 'BO 04 não admite campos extras' });
});
export type BulletinData = z.infer<typeof bulletinSchema>;
export type BulletinType = BulletinData['bulletin_type'];
export const bulletinProfiles = {
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
  return { bulletin_type: 'TWO_INVOLVED', recipient_email: '', bo_number: '', dispatch_number: '', occurrence_type: '', occurrence_date: '', occurrence_time: '', location: { street: '', number: '', neighborhood: '', complement: '', zip_code: '', reference: '', city: '', location_type: '' }, people: [emptyPerson(), emptyPerson()], history: '', seized_material: '', team: [emptyTeam(), emptyTeam()], delivery: { unit: '', date: '', time: '', registration: '', name: '' } };
}
export function changeProfile(data: BulletinData, type: BulletinType): BulletinData {
  const profile = bulletinProfiles[type];
  return { ...data, bulletin_type: type, people: Array.from({ length: profile.count }, (_, i) => ({ ...(data.people[i] || emptyPerson(profile.extras)), extras: profile.extras ? data.people[i]?.extras || emptyExtras() : null })) };
}
export function apiPayload(data: BulletinData) {
  return { ...data, people: data.people.map(p => ({ ...p, birth_date: p.birth_date || null })), delivery: { ...data.delivery, date: data.delivery.date || null, time: data.delivery.time || null } };
}
