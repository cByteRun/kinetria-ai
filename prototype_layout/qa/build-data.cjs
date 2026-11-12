const fs=require('node:fs');
const path=require('node:path');
const paragraphs=JSON.parse(fs.readFileSync(path.join(__dirname,'dataset-source.json'),'utf8').replace(/^\uFEFF/,''));
const titles=['Полные данные в заявках на оборудование','Статус проекта для отдела закупок','Единые обозначения в каталоге','Короткие занятия по новым товарным линейкам','Прозрачный статус пакета документов','Памятка для межотдельных операций','Повторный ввод данных в рабочих системах','Памятка для передачи сложных задач','Кто согласовывает приложение к договору','Подтверждение результата перед закрытием задачи','Срок ответа смежных подразделений','Единое место для итоговых решений','История изменений спецификации','Обзор загрузки проектной группы','Цель и срок в каждом поручении','Практические занятия для новых сотрудников','Зона для коротких перерывов','Сохранить формат внутренних учебных встреч','Как найти актуальную редакцию инструкции','Обзор завершённых внутренних улучшений'];
const statusMap={'Новое':'new','На рассмотрении':'review','В работе':'progress','Реализовано':'implemented','Ожидает уточнения':'waiting','Отклонено':'rejected','Закрыто':'closed'};
const dueDays=[14,12,10,9,11,16,12,9,11,13,12,13,13,16,10,16,8,8,14,13];
const records=[];
for(let i=0;i<paragraphs.length;i++){
 const match=paragraphs[i].match(/^(A-\d{3}) · (.+?) · (.+)$/);if(!match)continue;
 const meta=paragraphs[i+1].match(/Автор: (.+?)\s+Приоритет: (.+?)\s+Статус: (.+)$/);
 const owner=paragraphs[i+3].match(/Условный ответственный: (.+?)\s+Пример дальнейшего действия: (.+)$/);
 const n=records.length, status=statusMap[meta[3]],completed=['implemented','rejected','closed'].includes(status);
 const created=`2026-11-${String(n%7+1).padStart(2,'0')}T09:00:00+05:00`;
 const direction=[2,6,11,18].includes(n)?'IT и данные':'Операционные процессы';
 const department=meta[1].includes('закупок')?'Закупки':meta[1].includes('бухгалтерии')?'Бухгалтерия':meta[1].includes('продажам')?'Продажи':meta[1].includes('офиса')?'Офис':'Проектирование';
 const decision=status==='implemented'?owner[2].replace('Пример результата: ',''):status==='rejected'?owner[2].replace('Пример мотивированного ответа: ',''):status==='closed'?'Спасибо за обратную связь. Польза учебных встреч зафиксирована; отзыв передан организаторам. Формат сохраняем.':'';
 const row={id:match[1],type:match[2],category:match[3],title:titles[n],author:meta[1],department,priority:meta[2],description:paragraphs[i+2].replace('Текст обращения. ',''),proposed:'',owner:n===19?'':owner[1],direction,status,created,due:`2026-11-${String(dueDays[n]).padStart(2,'0')}`,firstResponse:status==='new'?null:new Date(new Date(created).getTime()+(n%5+2)*3600000).toISOString(),closedAt:completed?'2026-11-08T11:00:00+05:00':null,decision,actions:status==='implemented'?owner[2].replace('Пример результата: ',''):'',nextAction:owner[2],readByAuthor:n===7||n===17,attachments:[],related:n===0?['A-015']:n===14?['A-001']:[],history:[]};
 row.history.push({at:created,actor:'Система',text:`Обращение зарегистрировано. Категория: ${row.category}.`,kind:'created'});
 row.history.push({at:created,actor:'Система',text:row.owner?`Направлено: ${row.direction}. Ответственный: ${row.owner}.`:'Правило не найдено. Обращение сохранено в резервной очереди администратора.',kind:'route'});
 if(status!=='new')row.history.push({at:row.firstResponse,actor:row.owner,text:status==='waiting'?owner[2]:`Обращение принято к рассмотрению. ${completed?'Решение опубликовано в личном кабинете автора.':owner[2]}`,kind:status==='waiting'?'question':'status'});
 if(completed)row.history.push({at:row.closedAt,actor:row.owner,text:decision,kind:'decision'});
 records.push(row);
}
const rules=records.reduce((all,row)=>{if(all.some(x=>x.category===row.category))return all;all.push({id:'rule-'+(all.length+1),category:row.category,direction:row.direction,owner:row.id==='A-020'?'':row.owner,days:3,active:row.id!=='A-020'});return all;},[]);
rules.push({id:'rule-other',category:'Другое',direction:'Операционные процессы',owner:'',days:3,active:false});
const state={version:1,records,rules,notifications:[{id:'n1',caseId:'A-001',role:'manager',title:'Новое обращение в вашем направлении',text:'Полные данные в заявках на оборудование. Назначен руководитель закупок.',read:false},{id:'n2',caseId:'A-004',role:'employee',title:'По вашему предложению есть результат',text:'Пробный обучающий семинар запланирован. Решение доступно в карточке.',read:false},{id:'n3',caseId:'A-020',role:'admin',title:'Требуется ручная маршрутизация',text:'Обращение A-020 в резервной очереди: правило не настроено.',read:false}],audit:[]};
fs.writeFileSync(path.join(__dirname,'..','data.js'),'// Synthetic examples adapted from docs/TZ/Датасет.docx. Dates and workflow events are demo assumptions.\nwindow.IDEAROUTE_SEED = '+JSON.stringify(state,null,2)+';\n');
console.log('Generated '+records.length+' cases and '+rules.length+' routing rules.');
