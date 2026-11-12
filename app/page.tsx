import { getTranslations } from 'next-intl/server'
import { getTheme } from '../i18n/theme'
import Link from 'next/link'
import {
  ArrowDown,
  ClipboardCheck,
  ListChecks,
  ArrowUpRight,
  Check,
  GitBranch,
  MessageSquare,
  Plus,
  Settings2,
} from 'lucide-react'
import { Brand } from '../components/brand'
import { LandingHeader } from '../components/landing-header'
import { PilotBrief } from '../components/pilot-brief'
import './landing.css'

export default async function Home() {
  const t = await getTranslations('landing')
  const theme = await getTheme()
  const steps = [
    {
      title: t('step1'),
      text: t('step1Text'),
      icon: MessageSquare,
    },
    {
      title: t('step2'),
      text: t('step2Text'),
      icon: GitBranch,
    },
    {
      title: t('step3'),
      text: t('step3Text'),
      icon: ClipboardCheck,
    },
    { title: t('step4'), text: t('step4Text'), icon: ListChecks },
  ]

  const plans = [
    {
      name: t('pilot'),
      cta: t('pilotCta'),
      features: [t('pilot1'), t('pilot2'), t('pilot3')],
    },
    {
      name: t('deployment'),
      cta: t('deploymentCta'),
      features: [t('deployment1'), t('deployment2'), t('deployment3')],
    },
  ]

  const questions = [
    {
      question: t('q1'),
      answer: t('a1'),
    },
    {
      question: t('q2'),
      answer: t('a2'),
    },
    {
      question: t('q3'),
      answer: t('a3'),
    },
  ]

  const contactEmail = process.env.KINETRIA_CONTACT_EMAIL?.trim()

  return (
    <div className="landing">
      <a className="landing-skip" href="#product">
        {t('skip')}
      </a>
      <LandingHeader theme={theme} />
      <main>
        <section className="landing-hero idea-dot-field" id="product">
          <div className="container landing-hero-grid">
            <div>
              <p className="landing-label idea-product-mark">Feedback Operations Platform</p>
              <h1>
                {t('headlineStart')}
                {' '}
                {t.rich('headlineEnd', {
                  accent: (chunks) => <em>{chunks}</em>,
                })}
              </h1>
              <p className="landing-lead">{t('lead')}</p>
              <div className="landing-actions">
                <Link
                  className="landing-button landing-button-primary"
                  href="/login"
                >
                  {t('demo')}
                  <ArrowUpRight size={17} />
                </Link>
                <a
                  className="landing-button landing-button-secondary"
                  href="#how"
                >
                  {t('howLink')}
                  <ArrowDown size={16} />
                </a>
              </div>
            </div>
            <aside className="landing-case" aria-labelledby="case-title">
              <div className="case-heading">
                <span>{t('caseLabel')}</span>
                <span>A-003</span>
              </div>
              <h2 id="case-title">{t('caseTitle')}</h2>
              <dl>
                <div>
                  <dt>{t('message')}</dt>
                  <dd>{t('caseMessage')}</dd>
                </div>
                <div>
                  <dt>{t('owner')}</dt>
                  <dd>{t('catalogOwner')}</dd>
                </div>
                <div>
                  <dt>{t('nextStep')}</dt>
                  <dd>{t('caseNextStep')}</dd>
                </div>
              </dl>
              <span className="case-status">
                <GitBranch size={15} />
                {t('caseStatus')}
              </span>
            </aside>
          </div>
        </section>

        <section className="landing-section" id="how">
          <div className="container">
            <p className="landing-label">Closed-Loop Feedback</p>
            <h2>{t('processTitle')}</h2>
            <ol className="landing-steps">
              {steps.map(({ title, text, icon: Icon }) => (
                <li key={title}>
                  <Icon size={22} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-section landing-roles" aria-labelledby="roles-heading">
          <div className="container">
            <h2 id="roles-heading">{t('audience')}</h2>
            <ul className="landing-steps landing-role-grid">
              {[
                { title: t('employeeTitle'), text: t('employeeText'), icon: MessageSquare },
                { title: t('managerTitle'), text: t('managerText'), icon: ClipboardCheck },
                { title: t('handlerTitle'), text: t('handlerText'), icon: ListChecks },
                { title: t('adminTitle'), text: t('adminText'), icon: Settings2 },
              ].map(({ title, text, icon: Icon }) => (
                <li key={title}>
                  <Icon size={22} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="landing-section landing-pricing" id="pricing">
          <div className="container">
            <p className="landing-label">{t('rollout')}</p>
            <h2>{t('pricingTitle')}</h2>
            <p className="landing-lead">{t('pricingText')}</p>
            <div className="landing-plan-grid">
              {plans.map(({ name, features, cta }) => (
                <article className="landing-plan" key={name}>
                  <h3>{name}</h3>
                  <ul>
                    {features.map((feature) => (
                      <li key={feature}>
                        <Check size={16} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    className="landing-button landing-button-secondary"
                    href="#contact"
                  >
                    {cta} <ArrowUpRight size={16} />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="container landing-faq">
            <h2>{t('faq')}</h2>
            <div>
              {questions.map(({ question, answer }) => (
                <details key={question}>
                  <summary>
                    {question}
                    <Plus size={18} />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-contact" id="contact">
          <div className="container landing-contact-grid">
            <div>
              <p className="landing-label">{t('contact')}</p>
              <h2>{t('estimate')}</h2>
              <p className="landing-lead">{t('estimateText')}</p>
              <div className="landing-actions">
                {contactEmail && (
                  <a
                    className="landing-button landing-button-secondary"
                    href={`mailto:${contactEmail}`}
                  >
                    {t('write')}
                    <ArrowUpRight size={16} />
                  </a>
                )}
                <a
                  className="landing-text-link"
                  href="https://github.com/cByteRun/kinetria-ai"
                >
                  {t('github')}
                  <ArrowUpRight size={15} />
                </a>
              </div>
            </div>
            <PilotBrief contactEmail={contactEmail} />
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="container">
          <Brand />
          <span>{t('footer')}</span>
          <a href="#product">{t('top')}</a>
        </div>
      </footer>
    </div>
  )
}
