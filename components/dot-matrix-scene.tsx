'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, ArrowRight, Send, Pause, Play } from 'lucide-react'

const stages = [
  { title: 'Идея / Вход', role: 'Telegram / Web', text: 'Сотрудник описывает проблему или предлагает улучшение. Обращение получает номер и сохраняется в общем реестре.' },
  { title: 'Маршрутизация', role: 'Руководитель', text: 'Руководитель определяет категорию, назначает ответственного и срок. У обращения появляется понятный следующий шаг.' },
  { title: 'Решение', role: 'Ответственный', text: 'Ответственный рассматривает обращение и фиксирует решение. Действия и контекст остаются в единой истории.' },
  { title: 'Возврат автору', role: 'Closed-Loop', text: 'Результат возвращается сотруднику. Автор видит, чем завершилось обращение: цикл обратной связи замкнут.' },
]
const vertices = [[-155,-180,10],[150,-180,-55],[-140,0,65],[155,0,-15],[-105,180,40]]
function path(t: number): number[] {
  if (t >= .78) {
    const a = (t - .78) / .22 * Math.PI
    return [-105 - Math.sin(a) * 160 - (1-Math.cos(a))*25, 180 * Math.cos(a),40-Math.sin(a)*110]
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
  function focus(i: number) { setActive(i); target.current = [0,.26,.52,.78][i] }
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
      if(!pauseRef.current&&!reduced.matches){time+=dt;progress=(progress+dt*.065)%1}
      if(selected!==target.current){selected=target.current;progress=selected}
      yaw+=(-.24+selected*.18+pointer.x*.48-yaw)*.045;pitch+=(.1-selected*.12+pointer.y*.22-pitch)*.045
      ctx!.clearRect(0,0,width,height)
      const scale=Math.min(width/600,height/620), cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch)
      for(const p of particles){
        const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy,y=p.y*cp-z*sp,depth=760/(760-z)
        let px=width*.54+x*scale*depth,py=height*.46+y*scale*depth
        const dist=Math.hypot(px-pointer.px,py-pointer.py),mag=Math.max(0,1-dist/100)
        if(!reduced.matches){px+=(px-pointer.px)*mag*.35;py+=(py-pointer.py)*mag*.35}
        const diff=Math.min(Math.abs(p.t-progress),1-Math.abs(p.t-progress)),pulse=Math.exp(-diff*diff*1700)
        const green=p.t>=.78,alpha=p.back?.08+mag*.16:.3+depth*.18+pulse*.5
        ctx!.fillStyle=p.back?`rgba(91,140,188,${alpha})`:green?`rgba(${pulse>.35?'153,255,219':'16,185,129'},${alpha})`:`rgba(${pulse>.35?'192,242,255':p.z>40?'56,189,248':'37,99,235'},${alpha})`
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
  return <div className="route-landing">
    <header className="route-header"><Link href="/" className="route-wordmark" aria-label="IdeaRoute — главная"><svg className="dot-mark" aria-hidden="true" width="30" height="32" viewBox="0 0 32 36"><path d="M5 5H27L5 18H27L5 31" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray=".1 5"/><path d="M5 31Q-3 18 5 5" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeDasharray=".1 4"/></svg>Idea<span>Route</span><sup>®</sup></Link><span className="route-category">ENTERPRISE FEEDBACK<br/>& CASE MANAGEMENT</span><nav aria-label="Основная навигация"><button onClick={()=>focus(1)}>Архитектура цикла</button><a href={telegramUrl}>Telegram-бот <ArrowUpRight size={12}/></a><Link href="/login" className="route-signin">Войти <ArrowRight size={14}/></Link></nav></header>
    <main className="route-main"><section className="route-copy" aria-labelledby="route-title"><div className="route-badge"><i/> CLOSED-LOOP ENTERPRISE ENGINE</div><h1 id="route-title">От идеи сотрудника<br/>до зафиксированного<br/><em>решения</em><span> — без потерь</span></h1><p className="route-lead">Единый маршрут для обращений из Telegram и Web: регистрация, назначение ответственного, контроль сроков и обязательный возврат результата автору.</p><div className="route-stages" aria-label="Этапы маршрута">{stages.map((s,i)=><button key={s.title} onClick={()=>focus(i)} onPointerEnter={()=>focus(i)} onFocus={()=>focus(i)} aria-pressed={active===i}><span>0{i+1}</span><div><strong>{s.title}</strong><small>{s.role}</small></div><span className="stage-dot"/></button>)}</div><div className="route-actions"><Link href="/login" className="route-primary">Открыть демо-кабинет <ArrowUpRight size={18}/></Link><a href={telegramUrl} className="route-telegram"><Send size={15}/><span>Протестировать<br/>в Telegram</span></a></div><div className="route-human"><span>ЧЕЛОВЕК УПРАВЛЯЕТ МАРШРУТОМ.</span> AI помогает оформить черновик.</div></section>
    <section className="route-visual" aria-label="Интерактивная объёмная модель замкнутого маршрута"><canvas ref={canvas} aria-hidden="true"/><div className="scene-heading"><span>IR—01 / ROUTE ENGINE</span><span>WEB ↔ TELEGRAM</span></div><div className="scene-index">0{active+1}<span>/ 04</span></div><div className="scene-annotation annotation-start">01 <i/> ВХОД</div><div className="scene-annotation annotation-owner">02—03 <i/> ОБРАБОТКА</div><div className="scene-annotation annotation-return">04 <i/> ОБРАТНАЯ СВЯЗЬ ↗</div><div className="scene-caption" aria-live="polite"><span className="caption-kicker">ЭТАП 0{active+1} / {stages[active].role}</span><h2>{stages[active].title}<ArrowUpRight size={20}/></h2><p>{stages[active].text}</p></div><button className="scene-pause" onClick={()=>setPaused(v=>!v)} aria-label={paused?'Продолжить анимацию':'Остановить анимацию'}>{paused?<Play size={13}/>:<Pause size={13}/>}</button></section></main>
    <footer className="route-footer"><span><i/> ЕДИНАЯ ИСТОРИЯ. ПОНЯТНАЯ ОТВЕТСТВЕННОСТЬ.</span><span className="footer-loop">ОБРАЩЕНИЕ <b>→</b> РЕШЕНИЕ <b>↳</b> АВТОР</span><span>IDEAROUTE / CLOSED BY DESIGN</span></footer>
  </div>
}
