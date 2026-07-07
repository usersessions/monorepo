import type { PlatformScript } from '../agent/types'

export const futurepedia: PlatformScript = {
  id: 'futurepedia',
  name: 'Futurepedia',
  domain: 'futurepedia.io',
  submitUrl: 'https://www.futurepedia.io/submit-tool',
  authGate: 'https://www.futurepedia.io/login',
  difficulty: 'medium',
  authType: 'oauth',
  authProviders: ['google', 'email'],
  steps: [
    { step: 1, description: 'Open submit form', url: 'https://www.futurepedia.io/submit-tool', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Tool name, website URL, short + detailed description', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", tagline: "input[name*='short']", body: 'textarea' }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 3, description: 'Pricing dropdown + category', fieldMapping: { pricingModel: 'select', category: 'select' }, actions: ['select'] },
    { step: 4, description: 'CRITICAL: pick the FREE tier — NEVER enter the $497 checkout', actions: ['click'] },
    { step: 5, description: 'Submit', actions: ['submit'], successIndicators: ['submitted', 'review'] },
  ],
  successIndicators: ['submitted', 'under review', 'thank you'],
  errorIndicators: ['something went wrong', 'checkout', 'payment'],
}
