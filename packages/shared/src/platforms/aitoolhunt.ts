import type { PlatformScript } from '../agent/types'

export const aitoolhunt: PlatformScript = {
  id: 'aitoolhunt',
  name: 'AI Tool Hunt',
  domain: 'aitoolhunt.com',
  submitUrl: 'https://www.aitoolhunt.com/submit-tool',
  authGate: 'https://www.aitoolhunt.com/login',
  difficulty: 'low',
  authType: 'oauth',
  authProviders: ['google', 'email'],
  steps: [
    { step: 1, description: 'Open submit form', url: 'https://www.aitoolhunt.com/submit-tool', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Name, URL, description, category', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", body: 'textarea', category: 'select' }, expectedPageType: 'form_page', actions: ['type', 'select'] },
    { step: 3, description: '16:9 screenshot upload (raw hero used until crop engine exists)', fieldMapping: { productHero: "input[type='file']" }, actions: ['upload'] },
    { step: 4, description: 'Submit', actions: ['submit'], successIndicators: ['submitted', 'thank you'] },
  ],
  mediaRequirements: { screenshots: { minWidth: 1280, minHeight: 720, formats: ['png', 'jpg'], maxCount: 1 } },
  successIndicators: ['submitted', 'thank you', 'review'],
  errorIndicators: ['something went wrong', 'log in'],
}
