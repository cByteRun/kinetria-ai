'use server'

import { redirect } from 'next/navigation'
import { authenticate, endSession } from '../../lib/auth-flow'

export async function login(form: FormData) { redirect(await authenticate(form)) }
export async function logout() { redirect(await endSession()) }
