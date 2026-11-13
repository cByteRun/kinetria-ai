import { aiConfig } from './ai'
import { HybridImpactEstimator } from './impact-estimator'
import { telegramDb } from './telegram/api'
// Server-only entry point. Call only after an authorized domain submission.
export async function enrichRequest(id:string,locale='ru') {
  if (!aiConfig()) throw new Error('AI not configured')
  const db=telegramDb()
  const [{data:request,error},{data:categories,error:categoryError}]=await Promise.all([
    db.from('requests').select('title,description,proposal,impact_hint').eq('id',id).single(),
    db.from('request_categories').select('id').eq('active',true),
  ])
  if(error || categoryError || !request || !categories?.length) throw new Error('Enrichment input unavailable')
  const {data:metrics}=await db.from('request_impact_metrics').select('hours_per_month,monthly_value,currency,basis').eq('request_id',id).maybeSingle()
  const report=await new HybridImpactEstimator().estimate({...request,metrics},categories.map(c=>c.id),locale)
  const {error:saveError}=await db.from('request_enrichments').upsert({request_id:id,report,created_at:new Date().toISOString()})
  if(saveError) throw new Error('Enrichment save failed')
}
