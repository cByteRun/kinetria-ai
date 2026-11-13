import { NextResponse } from 'next/server'
import { getRole } from '../../../../lib/session'
import { createClient } from '../../../../lib/supabase/server'
import { hasSupabase } from '../../../../lib/supabase/config'
export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}) {
 if(await getRole()!=='admin') return NextResponse.json({error:'Forbidden'},{status:403})
 if(!hasSupabase) return NextResponse.json({error:'Storage unavailable'},{status:503})
 const {id}=await params,db=await createClient()
 const {error}=await db.rpc('topic_service',{p_op:'delete',p_data:{id}})
 return error ? NextResponse.json({error:'Unable to delete topic'},{status:400}) : new Response(null,{status:204})
}
