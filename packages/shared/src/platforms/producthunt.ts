import type { PlatformScript } from '../agent/types'

export const producthunt: PlatformScript = {
  id: 'producthunt',
  name: 'Product Hunt',
  domain: 'producthunt.com',
  submitUrl: 'https://www.producthunt.com/posts/new',
  authGate: 'https://www.producthunt.com/login',
  difficulty: 'high',
  authType: 'oauth',
  authProviders: ['twitter', 'google', 'apple'],
  steps: [
    { step: 1, description: 'Open the submit wizard', url: 'https://www.producthunt.com/posts/new', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Enter the product URL', fieldMapping: { url: "input[type='url'], input[name='url']" }, expectedPageType: 'form_page', actions: ['type', 'click'] },
    { step: 3, description: 'Name and tagline (60 chars max)', fieldMapping: { title: "input[name='name']", tagline: "input[name='tagline'], textarea[name='tagline']" }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 4, description: 'Topics and description', fieldMapping: { tags: "input[placeholder*='topic']", body: 'textarea' }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 5, description: 'Upload gallery media (2-5 images required)', fieldMapping: { productHero: "input[type='file']" }, expectedPageType: 'form_page', actions: ['upload'] },
    { step: 6, description: 'Maker comment then submit', fieldMapping: { hook: "textarea[placeholder*='comment']" }, actions: ['type', 'submit'], successIndicators: ['scheduled', 'your product is live', 'congratulations'] },
  ],
  mediaRequirements: {
    logo: { minWidth: 240, minHeight: 240, formats: ['png', 'jpg'], maxSizeMB: 5 },
    screenshots: { minWidth: 1270, minHeight: 760, formats: ['png', 'jpg'], maxCount: 8, maxSizeMB: 5 },
  },
  fieldRules: { title: { maxLength: 60, required: true }, tagline: { maxLength: 60, required: true } },
  successIndicators: ['thanks for hunting', 'scheduled', 'your product is live', 'congratulations'],
  errorIndicators: ['something went wrong', 'must be logged in'],
}
