import type { PlatformScript } from '../agent/types'

export const uneed: PlatformScript = {
  id: 'uneed',
  name: 'Uneed',
  domain: 'uneed.best',
  submitUrl: 'https://www.uneed.best/submit-a-tool',
  authGate: 'https://www.uneed.best/login',
  difficulty: 'medium',
  authType: 'oauth',
  authProviders: ['google', 'email'],
  steps: [
    { step: 1, description: 'Open submit page', url: 'https://www.uneed.best/submit-a-tool', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Enter URL to trigger their auto-scrape', fieldMapping: { url: "input[type='url'], input" }, expectedPageType: 'form_page', actions: ['type', 'click'] },
    { step: 3, description: 'OVERWRITE scraped data with approved copy', fieldMapping: { title: "input[name*='name']", tagline: "input[name*='tagline']", body: 'textarea' }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 4, description: 'CRITICAL: choose the FREE tier, never the paid skip-the-queue checkout', actions: ['click'] },
    { step: 5, description: 'Submit (login required to save)', actions: ['submit'], successIndicators: ['queue', 'submitted'] },
  ],
  fieldRules: { title: { required: true }, url: { required: true } },
  successIndicators: ['added to the queue', 'submitted', 'thank you'],
  errorIndicators: ['something went wrong', 'payment'],
}
