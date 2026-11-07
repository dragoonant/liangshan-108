import heroes from '../../data/heroes.json'
import extra from '../../data/heroes-extra.json'
import court from '../../data/court.json'
import rivals from '../../data/rivals.json'
import skills from '../../data/skills.json'
import map from '../../data/map.json'
import triggers from '../../data/triggers.json'
import type { DataBundle } from './types'

export * from './types'

/** The default bundle: the validated files under data/ (npm run validate:data). */
export const defaultBundle: DataBundle = {
  heroes: heroes as unknown as DataBundle['heroes'],
  extra: extra as unknown as DataBundle['extra'],
  court: court as unknown as DataBundle['court'],
  rivals: rivals as unknown as DataBundle['rivals'],
  skills: skills as unknown as DataBundle['skills'],
  map: map as unknown as DataBundle['map'],
  triggers: triggers as unknown as DataBundle['triggers'],
}
