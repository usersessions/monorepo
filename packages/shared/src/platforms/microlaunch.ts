import type { PlatformScript } from '../agent/types'

export const microlaunch: PlatformScript = {
  id: 'microlaunch',
  name: 'MicroLaunch',
  domain: 'microlaunch.net',
  submitUrl: 'https://microlaunch.net/submit',
  authGate: 'https://microlaunch.net/login',
  difficulty: 'medium',
  authType: 'oauth',
  authProviders: ['github', 'twitter'],
  steps: [
    { step: 1, description: 'Open submit wizard', url: 'https://microlaunch.net/submit', expectedPageType: 'form_page', actions: ['navigate'] },
    { step: 2, description: 'Name, tagline, URL', fieldMapping: { title: "input[name*='name']", tagline: "input[name*='tagline']", url: "input[type='url']" }, expectedPageType: 'form_page', actions: ['type'] },
    { step: 3, description: 'Description and media (1:1 logo, 16:9 hero)', fieldMapping: { body: 'textarea', productHero: "input[type='file']" }, expectedPageType: 'form_page', actions: ['type', 'upload'] },
    { step: 4, description: 'Pick earliest open launch window, submit', actions: ['click', 'submit'], successIndicators: ['scheduled', 'launch'] },
  ],
  mediaRequirements: { logo: { minWidth: 256, minHeight: 256, formats: ['png'] }, screenshots: { minWidth: 1280, minHeight: 720, formats: ['png', 'jpg'], maxCount: 5 } },
  successIndicators: ['scheduled', 'submitted', 'thank you'],
  errorIndicators: ['something went wrong', 'log in'],
}
