import type { PlatformScript } from '../agent/types'

import { aitoolhunt } from './aitoolhunt'
import { aitoolsdirectory } from './aitoolsdirectory'
import { betalist } from './betalist'
import { betapage } from './betapage'
import { futurepedia } from './futurepedia'
import { futuretools } from './futuretools'
import { indiehackers } from './indiehackers'
import { launchingnext } from './launchingnext'
import { microlaunch } from './microlaunch'
import { producthunt } from './producthunt'
import { startupbase } from './startupbase'
import { theresanaiforthat } from './theresanaiforthat'
import { toolify } from './toolify'
import { topai } from './topai'
import { uneed } from './uneed'

/** All 15 platform navigation scripts, keyed by platformId (matches the adapter registry). */
export const PLATFORM_SCRIPTS: Record<string, PlatformScript> = {
  [producthunt.id]: producthunt,
  [betalist.id]: betalist,
  [indiehackers.id]: indiehackers,
  [microlaunch.id]: microlaunch,
  [uneed.id]: uneed,
  [startupbase.id]: startupbase,
  [betapage.id]: betapage,
  [launchingnext.id]: launchingnext,
  [theresanaiforthat.id]: theresanaiforthat,
  [futurepedia.id]: futurepedia,
  [futuretools.id]: futuretools,
  [toolify.id]: toolify,
  [aitoolsdirectory.id]: aitoolsdirectory,
  [topai.id]: topai,
  [aitoolhunt.id]: aitoolhunt,
}
