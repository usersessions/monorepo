import type { PlatformScript } from '../agent/types'

export const launchingnext: PlatformScript = {
  id: 'launchingnext',
  name: 'Launching Next',
  domain: 'launchingnext.com',
  submitUrl: 'https://www.launchingnext.com/submit/',
  difficulty: 'low',
  authType: 'email',
  steps: [
    { step: 1, description: 'Open submit form', url: 'https://www.launchingnext.com/submit/', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Name, URL, tagline, description, contact email', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", tagline: "input[name*='tagline']", body: 'textarea', contactEmail: "input[type='email']" }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 3, description: 'Choose FREE/standard tier — IGNORE the $49 Fast Track upsell', actions: ['click'] },
    { step: 4, description: 'Submit; confirmation arrives by email (awaiting_email_verification)', actions: ['submit'], successIndicators: ['check your email', 'submitted'] },
  ],
  fieldRules: { contactEmail: { required: true } },
  successIndicators: ['check your email', 'submitted', 'thank you'],
  errorIndicators: ['something went wrong', 'fast track'],
}
