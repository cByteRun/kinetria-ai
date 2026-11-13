import LandingPage from '../components/new-landing/LandingPage'
import { getTheme } from '../i18n/theme'
import './new-landing.css'

export default async function Home() { return <LandingPage theme={await getTheme()} /> }
