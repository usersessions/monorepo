import type { PlatformScript } from '../agent/types'

export const startupbase: PlatformScript = {
  id: 'startupbase',
  name: 'StartupBase',
  domain: 'startupbase.io',
  submitUrl: 'https://startupbase.io/submit',
  authGate: 'https://startupbase.io/login',
  difficulty: 'low',
  authType: 'oauth',
  authProviders: ['google', 'twitter'],
  steps: [
    { step: 1, description: 'Open submit form', url: 'https://startupbase.io/submit', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Startup name, URL, elevator pitch, category', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", tagline: "input[name*='pitch']", category: 'select' }, expectedPageType: 'form_page', actions: ['type', 'select'] },
    { step: 3, description: 'High-res screenshot', fieldMapping: { productHero: "input[type='file']" }, expectedPageType: 'form_page', actions: ['upload'] },
    { step: 4, description: 'Continue then submit', actions: ['click', 'submit'], successIndicators: ['submitted', 'thank you'] },
  ],
  mediaRequirements: { screenshots: { minWidth: 1280, formats: ['png', 'jpg'], maxCount: 1 } },
  successIndicators: ['submitted', 'thank you', 'under review'],
  errorIndicators: ['something went wrong'],
}
