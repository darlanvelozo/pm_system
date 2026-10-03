// Regenerates screenshots and example attachments of the in-app guide (docs/guia.md).
// Usage (frontend/, with backend and `npm run dev` running):
//   GUIDE_ADMIN_USERNAME=... GUIDE_ADMIN_PASSWORD=... node scripts/capture-guide.mjs
// Creates/reuses the fictitious account `guia.exemplo` (Usuário comum) with fictitious records only.
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { chromium, webkit, devices } from '@playwright/test';

const BASE = process.env.GUIDE_BASE_URL || 'http://localhost:3000';
const API = process.env.GUIDE_API_URL || 'http://localhost:8000';
const OUT = 'public/guia';
const MANIFEST = 'src/features/guide/screenshots.json';
const ADMIN = { username: process.env.GUIDE_ADMIN_USERNAME, password: process.env.GUIDE_ADMIN_PASSWORD };
if (!ADMIN.username || !ADMIN.password) throw new Error('Defina GUIDE_ADMIN_USERNAME e GUIDE_ADMIN_PASSWORD.');
const GUIDE_USER = { username: 'guia.exemplo', name: 'Sd. Exemplo Fictício', password: `Guia-${randomBytes(9).toString('base64url')}` };
const sharp = (await import('sharp').catch(() => null))?.default;
const manifest = {};

async function call(path, token, init = {}) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${path}: ${response.status} ${await response.text()}`);
  return response.headers.get('content-type')?.includes('json') ? response.json() : Buffer.from(await response.arrayBuffer());
}
const login = account => call('/api/auth/login', null, { method: 'POST', body: JSON.stringify(account) });

const bulletin = (n, summary, type) => ({
  bulletin_type: 'DYNAMIC', recipient_email: 'recebimento@example.com', occurrence_summary: summary, occurrence_type: type,
  occurrence_date: '2026-09-28', occurrence_time: `1${n}:30`,
  location: { street: 'Rua das Acácias (fictícia)', number: `${100 + n}`, neighborhood: 'Bairro Exemplo', city: 'Cidade Exemplo', location_type: 'Via pública' },
  people: [{ role: 'Comunicante', name: 'Pessoa Fictícia A', gender: 'Não informado' }, { role: 'Testemunha', name: 'Pessoa Fictícia B' }],
  history: 'Relato inteiramente fictício, criado para o guia de uso do sistema. Nenhum fato, pessoa ou local real é descrito.',
  seized_material: n === 1 ? 'Objeto fictício de exemplo (1 unidade).' : '',
  team: [{ vehicle: 'VTR 0000 (fictícia)', commander_name: 'Sgt. Exemplo', commander_registration: '000000', patrol_officer_name: 'Sd. Exemplo', patrol_officer_registration: '000001' }],
  delivery: { unit: 'Delegacia Exemplo', date: null, time: null, registration: '', name: '' },
});
const report = {
  recipient_email: 'recebimento@example.com', occurrence_type: 'PERTURBAÇÃO DO SOSSEGO (EXEMPLO)', location: 'Rua das Acácias (fictícia), Bairro Exemplo',
  occurrence_date: '2026-09-28', occurrence_time: '21:15', victims: 'Pessoa Fictícia A', involved: 'Pessoa Fictícia B', witnesses: 'Não houve',
  seized_material: 'Nenhum', weapon_type: 'Nenhuma', others: 'Equipamento de som (fictício)', fled: 'NÃO', samu: 'NÃO', icrim: 'NÃO',
  cause: 'Som em volume elevado (exemplo)', teams: 'VTR 0000 — Sgt. Exemplo e Sd. Exemplo (fictícios)',
  narrative: 'Relato fictício para demonstração do Relatório Analítico de Ocorrência. Nenhum dado real.',
  measures: 'Orientação às partes (exemplo fictício).', closing_location: 'Cidade Exemplo', closing_date: '2026-09-28',
};

async function seed() {
  const admin = await login(ADMIN);
  let found;
  for (let page = 1; !found; page++) {
    const users = await call(`/api/admin/users?page=${page}`, admin.access_token);
    found = users.find(u => u.username === GUIDE_USER.username);
    if (users.length < 50) break;
  }
  if (found) await call(`/api/admin/users/${found.id}`, admin.access_token, { method: 'PATCH', body: JSON.stringify({ password: GUIDE_USER.password, active: true, role: 'OPERADOR' }) });
  else await call('/api/admin/users', admin.access_token, { method: 'POST', body: JSON.stringify({ ...GUIDE_USER, role: 'OPERADOR' }) });
  const user = await login({ username: GUIDE_USER.username, password: GUIDE_USER.password });
  const t = user.access_token;
  const list = await call('/api/bo?size=50', t);
  const issued = list.items.filter(b => b.status === 'ISSUED');
  const seeds = [['Abordagem de rotina sem ocorrências', 'AVERIGUAÇÃO (EXEMPLO)'], ['Discussão entre vizinhos', 'PERTURBAÇÃO DO SOSSEGO (EXEMPLO)'], ['Objeto encontrado em via pública', 'ACHADO DE OBJETO (EXEMPLO)']];
  for (let i = issued.length; i < 3; i++) await call('/api/bo', t, { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ data: bulletin(i, ...seeds[i]), emit: true }) });
  if (!list.items.some(b => b.status === 'DRAFT')) await call('/api/bo', t, { method: 'POST', body: JSON.stringify({ data: { ...bulletin(4, 'Rascunho de exemplo', 'APOIO (EXEMPLO)'), draft_step: 2 }, emit: false }) });
  const reports = await call('/api/analytical-reports?size=50', t);
  if (!reports.items.some(r => r.status === 'ISSUED')) {
    const draft = await call('/api/analytical-reports', t, { method: 'POST', body: JSON.stringify({ data: report }) });
    await call(`/api/analytical-reports/${draft.id}/emit`, t, { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ version: draft.version }) });
  }
  return { admin, user, bulletins: (await call('/api/bo?size=50', t)).items, reports: (await call('/api/analytical-reports?size=50', t)).items };
}

async function context(kind, options, sessions) {
  const browser = await kind.launch(kind === chromium ? { args: ['--lang=pt-BR'] } : {});
  const ctx = await browser.newContext({ ...options, locale: 'pt-BR', timezoneId: 'America/Fortaleza', acceptDownloads: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    const hide = () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}*{caret-color:transparent!important}'; document.documentElement.appendChild(s); };
    if (document.documentElement) hide(); else document.addEventListener('DOMContentLoaded', hide);
    try { localStorage.setItem('bo24:install-dismissed', '1'); } catch { /* ignore */ }
  });
  // Login answers come from sessions opened once above, keeping below the 10 logins/min limiter.
  await ctx.route('**/api/auth/login', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = JSON.parse(route.request().postData() || '{}');
    const session = sessions[body.username];
    return session ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session), headers: { 'access-control-allow-origin': BASE } }) : route.continue();
  });
  return { browser, ctx };
}
async function enter(page, username) {
  await page.goto(BASE);
  await page.getByLabel('Usuário', { exact: true }).fill(username);
  await page.getByLabel('Senha', { exact: true }).fill('********');
  await page.getByRole('button', { name: 'Acessar sistema' }).click();
  await page.getByRole('heading', { name: 'Painel de boletins' }).waitFor();
}
async function save(name, buffer) {
  const image = sharp ? sharp(buffer) : null;
  const meta = image ? await image.metadata() : { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  // Wide desktop captures are downscaled; WebP keeps the folder small.
  const width = Math.min(meta.width, 1366);
  const file = sharp ? `${name}.webp` : `${name}.png`;
  if (sharp) await image.resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(`${OUT}/${file}`);
  else writeFileSync(`${OUT}/${file}`, buffer);
  manifest[name] = { src: `/guia/${file}`, width, height: Math.round(meta.height * width / meta.width) };
  console.log('ok', file);
}
async function shot(page, name, target, maxHeight = 1100) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
  let buffer;
  if (target) {
    // Very tall elements (e.g. the involved-person form) are cropped to their top part.
    const element = page.locator(target).first();
    await element.scrollIntoViewIfNeeded();
    const box = await element.boundingBox();
    buffer = box.height > maxHeight
      ? await page.screenshot({ animations: 'disabled', fullPage: true, clip: { x: box.x, y: box.y + await page.evaluate(() => scrollY), width: box.width, height: maxHeight } })
      : await element.screenshot({ animations: 'disabled' });
  } else buffer = await page.screenshot({ animations: 'disabled' });
  await save(name, buffer);
}
const forward = page => page.getByRole('button', { name: 'Continuar', exact: true }).click();

async function fillWizard(page, capture) {
  await page.getByLabel(/E-mail para recebimento/).fill('recebimento@example.com');
  await page.getByLabel(/Descrição breve/).fill('Discussão entre vizinhos');
  await page.getByLabel(/Tipo de ocorrência/).fill('PERTURBAÇÃO DO SOSSEGO (EXEMPLO)');
  await page.getByLabel('Data *', { exact: true }).fill('2026-09-28');
  await page.getByLabel('Hora *', { exact: true }).fill('21:15');
  await capture('bo-etapa-1'); await forward(page);
  await page.locator('#location-street').fill('Rua das Acácias (fictícia)');
  await page.locator('#location-number').fill('120');
  await page.locator('#location-neighborhood').fill('Bairro Exemplo');
  await page.locator('#location-city').fill('Cidade Exemplo');
  await capture('bo-etapa-2'); await forward(page);
  await page.locator('#people-0-role').selectOption('Comunicante');
  await page.locator('#people-0-name').fill('Pessoa Fictícia A');
  await capture('bo-etapa-3'); await forward(page);
  await page.getByLabel(/Histórico da ocorrência/).fill('Relato inteiramente fictício, criado para o guia de uso. Nenhum fato, pessoa ou local real é descrito.');
  await capture('bo-etapa-4'); await forward(page); await forward(page);
  await page.locator('#team-0-vehicle').fill('VTR 0000 (fictícia)');
  await page.locator('#team-0-commander_name').fill('Sgt. Exemplo');
  await capture('bo-etapa-6'); await forward(page); await forward(page);
  await capture('bo-etapa-8');
}

const fakeUsers = [['Administrador Exemplo', 'admin.exemplo', 'ADMIN', true], ['Sd. Exemplo Fictício', 'guia.exemplo', 'OPERADOR', true], ['Cb. Modelo de Teste', 'cb.modelo', 'OPERADOR', true], ['Sgt. Usuário Inativo', 'sgt.inativo', 'OPERADOR', false]]
  .map(([name, username, role, active], i) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, name, username, email: null, role, active }));
const fakeAudit = [['SETTINGS_UPDATED', 'SUCCESS', { fields: ['signatory_name', 'signatory_title'] }], ['EMAIL_TO_BATTALION_FAILED', 'FAILED'], ['PDF_GENERATED', 'SUCCESS'], ['BO_CREATED', 'SUCCESS'], ['USER_CREATED', 'SUCCESS'], ['USER_LOGIN', 'SUCCESS']]
  .map(([action, result, details], i) => ({ id: `a${i}`, action, result, details: details || null, user_id: 'x', user_name: i % 2 ? 'Sd. Exemplo Fictício' : 'Administrador Exemplo', username: i % 2 ? 'guia.exemplo' : 'admin.exemplo', bulletin_id: null, created_at: new Date(Date.UTC(2026, 8, 28, 15, 40 - i * 7)).toISOString() }));

async function main() {
  mkdirSync(`${OUT}/anexos`, { recursive: true });
  for (const f of readdirSync(OUT)) if (/\.(png|webp)$/.test(f)) rmSync(`${OUT}/${f}`);
  const data = await seed();
  const sessions = { [ADMIN.username]: data.admin, [GUIDE_USER.username]: data.user };
  const boId = data.bulletins.find(b => b.status === 'ISSUED').id;

  // Desktop, Usuário comum.
  let { browser, ctx } = await context(chromium, { viewport: { width: 1366, height: 900 } }, sessions);
  let page = await ctx.newPage();
  await page.goto(BASE); await shot(page, 'login');
  await enter(page, GUIDE_USER.username);
  await shot(page, 'painel');
  await page.getByText('Mais filtros').click(); await shot(page, 'filtros', '.table-card');
  await page.getByRole('button', { name: 'Novo boletim', exact: true }).first().click();
  await fillWizard(page, name => shot(page, name, '.wizard-card'));
  const preview = page.waitForResponse(r => r.url().endsWith('/preview-pdf'));
  await page.getByRole('button', { name: 'Visualizar prévia do PDF' }).click(); await preview;
  await page.waitForTimeout(1500); await shot(page, 'previa');
  await page.getByRole('button', { name: 'Fechar diálogo' }).click();
  await page.getByRole('button', { name: 'Painel de boletins' }).click();
  await page.getByRole('button', { name: /^Abrir boletim|^Visualizar / }).first().waitFor({ state: 'attached' });
  await page.locator('.desktop-bulletins .record-link').filter({ hasNotText: 'Rascunho' }).first().click();
  await page.getByRole('heading', { name: 'Boletim gerado com sucesso' }).waitFor();
  await shot(page, 'emitido');
  await shot(page, 'detalhe', '.card:has(.delivery-status)');
  await page.goto(`${BASE}/verificar/${boId}?revision=1`);
  await page.getByLabel('Usuário', { exact: true }).fill(GUIDE_USER.username);
  await page.getByLabel('Senha', { exact: true }).fill('********');
  await page.getByRole('button', { name: 'Acessar sistema' }).click();
  await page.getByText('SHA-256:').waitFor(); await shot(page, 'verificar');
  await page.goto(BASE); await enter(page, GUIDE_USER.username);
  await page.getByRole('button', { name: 'Novo Relatório Analítico' }).first().click();
  await page.getByLabel('E-mail para recebimento').fill('recebimento@example.com');
  await page.getByLabel('Código/Tipo de Ocorrência').fill('PERTURBAÇÃO DO SOSSEGO (EXEMPLO)');
  await shot(page, 'relatorio-form');
  await page.getByRole('button', { name: 'Relatórios Analíticos', exact: true }).click();
  await page.getByRole('button', { name: /^Abrir relatório \d/ }).last().click();
  await page.getByRole('button', { name: 'Baixar PDF do relatório' }).waitFor(); await shot(page, 'relatorio-detalhe');
  await browser.close();

  // Desktop, Administrador (lists of users/audit are mocked with fictitious rows).
  ({ browser, ctx } = await context(chromium, { viewport: { width: 1366, height: 900 } }, sessions));
  await ctx.route('**/api/admin/users?*', r => r.request().method() === 'GET' ? r.fulfill({ json: fakeUsers, headers: { 'access-control-allow-origin': BASE } }) : r.continue());
  await ctx.route('**/api/admin/audit?*', r => r.fulfill({ json: fakeAudit, headers: { 'access-control-allow-origin': BASE } }));
  page = await ctx.newPage();
  await enter(page, ADMIN.username);
  await page.getByRole('button', { name: 'Usuários', exact: true }).click();
  await page.getByRole('cell', { name: 'cb.modelo' }).waitFor(); await shot(page, 'admin-usuarios');
  await page.getByRole('button', { name: 'Editar' }).nth(2).click(); await shot(page, 'admin-editar-usuario', 'dialog');
  await page.getByRole('button', { name: 'Fechar diálogo' }).click();
  await page.getByRole('button', { name: 'Auditoria', exact: true }).click();
  await page.getByText('Configurações alteradas').waitFor(); await shot(page, 'admin-auditoria');
  await page.getByRole('button', { name: 'Estatísticas', exact: true }).click();
  await page.getByText('Tipos mais registrados').waitFor(); await shot(page, 'admin-estatisticas');
  await page.getByRole('button', { name: 'Painel de boletins', exact: true }).click();
  await page.getByLabel('Buscar por BO, ocorrência ou responsável').fill('guia.exemplo');
  await page.locator('.desktop-bulletins .record-link').filter({ hasNotText: 'Rascunho' }).first().click();
  await page.getByRole('button', { name: 'Remover boletim' }).waitFor(); await shot(page, 'admin-acoes-bo');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByText('Provedor de e-mail').waitFor(); await shot(page, 'admin-configuracoes');
  await page.getByLabel('E-mail de destino do teste').fill('teste@example.com');
  await page.getByRole('button', { name: 'Enviar e-mail de teste' }).click();
  await page.locator('.test-email [role=status]').waitFor();
  await shot(page, 'admin-diagnostico', '.settings-card:has(.diagnostics)');
  await browser.close();

  // Mobile (iPhone 14, WebKit).
  ({ browser, ctx } = await context(webkit, devices['iPhone 14'], sessions));
  page = await ctx.newPage();
  await enter(page, GUIDE_USER.username); await shot(page, 'mobile-painel');
  await page.getByRole('button', { name: 'Menu', exact: true }).click(); await page.waitForTimeout(300); await shot(page, 'mobile-menu');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Novo boletim', exact: true }).last().click();
  await page.getByLabel(/E-mail para recebimento/).fill('recebimento@example.com'); await shot(page, 'mobile-wizard');
  await page.goto(BASE); await enter(page, GUIDE_USER.username);
  await page.getByRole('button', { name: 'Novo boletim', exact: true }).last().click();
  await fillWizard(page, async () => {});
  await page.getByRole('button', { name: 'Visualizar prévia do PDF' }).click();
  await page.getByRole('link', { name: 'Abrir PDF' }).waitFor(); await shot(page, 'mobile-previa');
  await browser.close();

  // Attachments: previews (no protocol) built from fictitious data, plus the printable quick guide.
  const token = data.user.access_token;
  writeFileSync(`${OUT}/anexos/exemplo-boletim-de-ocorrencia.pdf`, await call('/api/bo/preview-pdf', token, { method: 'POST', body: JSON.stringify(bulletin(1, 'Discussão entre vizinhos', 'PERTURBAÇÃO DO SOSSEGO (EXEMPLO)')) }));
  writeFileSync(`${OUT}/anexos/exemplo-relatorio-analitico.pdf`, await call('/api/analytical-reports/preview-pdf', token, { method: 'POST', body: JSON.stringify(report) }));
  ({ browser, ctx } = await context(chromium, { viewport: { width: 900, height: 1200 } }, sessions));
  page = await ctx.newPage();
  await page.goto(`${BASE}/guia/rapido`); await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: `${OUT}/anexos/guia-rapido.pdf`, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  await browser.close();
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${Object.keys(manifest).length} imagens; manifesto em ${MANIFEST}`);
}
await main();
