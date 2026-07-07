import type { PlatformScript } from '../agent/types'

export const betalist: PlatformScript = {
  id: 'betalist',
  name: 'BetaList',
  domain: 'betalist.com',
  submitUrl: 'https://betalist.com/submit',
  authGate: 'https://betalist.com/signin',
  difficulty: 'medium',
  authType: 'magic_link',
  authProviders: ['twitter', 'email'],
  steps: [
    { step: 1, description: 'Open submit form', url: 'https://betalist.com/submit', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Startup name, URL and 50-char pitch', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", tagline: "input[name*='pitch'], input[name*='tagline']" }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 3, description: 'Description and launch-status radio', fieldMapping: { body: 'textarea' }, expectedPageType: 'form_page', actions: ['type', 'click'] },
    { step: 4, description: 'Clean screenshot upload', fieldMapping: { productHero: "input[type='file']" }, expectedPageType: 'form_page', actions: ['upload'] },
    { step: 5, description: 'Submit', actions: ['submit'], successIndicators: ['thank you', 'submitted'] },
  ],
  mediaRequirements: { screenshots: { minWidth: 1200, formats: ['png', 'jpg'], maxCount: 1, maxSizeMB: 5 } },
  fieldRules: { tagline: { maxLength: 50, required: true } },
  successIndicators: ['thank you for submitting', 'submitted', 'we will review'],
  errorIndicators: ['something went wrong', 'sign in to continue'],
}
