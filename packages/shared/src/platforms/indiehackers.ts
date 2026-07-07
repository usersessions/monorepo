import type { PlatformScript } from '../agent/types'

export const indiehackers: PlatformScript = {
  id: 'indiehackers',
  name: 'Indie Hackers',
  domain: 'indiehackers.com',
  submitUrl: 'https://www.indiehackers.com/products/new',
  authGate: 'https://www.indiehackers.com/sign-in',
  difficulty: 'medium',
  authType: 'oauth',
  authProviders: ['twitter', 'github', 'email'],
  steps: [
    { step: 1, description: 'Open new product form', url: 'https://www.indiehackers.com/products/new', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Product name, website and elevator pitch', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", tagline: "input[name*='tagline'], input[placeholder*='pitch']" }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 3, description: 'Revenue stage (default pre-revenue) and founder story', fieldMapping: { hook: 'textarea' }, expectedPageType: 'form_page', actions: ['click', 'type'] },
    { step: 4, description: 'Submit', actions: ['submit'], successIndicators: ['product created', 'your product'] },
  ],
  fieldRules: { title: { required: true }, url: { required: true } },
  successIndicators: ['product created', 'your product page'],
  errorIndicators: ['something went wrong', 'sign in'],
}
