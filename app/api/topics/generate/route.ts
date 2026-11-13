import { NextResponse } from 'next/server'
import { analyzeRecurringTopics } from '../../../workspace/actions'
export async function POST(request:Request) {
 let body:unknown
 try {body=await request.json()} catch {return NextResponse.json({error:'Invalid JSON'},{status:400})}
 if(!body || typeof body!=='object' || !('ids' in body) || !Array.isArray(body.ids) || body.ids.length<2 || body.ids.length>200 || !body.ids.every(id=>typeof id==='string')) return NextResponse.json({error:'Select 2–200 requests'},{status:400})
 const result=await analyzeRecurringTopics(90,body.ids)
 return NextResponse.json(result,{status:'error' in result?400:200})
}
