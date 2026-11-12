import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
const output = 'docs/evidence/p0'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
const errors = [], ids = [], report = { base, startedAt: new Date().toISOString(), checks: [], ids, errors }
const tag = 'p0-' + Date.now()
async function check(name, fn) { await fn(); report.checks.push(name); console.log('PASS', name) }
async function login(account, role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(base + '/login')
  await page.locator(`button[name="account"][value="${account}"]`).click()
  await page.waitForURL('**/workspace/' + role)
  return page
}
async function save(page, name) {
  const previous = await page.locator('input[name="version"]').first().inputValue()
  await page.getByRole('button',{name,exact:true}).click()
  await page.waitForFunction(v => {
    const input=document.querySelector('input[name="version"]')
    return input && Number(input.value)>Number(v)
  }, previous)
  assert(!new URL(page.url()).searchParams.get('error'), 'Action returned an error')
}
async function submit(page, index) {
  await page.goto(base + '/workspace/employee?view=new')
  await page.getByRole('button', {name:'С помощью AI',exact:true}).click()
  await page.getByLabel('Сообщение помощнику').waitFor()
  await page.getByRole('button', {name:'Заполнить вручную',exact:true}).click()
  await page.locator('[name="category"]').selectOption('catalog')
  await page.locator('[name="kind"][value="problem"]').check()
  await page.locator('[name="title"]').fill(`Демо P0 ${tag} · дубли артикулов ${index}`)
  await page.locator('textarea[name="description"]').fill(`Синтетическая проблема ${index}: один артикул записан по-разному в каталоге. Сотрудники повторно сверяют его вручную. Проверка ${tag}.`)
  await page.locator('[name="proposal"]').fill('Проверить дубли и согласовать единый справочник.')
  await page.locator('[name=tags]').waitFor({state:'visible'})
  await page.locator('[name="tags"]').fill(tag + ', справочник')
  if (index === 1) await page.locator('[name="attachments"]').setInputFiles({ name: 'p0.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic P0 evidence') })
  await page.getByRole('button', {name:'Зарегистрировать',exact:true}).click()
  await page.waitForURL(url => Boolean(url.searchParams.get('id')))
  const id = new URL(page.url()).searchParams.get('id'); ids.push(id)
  await page.getByRole('heading',{name:/дубли артикулов/}).waitFor()
  return id
}
try {
  const employee = await login('employee','employee')
  const manager = await login('manager-it','manager')
  const admin = await login('admin','admin')
  await check('Three independent authenticated browser sessions',async()=>{})
  await check('Employee registers three similar problems; first includes attachment',async()=>{
    for (let i=1;i<=3;i++) await submit(employee,i)
  })
  const id=ids[0], detail=base+'/workspace/manager?id='+id
  await manager.goto(detail)
  await check('Automatic routing exposes request to the relevant manager',async()=>{
    assert((await manager.locator('main').innerText()).includes('Мария Ким'))
  })
  await check('Manager assigns an owner and a deadline',async()=>{
    const select=manager.locator('select[name="assignee"]')
    const options=await select.locator('option').evaluateAll(o=>o.map(x=>({text:x.textContent,value:x.value})))
    const owner=options.find(o=>o.text.includes('Максим Ли')); assert(owner)
    await select.selectOption(owner.value)
    await save(manager, 'Сохранить назначение')
    await manager.waitForURL(url=>!url.searchParams.get('error'))
    await manager.locator('dd').filter({hasText:'Максим Ли'}).waitFor()
    await manager.locator('[name="due"]').fill('2026-11-20')
    await manager.locator('[name="priority"]').selectOption('high')
    await save(manager, 'Сохранить параметры')
    await manager.getByText('20 нояб.',{exact:true}).first().waitFor()
  })
  await check('Manager comment is persisted in history',async()=>{
    await manager.locator('form.comment-box textarea').fill('Проверяем повторяемость на тестовом справочнике.')
    await save(manager, 'Добавить комментарий')
    assert((await manager.locator('.request-history').innerText()).includes('Проверяем повторяемость'))
  })
  await check('Review → clarification → employee reply → work → decision',async()=>{
    await save(manager, 'Взять на рассмотрение')
    await manager.locator('[name="status"]').waitFor()
    await manager.locator('[name="status"]').selectOption('clarification')
    await manager.locator('textarea[name="message"]').first().fill('Уточните пример дубля артикулов.')
    await save(manager, 'Запросить уточнение')
    await manager.getByRole('heading',{name:'Запрос уточнения'}).waitFor()
    await employee.goto(base+'/workspace/employee?id='+id)
    const reply=employee.locator('form').filter({has:employee.locator('input[value="replied"]')})
    await reply.locator('textarea').fill('Пример: SYN-001 и SYN001 — один синтетический артикул.')
    await reply.locator('button').click()
    await employee.getByText('Ожидает ответа автора',{exact:true}).waitFor({state:'hidden'})
    await manager.goto(detail)
    await manager.locator('[name="status"]').selectOption('in_progress')
    await manager.locator('[name="nextStep"]').fill('Проверить SYN-001 и утвердить правило записи.')
    await save(manager, 'Сохранить следующий шаг')
    await manager.locator('[name="status"]').selectOption('implemented')
    await manager.locator('textarea[name="message"]').first().fill('На тестовых данных дубли SYN-001 и SYN001 сведены к единому артикулу; правило записи проверено.')
    await save(manager, 'Опубликовать решение')
    await manager.getByRole('heading',{name:'Решение для автора',exact:true}).waitFor()
  })
  await check('Employee receives in-app result, downloads attachment and acknowledges',async()=>{
    await employee.goto(base+'/workspace/employee?view=notifications')
    const notice=employee.locator('.notification').filter({hasText:`${tag} · дубли артикулов 1`})
    assert((await notice.innerText()).includes('Результат доступен'))
    await employee.screenshot({path:output+'/notifications.png',fullPage:true})
    await notice.getByRole('link').first().click()
    await employee.getByRole('heading',{name:'Решение для автора',exact:true}).waitFor()
    const response=await employee.request.get(new URL(await employee.locator('a.attachment').getAttribute('href'), base).href)
    assert.equal(response.status(),200); assert.equal((await response.body()).toString(),'Synthetic P0 evidence')
    await save(employee, 'Ознакомился с результатом')
    await employee.getByText(/Вы ознакомились с результатом/).waitFor()
    const history=await employee.locator('.request-history').innerText()
    for (const text of ['Уточните пример','SYN-001','Автор ознакомился']) assert(history.includes(text))
    await employee.screenshot({path:output+'/closed-loop.png',fullPage:true})
  })
  await check('Operational Insights groups three problems and shows one decision',async()=>{
    await manager.goto(base+'/workspace/manager?view=insights')
    await manager.getByLabel('Период аналитики').selectOption('7')
    const group=manager.getByRole('region',{name:'Повторяющиеся проблемы'}).locator('.result-item').filter({hasText:tag})
    assert((await group.innerText()).includes('3 обращений · с решением: 1'))
    await manager.screenshot({path:output+'/insights.png',fullPage:true})
    await group.getByRole('link').first().click()
    await manager.waitForURL(url=>url.searchParams.get('period')==='7' && url.searchParams.get('tag')===tag)
    assert.equal(new URL(manager.url()).searchParams.get('period'),'7')
    await manager.getByText(/Найдено 3 из/).waitFor()
    await manager.getByLabel('Поиск обращений',{exact:true}).fill('дубли артикулов 1')
    await manager.getByText(/Найдено 1 из/).waitFor()
    await manager.getByLabel('Поиск обращений',{exact:true}).fill('нет-совпадения')
    await manager.getByText('Обращений пока нет',{exact:true}).waitFor()
    await manager.getByRole('button',{name:'Сбросить',exact:true}).click()
    await manager.getByText(/Найдено 3 из/).waitFor()
    await manager.getByLabel('Фильтр по статусу').selectOption('done')
    await manager.getByText(/Найдено 1 из/).waitFor()
    await manager.screenshot({path:output+'/filtered-results.png',fullPage:true})
  })
  await check('Admin sees the same case, category settings and routes',async()=>{
    await admin.goto(base+'/workspace/admin?id='+id)
    await admin.getByRole('heading',{name:'Решение для автора',exact:true}).waitFor()
    assert.equal(await admin.getByRole('button',{name:'Опубликовать решение'}).count(),0)
    await admin.goto(base+'/workspace/admin?view=categories')
    await admin.getByRole('heading',{name:'Новая категория',exact:true}).waitFor()
    await admin.goto(base+'/workspace/admin?view=routing')
    await admin.getByRole('heading',{name:'Правила передачи обращений',exact:true}).waitFor()
    await admin.screenshot({path:output+'/admin-routing.png',fullPage:true})
  })
  await check('Employee cannot enter manager workspace',async()=>{
    const response=await employee.goto(base+'/workspace/manager')
    assert.equal(response.status(),404)
  })
  await check('Mobile creation and analytics have no horizontal page overflow',async()=>{
    for(const [page,path] of [[employee,'/workspace/employee?view=new'],[manager,'/workspace/manager?view=insights']]) {
      await page.setViewportSize({width:390,height:844}); await page.goto(base+path)
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
      await page.screenshot({path:output+(page===employee?'/mobile-create.png':'/mobile-insights.png'),fullPage:true})
    }
  })
  assert.deepEqual(errors,[])
  report.status='passed'
} catch(error) { for (const [i,c] of browser.contexts().entries()) { for (const p of c.pages()) { await p.screenshot({path:output+'/failure-'+i+'.png',fullPage:true}).catch(()=>{}); console.log('FAILED PAGE',p.url(),(await p.locator('main').innerText().catch(()=>'' )).slice(-3500)) } } report.status='failed'; report.failure=error.stack; throw error }
finally {
  // Mark only this run's synthetic cases; never touch pre-existing business records.
  if(ids.length && process.env.SUPABASE_SECRET_KEY) {
    const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}})
    const {error}=await db.from('requests').update({is_demo:true}).in('id',ids)
    if(error) console.error('Demo marker:',error.message)
  }
  report.finishedAt=new Date().toISOString()
  await writeFile(output+'/browser-report.json',JSON.stringify(report,null,2)+'\n')
  await browser.close()
}
