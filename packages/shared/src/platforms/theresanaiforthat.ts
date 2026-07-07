import type { PlatformScript } from '../agent/types'

export const theresanaiforthat: PlatformScript = {
  id: 'theresanaiforthat',
  name: "There's An AI For That",
  domain: 'theresanaiforthat.com',
  submitUrl: 'https://theresanaiforthat.com/submit/',
  authGate: 'https://theresanaiforthat.com/login/',
  difficulty: 'medium',
  authType: 'email',
  steps: [
    { step: 1, description: 'Open the single long form', url: 'https://theresanaiforthat.com/submit/', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'AI name, URL, use case, pricing model', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", body: 'textarea', pricingModel: 'select' }, expectedPageType: 'form_page', actions: ['type', 'select'] },
    { step: 3, description: 'Category taxonomy (granular checkboxes)', fieldMapping: { category: "input[name*='category'], select" }, actions: ['click', 'select'] },
    { step: 4, description: 'Fallback image if OG scrape fails, then submit', fieldMapping: { productHero: "input[type='file']" }, actions: ['upload', 'submit'], successIndicators: ['submitted', 'review'] },
  ],
  successIndicators: ['submitted', 'under review', 'thank you'],
  errorIndicators: ['something went wrong', 'log in'],
}
