'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Pause, Play } from 'lucide-react'

const stages = [
  { title: 'Голос в Telegram', status: 'Входящее', text: 'На складе №2 турникет не считывает карты. Смены задерживаются на 10–15 минут.', meta: 'Ответственный: не назначен', comment: 'Сотрудник надиктовал проблему за 40 секунд. Текст распознан.' },
  { title: 'Черновик', status: 'Проверка автором', text: 'Категория: Инфраструктура и доступ. Приложено фото считывателя. Автор проверил текст и нажал „Отправить“.', meta: 'Ответственный: ожидает распределения', comment: 'Ничего не ушло в работу без подтверждения самого сотрудника.' },
  { title: 'Назначение', status: 'В работе', text: 'Руководитель смены изучил обращение и передал в службу эксплуатации со сроком до завтра, 14:00.', meta: 'Ответственный: Алексей Громов (Эксплуатация)', comment: 'Появился конкретный человек и понятный срок решения.' },
  { title: 'Решение', status: 'Решено', text: 'Заменили плату считывателя RFID и обновили прошивку контроллера. Пропускная способность восстановлена.', meta: 'Итог зафиксирован в реестре', comment: 'Решение сохранено в историю — если проблема повторится, команда уже знает ответ.' },
  { title: 'Ответ автору', status: 'Цикл закрыт', text: 'Сотруднику в Telegram пришло уведомление: „Турникет на складе №2 отремонтирован и работает в штатном режиме“.', meta: 'Цикл завершен за 4 часа 20 минут', comment: 'Человек видит, что его услышали. Доверие к процессу растет.' },
]
const stops = [0, .195, .39, .78, 1]
const vertices = [[-155,-180,10],[150,-180,-55],[-140,0,65],[155,0,-15],[-105,180,40]]
function path(t: number): number[] {
  if (t >= .78) {
    const a = (t - .78) / .22 * Math.PI
    return [-105 - Math.sin(a) * 160 - (1-Math.cos(a))*25, 180 * Math.cos(a),40-30*(1-Math.cos(a))/2-Math.sin(a)*110]
  }
  const p = t / .78 * 4, i = Math.min(3, Math.floor(p)), f = p-i
  return vertices[i].map((v,j) => v+(vertices[i+1][j]-v)*f)
}

type Particle = { x: number; y: number; z: number; t: number; back: boolean }
export function RouteLanding({ telegramUrl }: { telegramUrl: string }) {
  const [active, setActive] = useState(0)
  const [paused,setPaused] = useState(false)
  const target = useRef(0)
  const pauseRef = useRef(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const stageRef = useRef(0)
  const select = (i: number) => {
    stageRef.current = i
    target.current = stops[i]
    setActive(i)
  }
  function focus(i: number) {
    select(i)
    const el = wrapper.current
    if (!el) return
    const top = window.scrollY + el.getBoundingClientRect().top
    window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * i / 4, behavior: 'instant' })
  }
  useEffect(() => {
    let scheduled = 0
    function sync() {
      scheduled = 0
      const el = wrapper.current
      if (!el) return
      const distance = el.offsetHeight - window.innerHeight
      const progress = Math.max(0, Math.min(1, -el.getBoundingClientRect().top / Math.max(1, distance)))
      const index = Math.min(4, Math.floor(progress * 5))
      if (stageRef.current !== index) {
        stageRef.current = index
        target.current = stops[index]
        setActive(index)
      }
    }
    const scroll = () => { if (!scheduled) scheduled = requestAnimationFrame(sync) }
    window.addEventListener('scroll', scroll, { passive: true })
    window.addEventListener('resize', scroll)
    sync()
    return () => { cancelAnimationFrame(scheduled); window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll) }
  }, [])
  useEffect(() => { pauseRef.current = paused }, [paused])
  useEffect(() => {
    const el = canvas.current, ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let width=0,height=0,frame=0,last=0,time=0,progress=0,selected=0,yaw=-.24,pitch=.12,dirty=true
    const pointer={x:0,y:0,px:-1000,py:-1000}
    const particles: Particle[]=[]
    for(let i=0;i<560;i++) {
      const t=i/560, p=path(t), next=path(Math.min(.999,t+.001)), angle=Math.atan2(next[1]-p[1],next[0]-p[0])
      for(let k=0;k<12;k++) {
        const a=k/12*Math.PI*2, r=t<.78?18:5
        particles.push({x:p[0]-Math.sin(angle)*Math.cos(a)*r,y:p[1]+Math.cos(angle)*Math.cos(a)*r,z:p[2]+Math.sin(a)*r,t,back:false})
      }
    }
    function line(a:number[],b:number[]) {
      const n=Math.ceil(Math.hypot(...a.map((v,i)=>v-b[i]))/13)
      for(let i=0;i<=n;i++) particles.push({x:a[0]+(b[0]-a[0])*i/n,y:a[1]+(b[1]-a[1])*i/n,z:a[2]+(b[2]-a[2])*i/n,t:0,back:true})
    }
    for(let x=-800;x<700;x+=180) for(let z=-600;z<0;z+=190) {
      line([x,270,z],[x+115,270,z]);line([x,270,z],[x,270,z+80]);line([x+115,270,z],[x+115,270,z+80]);line([x,270,z+80],[x+115,270,z+80])
      line([x,270,z],[x,360,z]);line([x+115,270,z],[x+115,360,z]);line([x+25,210,z],[x+90,210,z]);line([x+25,210,z],[x+25,255,z]);line([x+90,210,z],[x+90,255,z]);line([x+25,255,z],[x+90,255,z])
    }
    for(let x=-800;x<800;x+=35) line([x,375,-800],[x,375,250])
    particles.sort((a,b)=>a.z-b.z)
    function resize() { const r=el!.getBoundingClientRect();width=r.width;height=r.height;const d=Math.min(devicePixelRatio,2);el!.width=width*d;el!.height=height*d;ctx!.setTransform(d,0,0,d,0,0);dirty=true }
    const observer=new ResizeObserver(resize);observer.observe(el);resize()
    function move(e:PointerEvent) { const r=el!.getBoundingClientRect();pointer.px=e.clientX-r.left;pointer.py=e.clientY-r.top;pointer.x=pointer.px/width-.5;pointer.y=pointer.py/height-.5;dirty=true }
    function leave(){pointer.x=0;pointer.y=0;pointer.px=-1000;dirty=true}
    function draw(now:number) {
      const dt=Math.min((now-last)/1000,.04);last=now
      if(document.hidden){frame=requestAnimationFrame(draw);return}
      if((pauseRef.current||reduced.matches)&&!dirty&&selected===target.current){frame=requestAnimationFrame(draw);return}
      dirty=false
      if(!pauseRef.current&&!reduced.matches){time+=dt}
      selected=target.current
      if(reduced.matches || pauseRef.current) progress=selected
      else progress+=(selected-progress)*(1-Math.exp(-dt*3.4))
      yaw+=(-.24+selected*.18+pointer.x*.48-yaw)*.045;pitch+=(.1-selected*.12+pointer.y*.22-pitch)*.045
      ctx!.clearRect(0,0,width,height)
      const scale=Math.min(width/600,height/760), cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch)
      for(const p of particles){
        const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy,y=p.y*cp-z*sp,depth=760/(760-z)
        let px=width*.54+x*scale*depth,py=height*.34+y*scale*depth
        const dist=Math.hypot(px-pointer.px,py-pointer.py),mag=Math.max(0,1-dist/100)
        if(!reduced.matches){px+=(px-pointer.px)*mag*.35;py+=(py-pointer.py)*mag*.35}
        const diff=Math.min(Math.abs(p.t-progress),1-Math.abs(p.t-progress)),pulse=Math.exp(-diff*diff*1700)
        const green=selected===1,alpha=p.back?.065+mag*.1:.16+depth*.14+pulse*.65
        ctx!.fillStyle=p.back?`rgba(91,140,188,${alpha})`:green?`rgba(${pulse>.35?'192,225,227':'109,166,176'},${alpha})`:`rgba(${pulse>.35?(selected===.39?'244,201,139':'192,227,255'):p.z>40?'89,156,212':'52,97,158'},${alpha})`
        const radius=(p.back?.65:1.05+pulse*1.3+mag)*scale*depth
        ctx!.beginPath();ctx!.arc(px,py,Math.max(.3,radius),0,Math.PI*2);ctx!.fill()
      }
      // Bidirectional synchronization along the meridian.
      for(let y=0;y<height;y+=12){const pulse=Math.pow(Math.max(0,Math.cos(y/height*7-time*1.8)),18);ctx!.fillStyle=`rgba(56,189,248,${.14+pulse*.7})`;ctx!.beginPath();ctx!.arc(9,y,1+pulse,0,7);ctx!.fill()}
      frame=requestAnimationFrame(draw)
    }
    el.addEventListener('pointermove',move);el.addEventListener('pointerleave',leave)
    const preference=()=>{dirty=true};reduced.addEventListener('change',preference)
    frame=requestAnimationFrame(draw)
    return()=>{cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',leave);reduced.removeEventListener('change',preference)}
  },[])
  const stage = stages[active]
  return <div className="route-landing" ref={wrapper}>
    <div className="route-sticky">
      <header className="route-header">
        <Link href="/" className="route-wordmark" aria-label="IdeaRoute — главная"><svg aria-hidden="true" width="30" height="32" viewBox="0 0 32 36"><path d="M5 5H27L5 18H27L5 31" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray=".1 4"/></svg>Idea<span>Route</span></Link>
        <Link href="/login" className="route-signin">Войти <ArrowRight size={16}/></Link>
      </header>
      <main className="route-main">
        <section className="route-copy" aria-labelledby="route-title">
          <h1 id="route-title">Идеи и проблемы сотрудников больше не тонут в чатах</h1>
          <p>Сотрудник надиктовал проблему за полминуты — руководитель назначил ответственного — автор получил понятный ответ. Весь путь как на ладони.</p>
          <div className="route-actions"><Link href="/login" className="route-primary">Попробовать в демо-кабинете</Link><a href={telegramUrl} className="route-telegram">Открыть Telegram-бота <span aria-hidden="true">→</span></a></div>
        </section>
        <section className="route-visual" aria-labelledby="story-title">
          <canvas ref={canvas} aria-hidden="true"/>
          <div className="story-content">
            <h2 id="story-title">Пройдите путь идеи</h2>
            <nav className="story-steps" aria-label="Этапы обращения">{stages.map((s,i)=><button key={s.title} onClick={()=>focus(i)} aria-current={active===i?'step':undefined}><span>{s.title}</span><i aria-hidden="true"/></button>)}</nav>
            <article className="case-card" aria-label="Пример обращения IR-204" aria-live="polite" aria-atomic="true">
              <div className="case-content" key={active}><div className="case-status"><span>#IR-204</span><span>{stage.status}</span></div>
              <h3>Сломан пропускной турникет на складе №2</h3>
              <p className="case-description">{stage.text}</p>
              <p className="case-meta">{stage.meta}</p>
              <p className="case-comment">{stage.comment}</p></div>
            </article>
            <div className="story-controls"><span>{active+1} из 5</span><button className="scene-pause" onClick={()=>setPaused(v=>!v)} aria-label={paused?'Продолжить анимацию':'Остановить анимацию'}>{paused?<Play size={15}/>:<Pause size={15}/>}</button></div>
          </div>
        </section>
      </main>
    </div>
  </div>
}
