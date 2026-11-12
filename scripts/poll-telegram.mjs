// Polling has been retired: use the Next.js webhook for every environment.
throw new Error('Polling is disabled. Set a public HTTPS APP_URL and run pnpm telegram:webhook. For local development expose Next.js through an HTTPS tunnel.')
