import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const base=process.env.P0_BASE_URL||'http://localhost:3012'
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local synthetic DB only')
const out='docs/evidence/mobile-first/admin',checks=[],errors=[];await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
async function login(account,role){const p=await browser.newPage({viewport:{width:360,height:800}});p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/login');await p.locator(`[data-account="${account}"]`).click();await p.waitForURL('**/workspace/'+role+'**');return p}
const pass=s=>{checks.push(s);console.log('PASS',s)}
let admin,categoryId,requestId
try{
 admin=await login('admin','admin');await admin.goto(base+'/workspace/admin?view=categories')
 const name='Мобильный E2E '+Date.now(),form=admin.locator('form.ir-category-form').filter({has:admin.locator('input[name=category][value=""]')})
 for(const locale of ['ru','en','kk'])await form.locator(`[name=name_${locale}]`).fill(name)
 await form.locator('[name=department]').fill('Синтетическая мобильная проверка');await form.locator('[name=days]').fill('3');await form.locator('button').click()
 const row=admin.locator('.settings-table tr').filter({has:admin.getByText(name,{exact:true}).first()});await row.waitFor();categoryId=await row.locator('input[name=category]').inputValue();pass('360px: admin creates localized category through actual form')
 await row.locator('[name=days]').fill('4');await row.locator('button').click();await admin.waitForURL('**view=categories');assert(!new URL(admin.url()).searchParams.has('error'));pass('admin edits category SLA on mobile')
 const employee=await login('employee','employee');await employee.goto(base+'/workspace/employee?view=new');await employee.locator('[name=category]').selectOption(categoryId);await employee.locator('input[name=title]').fill(name+' · без маршрута');await employee.locator('textarea[name=description]').fill('Синтетическая проверка резервной очереди с мобильного экрана.');await employee.getByRole('button',{name:'Зарегистрировать',exact:true}).click();await employee.waitForURL(u=>u.searchParams.has('id'));requestId=new URL(employee.url()).searchParams.get('id');pass('employee submits to new category without route')
 await admin.goto(base+'/workspace/admin?view=routing');await admin.locator('.case-title').filter({hasText:name}).click();await admin.locator('.crm-request-drawer[open]').waitFor()
 const select=admin.locator('.crm-detail-actions select[name=assignee]');const manager=await select.locator('option').evaluateAll(os=>os.find(o=>o.textContent.includes('Максим Ли'))?.value);assert(manager);await select.selectOption(manager)
 const before=await admin.locator('input[name=version]').first().inputValue();await admin.getByRole('button',{name:'Назначить из резерва',exact:true}).click();await admin.waitForFunction(v=>Number(document.querySelector('input[name=version]')?.value)>Number(v),before);await admin.locator('dd').filter({hasText:'Максим Ли'}).waitFor();pass('admin opens reserve case and assigns manager from full-screen drawer')
 for(const width of [360,390,430]){await admin.setViewportSize({width,height:844});assert(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await admin.screenshot({path:`${out}/assigned-${width}.png`})}
 await admin.goto(base+'/workspace/admin?view=routing');const route=admin.locator('form').filter({has:admin.locator(`input[name=category][value="${categoryId}"]`)});await route.locator('select').selectOption(manager);await route.locator('button').click();await admin.waitForURL('**view=routing');await route.locator('span').filter({hasText:'Максим Ли'}).waitFor();await route.locator('select').selectOption('disabled');await route.locator('button').click();await route.locator('span').filter({hasText:'Резервная очередь'}).waitFor();pass('mobile routing rule can be enabled and disabled')
 assert.deepEqual(errors,[])
}finally{
 if(admin&&categoryId){await admin.goto(base+'/workspace/admin?view=categories');const fixture=admin.locator('form.ir-category-form').filter({has:admin.locator(`input[name=category][value="${categoryId}"]`)});await fixture.locator('[name=active]').uncheck();await fixture.locator('button').click()}
 await writeFile(out+'/report.json',JSON.stringify({checks,errors,categoryId,requestId,fixture:'synthetic category archived after run'},null,2));await browser.close()
}
