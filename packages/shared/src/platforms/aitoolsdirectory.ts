import type { PlatformScript } from '../agent/types'

export const aitoolsdirectory: PlatformScript = {
  id: 'aitoolsdirectory',
  name: 'AI Tools Directory',
  domain: 'aitoolsdirectory.com',
  submitUrl: 'https://aitoolsdirectory.com/submit',
  difficulty: 'low',
  authType: 'none',
  steps: [
    { step: 1, description: 'Open submit form', url: 'https://aitoolsdirectory.com/submit', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Tool name, URL, description, category, contact email', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", body: 'textarea', category: 'select', contactEmail: "input[type='email']" }, expectedPageType: 'form_page', actions: ['type', 'select'] },
    { step: 3, description: 'Submit', actions: ['submit'], successIndicators: ['submitted', 'thank you'] },
  ],
  successIndicators: ['submitted', 'thank you'],
  errorIndicators: ['something went wrong'],
}
