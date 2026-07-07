import type { PlatformScript } from '../agent/types'

export const futuretools: PlatformScript = {
  id: 'futuretools',
  name: 'FutureTools',
  domain: 'futuretools.io',
  submitUrl: 'https://www.futuretools.io/submit-a-tool',
  difficulty: 'low',
  authType: 'none',
  steps: [
    { step: 1, description: 'Open submit form', url: 'https://www.futuretools.io/submit-a-tool', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Tool name, URL, description, contact email', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", body: 'textarea', contactEmail: "input[type='email']" }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 3, description: 'Pricing select + up to 3 tag checkboxes (fuzzy match)', fieldMapping: { pricingModel: 'select', tags: "input[type='checkbox']" }, actions: ['select', 'click'] },
    { step: 4, description: 'Submit', actions: ['submit'], successIndicators: ['submitted', 'thank you'] },
  ],
  successIndicators: ['submitted', 'thank you'],
  errorIndicators: ['something went wrong'],
}
