import { expect, test } from '@playwright/test';
const credentials = { email: 'e2e@example.com', password: 'Fictional-e2e-password-2026' };
test('fluxo real: login, BO 02, BO 04, emissão e download', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: '../.local/screenshots/login.png', fullPage: true });
  await page.getByLabel('E-mail', { exact: true }).fill(credentials.email);
  await page.getByLabel('Senha', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Acessar sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Painel de boletins' })).toBeVisible();
  for (const count of [2,4]) {
    await page.getByRole('button', { name: 'Novo boletim', exact: true }).last().click();
    if (count === 4) {
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: /04 envolvidos/ }).click();
    }
    const number = `E2E-${count}-${Date.now()}`;
    await page.getByLabel(/E-mail para recebimento/).fill('recipient@example.com');
    await page.getByLabel(/Nº do BO/).fill(number);
    await page.getByLabel(/Tipo de ocorrência/).fill('Teste fictício de integração');
    await page.getByLabel('Data *', { exact: true }).fill('2026-01-01');
    await page.getByLabel('Hora *', { exact: true }).fill('12:30');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByLabel(/Logradouro/).fill('Logradouro fictício');
    await page.getByLabel(/Município/).fill('Município fictício');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveCount(count);
    await expect(page.getByLabel('Vestimentas')).toHaveCount(count === 2 ? 2 : 0);
    await page.getByLabel('Nome', { exact: true }).first().fill('Pessoa fictícia');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByLabel(/Histórico da ocorrência/).fill('Narrativa sintética com acentuação para teste de ponta a ponta.');
    for (let step=0;step<4;step++) await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByText('recipient@example.com', { exact:true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar e gerar boletim' }).click();
    await expect(page.getByRole('heading', { name: 'Boletim gerado com sucesso' })).toBeVisible();
    await expect(page.getByText('Falhou', { exact: true })).toHaveCount(2, { timeout: 15000 });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar PDF' }).click();
    const file = await download;
    expect(await file.failure()).toBeNull();
    await file.saveAs(`../.local/generated/e2e-${count}.pdf`);
    await page.getByRole('button', { name: 'Painel de boletins' }).click();
    await expect(page.getByRole('button', { name: number, exact:true })).toBeVisible();
  }
  await page.screenshot({ path: '../.local/screenshots/dashboard.png', fullPage: true });
  await page.setViewportSize({ width:390, height:844 });
  await page.screenshot({ path: '../.local/screenshots/mobile.png', fullPage: true });
});
