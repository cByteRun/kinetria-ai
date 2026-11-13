import { NextResponse } from 'next/server'
import { getRole } from '../../../lib/session'
import { createClient } from '../../../lib/supabase/server'
import { hasSupabase } from '../../../lib/supabase/config'

export async function GET() {
 const role = await getRole()
 if (!role || !['admin','manager','handler'].includes(role)) return NextResponse.json({error:'Forbidden'}, {status:403})
 if (!hasSupabase) return NextResponse.json({topics:[],canDelete:role==='admin'})
 const db=await createClient()
 const {data,error}=await db.rpc('topic_service',{p_op:'list'})
 if(error) return NextResponse.json({error:'Topic storage unavailable'}, {status:503})
 return NextResponse.json({topics:data,canDelete:role==='admin'}, {headers:{'Cache-Control':'no-store'}})
}
export async function POST(request: Request) {
 const role=await getRole()
 if(!role || !['admin','manager','handler'].includes(role)) return NextResponse.json({error:'Forbidden'},{status:403})
 if(!hasSupabase) return NextResponse.json({error:'Storage unavailable'},{status:503})
 let body:unknown
 try {body=await request.json()} catch {return NextResponse.json({error:'Invalid JSON'},{status:400})}
 if(!body || typeof body!=='object') return NextResponse.json({error:'Invalid topic'},{status:400})
 const db=await createClient()
 const {data,error}=await db.rpc('topic_service',{p_op:'save',p_data:body})
 if(error) return NextResponse.json({error:'Unable to save topic'}, {status:error.code==='42501'?403:error.code==='PT409'?409:400})
 return NextResponse.json({id:data},{status:201})
}
