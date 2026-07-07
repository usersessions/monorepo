import type { PlatformScript } from '../agent/types'

export const betapage: PlatformScript = {
  id: 'betapage',
  name: 'BetaPage',
  domain: 'betapage.co',
  submitUrl: 'https://betapage.co/submit',
  authGate: 'https://betapage.co/login',
  difficulty: 'low',
  authType: 'oauth',
  authProviders: ['google', 'email'],
  steps: [
    { step: 1, description: 'Open submit form', url: 'https://betapage.co/submit', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Name, URL, tagline, description', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", tagline: "input[name*='tagline']", body: 'textarea' }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 3, description: 'Beta status radio (public beta default)', actions: ['click'] },
    { step: 4, description: 'Screenshots (platform requires 2 minimum — known engine gap, 1 sent)', fieldMapping: { productHero: "input[type='file']" }, actions: ['upload'] },
    { step: 5, description: 'Submit', actions: ['submit'], successIndicators: ['submitted', 'thank you'] },
  ],
  mediaRequirements: { screenshots: { formats: ['png', 'jpg'], maxCount: 5 } },
  successIndicators: ['submitted', 'thank you', 'review'],
  errorIndicators: ['something went wrong', 'at least 2'],
}
