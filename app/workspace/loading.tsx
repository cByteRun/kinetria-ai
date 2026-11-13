import { getTranslations } from 'next-intl/server'

export default async function WorkspaceLoading() {
  const t = await getTranslations('common')
  return <section className="workspace-loading" aria-busy="true">
    <div role="status" aria-label={t('loading')} style={{ minHeight: 180, display: 'grid', placeItems: 'center' }}>
      <span aria-hidden="true">…</span>
    </div>
  </section>
}
