import type { PlatformScript } from '../agent/types'

export const toolify: PlatformScript = {
  id: 'toolify',
  name: 'Toolify',
  domain: 'toolify.ai',
  submitUrl: 'https://www.toolify.ai/submit',
  authGate: 'https://www.toolify.ai/login',
  difficulty: 'medium',
  authType: 'oauth',
  authProviders: ['google'],
  steps: [
    { step: 1, description: 'Open submit page (SEARCH-FIRST directory)', url: 'https://www.toolify.ai/submit', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Search for the tool URL first; if it already exists, COMPLETE with already_exists', fieldMapping: { url: "input[type='search'], input" }, actions: ['type', 'click'] },
    { step: 3, description: 'If not found: tool name, URL, description', fieldMapping: { title: "input[name*='name']", url: "input[type='url']", body: 'textarea' }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 4, description: 'Submit', actions: ['submit'], successIndicators: ['submitted', 'review'] },
  ],
  successIndicators: ['submitted', 'under review'],
  errorIndicators: ['something went wrong', 'already exists'],
}
