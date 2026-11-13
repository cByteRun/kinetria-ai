// Deterministic external-service adapter for LOCAL demo recording only.
if(process.env.DEMO_RECORDING !== 'true') throw new Error('Demo adapter requires DEMO_RECORDING=true')
const original=globalThis.fetch
const report={asIs:'Повторная ручная сверка артикулов',toBe:'Единое обозначение и поисковый алиас',hoursPerMonth:8.67,source:'author',scope:'на одного сотрудника',assumptions:['Со слов автора: 2 часа в неделю × 52/12'],qualitativeEffect:'Меньше повторных сверок',influence:'Medium',effectType:'time',priorityScore:60,category:'catalog',topic:'Разные обозначения одного изделия'}
globalThis.fetch=async(input,init)=>{
 const target=typeof input==='string'?input:input instanceof URL?input.href:input.url
 if(target.startsWith('https://api.groq.com/')){
  const p=JSON.parse(init.body),system=p.messages[0].content,raw=p.messages.at(-1).content
  let output
  if(system.includes('registry analyst')){const data=JSON.parse(raw);output=`## Что повторяется\n\nВ выборке **${data.snapshotCount} обращений**.\n\n`+data.dataset.slice(0,4).map(r=>`- ${r[1]} — \`${r[0]}\``).join('\n')+'\n\n**Следующий шаг:** сверить обозначения с владельцем каталога. Оценка потерь требует подтверждения; денежный эффект неизвестен.'}
  else if(system.includes('recurring semantic')){const data=JSON.parse(raw),rows=data.requests;output=JSON.stringify({topics:rows.length>=2?[{title:'Разные обозначения одного изделия в каталоге',ids:rows.map(r=>r[0])}]:[]})}
  else if(system.includes('Return strict JSON'))output=JSON.stringify(report)
  else output=JSON.stringify({title:'Два обозначения одного изделия в каталоге',description:'В каталоге SYN-001 и SYN001 обозначают один товар. Повторная сверка отнимает время.',proposal:'Закрепить единый код и поисковый алиас',category:'catalog',hasExistingProblem:true,sentiment:3,tags:['справочник','артикулы']})
  return Response.json({choices:[{finish_reason:'stop',message:{content:output}}]})
 }
 return original(input,init)
}
