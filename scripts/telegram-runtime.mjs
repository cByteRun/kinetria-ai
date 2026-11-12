import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
let registered=false
export async function loadTelegramRuntime(){
 if(!registered){
  registerHooks({resolve(specifier,context,nextResolve){
   if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){
    const candidate=new URL(specifier+'.ts',context.parentURL)
    if(existsSync(fileURLToPath(candidate)))return nextResolve(candidate.href,context)
   }
   return nextResolve(specifier,context)
  }})
  registered=true
 }
 const bot=await import('../lib/telegram/bot.ts')
 const delivery=await import('../lib/telegram/delivery.ts')
 return {...bot,...delivery}
}
