import { RouteLanding } from '../components/dot-matrix-scene'
import './landing.css'

export default function Home() {
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '')
  return <RouteLanding telegramUrl={username && /^[a-zA-Z0-9_]+$/.test(username) ? `https://t.me/${username}` : '/login#telegram-title'} />
}
