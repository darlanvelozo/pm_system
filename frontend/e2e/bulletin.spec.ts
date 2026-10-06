import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const admin = { username: 'e2e@example.com', password: 'Fictional-e2e-password-2026' };
const stamp = Date.now();
const operator = {username: `joao.teste.${stamp}`, password: 'Fictional-e2e-password-2026'};

test('admin cria Usuário comum; três perfis; sem acesso administrativo',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await login(page);
  await page.getByRole('button',{name:'Menu',exact:true}).click();
  await page.getByRole('button',{name:'Usuários',exact:true}).click();
  const common={username:`comum.${stamp}`,password:'Fictional-common-2026'};
  const role=page.getByRole('combobox',{name:'Perfil',exact:true});
  expect(await role.locator('option').allTextContents()).toEqual(['Usuário comum','Usuário básico','Administrador']);
  await page.getByLabel('Nome completo',{exact:true}).fill('Usuário Comum Fictício');
  await page.getByLabel('Nome de usuário (login)').fill(common.username);
  await page.getByLabel(/Senha inicial/).fill(common.password);
  await page.getByRole('button',{name:'Criar usuário',exact:true}).click();
  await expect(page.getByText('Usuário criado. Ele já pode entrar com o login e a senha informados.')).toBeVisible();
  await expect(page.locator('td[data-label="Perfil"]',{hasText:'Usuário comum'}).first()).toBeVisible();
  await page.getByRole('button',{name:'Sair',exact:true}).click();
  const session=await login(page,common);
  expect(session.user.role).toBe('OPERADOR');
  await page.getByRole('button',{name:'Menu',exact:true}).click();
  await expect(page.getByRole('button',{name:'Relatórios Analíticos',exact:true})).toBeVisible();
  for(const name of ['Usuários','Auditoria','Estatísticas','Configurações'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await newBo(page,3,true);
  for(const path of ['/api/admin/users','/api/admin/settings','/api/admin/diagnostics']){
    const r=await page.request.get(`http://localhost:8000${path}`,{headers:{Authorization:`Bearer ${session.access_token}`}});expect(r.status()).toBe(403);
  }
  expect((await page.request.get('http://localhost:8000/api/bo',{headers:{Authorization:`Bearer ${session.access_token}`}})).status()).toBe(200);
});

test('Usuário básico: início restrito, sem listas nem PDFs',async({page})=>{
  await login(page);
  await page.getByRole('button',{name:'Usuários',exact:true}).click();
  const basic={username:`basico.${stamp}`,password:'Fictional-basic-2026'};
  await page.getByLabel('Nome completo',{exact:true}).fill('Usuário Básico Fictício');
  await page.getByLabel('Nome de usuário (login)').fill(basic.username);
  await page.getByLabel(/Senha inicial/).fill(basic.password);
  await page.getByRole('combobox',{name:'Perfil',exact:true}).selectOption('BASICO');
  await page.getByRole('button',{name:'Criar usuário',exact:true}).click();
  await expect(page.locator('td[data-label="Perfil"]',{hasText:'Usuário básico'}).first()).toBeVisible();
  await page.getByRole('button',{name:'Sair',exact:true}).click();
  const session=await login(page,basic,'Registrar documentos');
  expect(session.user.role).toBe('BASICO');
  await expect(page.getByRole('heading',{name:'Meus rascunhos'})).toBeVisible();
  for(const name of ['Painel de boletins','Relatórios Analíticos','Usuários','Configurações'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
  for(const path of ['/api/bo','/api/analytical-reports','/api/operational-options','/api/admin/users']){
    const r=await page.request.get(`http://localhost:8000${path}`,{headers:{Authorization:`Bearer ${session.access_token}`}});expect(r.status()).toBe(403);
  }
});

test('relatório analítico: prévia, emissão, revisão, PDF, reenvio, cancelamento e remoção',async({page})=>{
  await login(page);
  await page.getByRole('button',{name:'Novo Relatório Analítico',exact:true}).first().click();
  await page.getByLabel('E-mail para recebimento').fill('fictional@example.com');
  await page.getByLabel('Código/Tipo de Ocorrência').fill('TESTE ANALÍTICO FICTÍCIO');
  await forward(page);
  await page.getByLabel(/^Local \*/).fill('Local inteiramente fictício');
  await page.getByLabel('Data da ocorrência').fill('2026-09-30');
  await page.getByLabel('Hora da ocorrência').fill('12:30');
  await forward(page);
  await page.getByLabel('Vítima(s)').fill('Pessoa fictícia para teste');
  await forward(page);
  for(const label of ['EVADIU-SE','SAMU','ICRIM'])await page.getByLabel(label,{exact:false}).selectOption('NÃO');
  await forward(page,2);
  await page.getByLabel('RELATO DA OCORRÊNCIA').fill('Relato fictício para teste integrado');
  await forward(page);
  await page.getByLabel('PROVIDÊNCIAS ADOTADAS').fill('Providências fictícias para teste integrado');
  await page.getByLabel('Local de emissão (município)').fill('Cidade Fictícia');
  await page.getByLabel('Data de emissão').fill('2026-09-30');
  await forward(page);
  const preview=page.waitForResponse(r=>r.url().endsWith('/analytical-reports/preview-pdf'));
  await page.getByRole('button',{name:'Visualizar prévia do relatório'}).click();expect((await preview).status()).toBe(200);
  await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Fechar'}).click();
  const emitted=page.waitForResponse(r=>r.url().includes('/analytical-reports/')&&r.url().endsWith('/emit'));
  await page.getByRole('button',{name:'Emitir Relatório Analítico',exact:true}).evaluate(b=>{(b as HTMLButtonElement).click();(b as HTMLButtonElement).click();});
  const response=await emitted;expect(response.status()).toBe(200);const report=await response.json();expect(report.report_number).toMatch(/^\d+\/\d{4}$/);
  await expect(page.getByRole('status').filter({hasText:'Emitido · Versão 1'})).toBeVisible();
  await expect(page.getByText('Falhou',{exact:true})).toHaveCount(2);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar PDF do relatório'}).click();await(await download).saveAs('../.local/generated/analytical-e2e-v1.pdf');
  await page.getByRole('button',{name:'Corrigir relatório emitido'}).click();
  await forward(page,5);await page.getByLabel('RELATO DA OCORRÊNCIA').fill('Relato fictício corrigido, versão dois');await forward(page,2);
  await page.getByRole('button',{name:'Confirmar revisão do relatório',exact:true}).click();await page.getByLabel('Motivo da revisão').fill('Correção fictícia de teste');await page.getByRole('button',{name:'Confirmar correção',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Emitido · Versão 2'})).toBeVisible();
  await page.getByRole('button',{name:'Histórico de versões do relatório'}).click();await expect(page.getByRole('heading',{name:'Versão 1',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Versão 2',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reenviar relatório',exact:true}).click();await page.getByLabel('Destino').selectOption('recipient');await page.getByRole('button',{name:'Confirmar ação'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Cancelar relatório',exact:true}).click();await page.getByLabel('Motivo',{exact:true}).fill('Cancelamento fictício');await page.getByRole('button',{name:'Confirmar ação'}).click();await expect(page.getByRole('status').filter({hasText:'Cancelado · Versão 2'})).toBeVisible();
  await page.getByRole('button',{name:'Remover relatório',exact:true}).click();await page.getByLabel('Motivo',{exact:true}).fill('Remoção fictícia');await page.getByRole('button',{name:'Confirmar ação'}).click();await expect(page.getByRole('status').filter({hasText:'Removido · Versão 2'})).toBeVisible();
  await page.getByRole('button',{name:'Voltar aos relatórios'}).click();
  for(const width of [320,360,375,390,412,768,1280]){await page.setViewportSize({width,height:844});const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,className:e.className,right:e.getBoundingClientRect().right}))}));expect(layout.scroll,JSON.stringify(layout)).toBeLessThanOrEqual(width+1);}
});
test.setTimeout(180000);
async function login(page: Page, account = admin, heading = 'Painel de boletins') {
  await page.goto('/');
  await page.getByLabel('Usuário', {exact: true}).fill(account.username);
  await page.getByLabel('Senha', {exact: true}).fill(account.password);
  const submit = async () => {
    const response = page.waitForResponse(r=>r.url().endsWith('/api/auth/login') && r.request().method()==='POST');
    await page.getByRole('button', {name:'Acessar sistema'}).click();
    return response;
  };
  let response = await submit();
  if (response.status() === 429) {
    // Respect the production limiter when this suite logs in repeatedly.
    const seconds = Number(response.headers()['retry-after'] || 60);
    await new Promise(resolve => setTimeout(resolve, (seconds + 1) * 1000));
    response = await submit();
  }
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', {name:heading})).toBeVisible();
  return response.json();
}
async function forward(page: Page, count = 1) {
  for (let i=0;i<count;i++) await page.getByRole('button', {name:'Continuar', exact:true}).click();
}
async function newBo(page: Page, count: number, doubleClick = false) {
  await page.getByRole('button', {name:'Novo boletim', exact:true}).last().click();
  await page.getByLabel(/E-mail para recebimento/).fill('recipient@example.com');
  await page.getByLabel(/Tipo de ocorrência/).fill('Teste fictício de integração');
  await page.getByLabel('Data *', {exact:true}).fill('2026-01-01');
  await page.getByLabel('Hora *', {exact:true}).fill('12:30');
  await forward(page);
  await page.getByLabel(/Logradouro/).fill('Rua fictícia');
  await page.getByLabel(/Município/).fill('Cidade fictícia');
  await forward(page);
  for (let i=0;i<count;i++) {
    if(i) await page.getByRole('button', {name:/Adicionar envolvido/}).click();
    await page.getByLabel('Nome', {exact:true}).fill(`Pessoa Ficticia ${i}`);
  }
  await forward(page);
  await page.getByLabel(/Histórico da ocorrência/).fill('Narrativa fictícia para teste completo.');
  await forward(page,4);
  if(doubleClick) {
    const response = page.waitForResponse(r=>r.url().endsWith('/preview-pdf'));
    await page.getByRole('button',{name:'Visualizar prévia do PDF'}).click();
    expect((await response).status()).toBe(200);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button',{name:'Fechar'}).click();
  }
  const emitted = page.waitForResponse(r => r.url().endsWith('/api/bo') && r.request().method() === 'POST');
  if(doubleClick) await page.getByRole('button', {name:'Confirmar e gerar boletim'}).evaluate(button => {(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
  else await page.getByRole('button', {name:'Confirmar e gerar boletim'}).click();
  await expect(page.getByRole('heading', {name:'Boletim gerado com sucesso'})).toBeVisible();
  await expect(page.getByText('Falhou', {exact:true})).toHaveCount(2);
  const result = await (await emitted).json();
  expect(result.bo_number).toMatch(/^\d{8}-\d{2,}$/);
  return result.bo_number as string;
}
test('admin cria operador; operador emite; admin revisa, cancela, remove e consulta auditoria', async ({page}) => {
  await login(page);
  await page.getByRole('button', {name:'Usuários', exact:true}).click();
  await page.getByLabel('Nome completo', {exact:true}).fill('João Teste Operador');
  await page.getByLabel('Nome de usuário (login)').fill(operator.username);
  await page.getByLabel(/Senha inicial/).fill(operator.password);
  await page.getByRole('button', {name:'Criar usuário', exact:true}).click();
  await expect(page.getByText('Usuário criado. Ele já pode entrar com o login e a senha informados.')).toBeVisible();
  await page.getByRole('button',{name:'Sair',exact:true}).click();
  await login(page,operator);
  const number = await newBo(page,2);
  await expect(page.getByText(/Registrado por: João Teste Operador/)).toBeVisible();
  await login(page);
  await page.getByRole('button', {name:number,exact:true}).click();
  await page.getByRole('button', {name:'Editar boletim',exact:true}).click();
  await forward(page,2);
  for(let i=2;i<7;i++) {
    await page.getByRole('button', {name:/Adicionar envolvido/}).click();
    await page.getByLabel('Nome', {exact:true}).fill(`Pessoa Ficticia ${i}`);
  }
  await forward(page,5);
  await page.getByRole('button', {name:'Confirmar e regenerar PDF'}).click();
  await page.getByLabel('Motivo da alteração').fill('Inclusão fictícia de cinco envolvidos');
  await page.getByRole('button', {name:'Confirmar correção',exact:true}).click();
  await expect(page.getByText('Versão do PDF: 2')).toBeVisible();
  await expect(page.getByText('Não enviado', {exact:true})).toHaveCount(2);
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'Baixar PDF',exact:true}).click();
  await (await download).saveAs('../.local/generated/e2e-dynamic-7.pdf');
  await page.getByRole('button',{name:'Histórico de versões'}).click();
  await expect(page.getByRole('heading',{name:'Versão 1 · 2 envolvidos'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Versão 2 · 7 envolvidos'})).toBeVisible();
  await page.getByRole('button',{name:'Editar boletim',exact:true}).click();
  await forward(page,2);
  await page.getByRole('button',{name:'Remover envolvido C',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar remoção'}).click();
  await page.getByRole('button',{name:'Editar envolvido C',exact:true}).click();
  await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('Pessoa Ficticia 3');
  await forward(page,5);
  await page.getByRole('button',{name:'Confirmar e regenerar PDF'}).click();
  await page.getByLabel('Motivo da alteração').fill('Remoção fictícia de envolvido C');
  await page.getByRole('button',{name:'Confirmar correção',exact:true}).click();
  await expect(page.getByText('Versão do PDF: 3')).toBeVisible();
  await page.getByRole('button',{name:'Cancelar boletim',exact:true}).click();
  await page.getByLabel('Motivo',{exact:true}).fill('Cancelamento fictício');
  await page.getByRole('button',{name:'Confirmar cancelamento'}).click();
  await expect(page.getByRole('heading',{name:'Boletim cancelado',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Remover boletim',exact:true}).click();
  await page.getByLabel('Motivo',{exact:true}).fill('Remoção lógica fictícia');
  await page.getByRole('button',{name:'Confirmar remoção'}).click();
  await expect(page.getByRole('heading',{name:'Boletim removido',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Painel de boletins',exact:true}).click();
  await page.getByLabel('Filtrar status').selectOption('REMOVED');
  await expect(page.getByRole('button',{name:number,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Auditoria',exact:true}).click();
  await expect(page.getByText('BO corrigido (ADMIN)').first()).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Nome completo'})).toBeVisible();
  await page.screenshot({path:'../.local/screenshots/audit-dynamic.png',fullPage:true});
});

test('mobile em seis larguras, manifest, service worker e cache seguro', async ({page,context}) => {
  await login(page);
  for(const width of [320,360,375,390,412,768]) {
    await page.setViewportSize({width,height:844});
    await expect(page.getByRole('navigation',{name:'Navegação rápida'})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    expect(overflow, `overflow at ${width}`).toBe(false);
    await page.screenshot({path:`../.local/screenshots/mobile-${width}.png`,fullPage:true});
  }
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i:{sizes:string})=>i.sizes)).toContain('192x192');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  const keys = await page.evaluate(async()=> {
    const result:string[]=[];
    for(const key of await caches.keys()) for(const r of await (await caches.open(key)).keys()) result.push(r.url);
    return result;
  });
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.every(url => !url.includes(':8000') && !url.includes('/api/') && !url.endsWith('.pdf'))).toBe(true);
  await context.setOffline(true);
  await page.goto('/sobre');
  await expect(page.getByRole('heading',{name:'Sem conexão com a internet.'})).toBeVisible();
  await context.setOffline(false);
});

test('instalação respeita recusa; atualização só recarrega após confirmação', async ({page}) => {
  await login(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt', {cancelable:true})));
  await expect(page.getByRole('button',{name:'Instalar BO Online'})).toBeVisible();
  await page.getByRole('button',{name:'Agora não'}).click();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt', {cancelable:true})));
  await expect(page.getByRole('button',{name:'Instalar BO Online'})).toHaveCount(0);
  await page.getByRole('button',{name:'Novo boletim',exact:true}).last().click();
  await page.getByLabel('Descrição breve da ocorrência').fill('DRAFT-BEFORE-UPDATE');
  const path = 'public/sw.js';
  const original = await readFile(path,'utf8');
  try {
    await writeFile(path, original + `\n// Local E2E update ${Date.now()}\n`);
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
    await expect(page.getByRole('button',{name:'Atualizar',exact:true})).toBeVisible({timeout:30000});
    await expect(page.getByLabel('Descrição breve da ocorrência')).toHaveValue('DRAFT-BEFORE-UPDATE');
    await page.getByRole('button',{name:'Atualizar',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button',{name:'Salvei meu trabalho, atualizar'}).click();
    await expect(page.getByRole('button',{name:'Acessar sistema'})).toBeVisible();
    await login(page);
    await page.getByRole('button',{name:'Novo boletim',exact:true}).last().click();
    await expect(page.getByLabel('Descrição breve da ocorrência')).toHaveValue('DRAFT-BEFORE-UPDATE');
  } finally {
    await writeFile(path, original);
  }
});

test('modo standalone não oferece instalação novamente', async ({page}) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => {
      const result = original(query);
      if(query === '(display-mode: standalone)') Object.defineProperty(result,'matches',{value:true});
      return result;
    };
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Acessar sistema'})).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt', {cancelable:true})));
  await expect(page.getByRole('button',{name:'Instalar BO Online'})).toHaveCount(0);
});

test('mobile registra trinta envolvidos e recupera todos do servidor', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await login(page);
  const number = await newBo(page,30);
  await expect(page.getByText('Pessoa Ficticia 29',{exact:true})).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'Baixar PDF',exact:true}).click();
  await (await download).saveAs('../.local/generated/e2e-dynamic-30.pdf');
  await login(page);
  await page.getByRole('button',{name:`Abrir boletim ${number}`,exact:true}).click();
  for(let i=0;i<30;i++) await expect(page.getByText(`Pessoa Ficticia ${i}`,{exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test('prévia, clique duplo e verificação após login', async ({page}) => {
  await login(page);
  let attempts = 0;
  page.on('request',r=>{if(r.method()==='POST' && r.url().endsWith('/api/bo') && r.postDataJSON()?.emit) attempts++;});
  const number = await newBo(page,3,true);
  expect(attempts).toBe(1);
  const verification = await page.getByRole('link',{name:'Verificar documento'}).getAttribute('href');
  await page.goto(verification!);
  await expect(page.getByRole('button',{name:'Acessar sistema'})).toBeVisible();
  await page.getByLabel('Usuário',{exact:true}).fill(admin.username);
  await page.getByLabel('Senha',{exact:true}).fill(admin.password);
  await page.getByRole('button',{name:'Acessar sistema'}).click();
  await expect(page.getByRole('heading',{name:'Verificação documental'})).toBeVisible();
  await expect(page.getByText(`Nº do BO: ${number}`,{exact:true})).toBeVisible();
  await expect(page.getByText('Documento corresponde ao registro armazenado.',{exact:true})).toBeVisible();
  await expect(page.getByText('Pessoa Ficticia 0',{exact:true})).toHaveCount(0);
});

for(const width of [390,1280]) test(`scroll dos envolvidos mantém cabeçalho visível em ${width}px`, async ({page})=>{
  await page.setViewportSize({width,height:844});
  await login(page);
  await page.getByRole('button',{name:'Novo boletim',exact:true}).last().click();
  await page.getByLabel(/E-mail para recebimento/).fill('recipient@example.com');
  await page.getByLabel(/Tipo de ocorrência/).fill('Teste de scroll');
  await page.getByLabel('Data *',{exact:true}).fill('2026-01-01');
  await page.getByLabel('Hora *',{exact:true}).fill('12:00');
  await forward(page);
  await page.getByLabel(/Logradouro/).fill('Rua fictícia');
  await page.getByLabel(/Município/).fill('Cidade fictícia');
  await forward(page);
  for(const letter of ['A','B','C']) {
    if(letter!=='A') await page.getByRole('button',{name:'+ Adicionar envolvido',exact:true}).click();
    const header = page.getByRole('heading',{name:`Envolvido ${letter}`,exact:true});
    await expect.poll(async()=>{const box=await header.boundingBox();return !!box && box.y>=50 && box.y<250;}).toBe(true);
    await page.getByLabel('Nome',{exact:true}).fill(`Pessoa ${letter}`);
    await page.getByLabel('Observação',{exact:true}).fill('Campo no final do formulário');
  }
  await page.getByRole('button',{name:'Editar envolvido A',exact:true}).click();
  await expect.poll(async()=>{const box=await page.getByRole('heading',{name:'Envolvido A',exact:true}).boundingBox();return !!box && box.y>=50 && box.y<250;}).toBe(true);
  await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('Pessoa A');
});

test('rascunho entre dispositivos preserva conflito e permite recarregar', async ({page})=>{
  const session = await login(page);
  await page.getByRole('button',{name:'Novo boletim',exact:true}).last().click();
  await page.getByLabel('Descrição breve da ocorrência',{exact:false}).fill('Rascunho entre dispositivos');
  const saved = page.waitForResponse(r=>r.url().endsWith('/api/bo') && r.request().method()==='POST');
  await page.getByRole('button',{name:'Salvar no servidor',exact:true}).click();
  const draft = await (await saved).json();
  expect(draft.bo_number).toBeNull();
  const fromOtherDevice = await page.request.put(`http://localhost:8000/api/bo/${draft.id}`,{headers:{Authorization:`Bearer ${session.access_token}`},data:{data:{...draft.data,occurrence_summary:'Alterado em outro dispositivo'},version:draft.version,emit:false}});
  expect(fromOtherDevice.status()).toBe(200);
  await page.getByLabel('Descrição breve da ocorrência',{exact:false}).fill('Alteração local concorrente');
  await page.getByRole('button',{name:'Salvar no servidor',exact:true}).click();
  await expect(page.getByText(/Este rascunho foi alterado em outro dispositivo/)).toBeVisible();
  await page.getByRole('button',{name:'Recarregar versão do servidor'}).click();
  await expect(page.getByLabel('Descrição breve da ocorrência',{exact:false})).toHaveValue('Alterado em outro dispositivo');
});
