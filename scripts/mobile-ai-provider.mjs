// Deterministic provider for the isolated mobile UI tests; never use in deployment.
const original = globalThis.fetch
const impact = {asIs:'Ручное согласование',toBe:'Единый маршрут согласования',hoursPerMonth:8.67,source:'author',scope:'на одного сотрудника',assumptions:['Со слов автора: 2 часа в неделю × 52/12 недель'],qualitativeEffect:'Потенциальное сокращение ручной работы',influence:'Medium',effectType:'time',priorityScore:60,category:'catalog',topic:'Согласование заявок'}
globalThis.fetch = async (input, init) => {
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!target.startsWith('https://api.groq.com/')) return original(input, init)
  const payload = JSON.parse(init.body), prompt = payload.messages[0].content, question = payload.messages.at(-1).content
  let content
  if (prompt.includes('Classify the original employee')) content = JSON.stringify({category:'catalog',title:'Единый справочник для заявок',description:question,proposal:'Согласовать единый справочник.',hasExistingProblem:true,sentiment:5,tags:['справочник']})
  else if (prompt.includes('Return strict JSON')) content = JSON.stringify(impact)
  else if (prompt.includes('registry analyst')) content = '## Анализ текущей выборки\n\n' + JSON.parse(question).dataset.map(r => '- ' + r[0] + ': ' + r[1]).join('\n') + '\n\nПотенциальный эффект требует проверки.'
  else content = JSON.stringify({topics:[]})
  return Response.json({choices:[{finish_reason:'stop',message:{content}}]})
}
