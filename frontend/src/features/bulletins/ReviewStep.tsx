import { labels } from '@/components/Fields';
import { positionLabel, type BulletinData } from '@/schemas/bulletin';

function Value({ value }: { value: unknown }) {
  if (value === undefined) return null;
  if (value === null || value === '') return <span className="muted">Não informado</span>;
  if (typeof value === 'boolean') return <>{value ? 'Sim' : 'Não'}</>;
  if (Array.isArray(value)) return <>{value.map((item, i) => <div className="review-array" key={i}>{typeof item === 'object' && <h4>Registro {i+1}</h4>}<Value value={item} /></div>)}</>;
  if (typeof value === 'object') return <dl className="review-grid">{Object.entries(value as Record<string, unknown>).filter(([key,v]) => !['id','bulletin_type','draft_step'].includes(key) && !(key === 'extras' && v === null)).map(([key,v]) => <div className={typeof v === 'object' ? 'wide' : ''} key={key}><dt>{labels[key] || key}</dt><dd><Value value={v} /></dd></div>)}</dl>;
  return <>{String(value)}</>;
}
export function ReviewStep({ data, notice = true }: { data: BulletinData; notice?: boolean }) {
  return <div className="review">{notice && <div className="notice">Confira os dados e o e-mail antes de emitir. Após a emissão, o boletim fica disponível para consulta e download.</div>}<Value value={{...data, bo_number: data.bo_number || 'Será gerado automaticamente na emissão', people: undefined}} />{data.people.map((person, i) => <section key={person.id || i}><h3>Envolvido {positionLabel(i)}</h3><Value value={person}/></section>)}</div>;
}
