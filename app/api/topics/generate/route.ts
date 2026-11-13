import { getRole } from '../../../../lib/session'
import { canGenerateTopics } from '../../../../lib/roles'
import { NextResponse } from 'next/server'
import { analyzeRecurringTopics } from '../../../workspace/actions'
export async function POST(request:Request) {
 const role=await getRole()
 if(!role)return NextResponse.json({error:'Authentication required'},{status:401})
 if(!canGenerateTopics(role))return NextResponse.json({error:'Permission denied'},{status:403})
 let body:unknown
 try {body=await request.json()} catch {return NextResponse.json({error:'Invalid JSON'},{status:400})}
 if(!body || typeof body!=='object' || !('ids' in body) || !Array.isArray(body.ids) || body.ids.length<2 || body.ids.length>200 || !body.ids.every(id=>typeof id==='string')) return NextResponse.json({error:'Select 2–200 requests'},{status:400})
 const prompt='prompt' in body ? body.prompt : ''
 if(typeof prompt!=='string'||prompt.length>2000)return NextResponse.json({error:'Invalid prompt'},{status:400})
 const result=await analyzeRecurringTopics(90,body.ids,prompt)
 return NextResponse.json(result,{status:'error' in result?400:200})
}
