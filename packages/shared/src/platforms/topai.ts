import type { PlatformScript } from '../agent/types'

export const topai: PlatformScript = {
  id: 'topai',
  name: 'TopAI.tools',
  domain: 'topai.tools',
  submitUrl: 'https://topai.tools/submit',
  difficulty: 'low',
  authType: 'none',
  steps: [
    { step: 1, description: 'Open submit form (2-step)', url: 'https://topai.tools/submit', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Name, URL, short (<100 chars) and long (>200 chars) descriptions — NEVER pad the body to pass validation', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", tagline: "input[name*='short']", body: 'textarea' }, expectedPageType: 'form_page', actions: ['type', 'click'] },
    { step: 3, description: 'Contact email on step 2, then submit', fieldMapping: { contactEmail: "input[type='email']" }, actions: ['type', 'submit'], successIndicators: ['submitted', 'thank you'] },
  ],
  fieldRules: { tagline: { maxLength: 100, required: true }, body: { required: true } },
  successIndicators: ['submitted', 'thank you'],
  errorIndicators: ['something went wrong', 'at least 200'],
}
