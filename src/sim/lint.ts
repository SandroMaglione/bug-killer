/**
 * Entry for `ritmo-devtools lint`: a headless runtime with the debug handle,
 * and the schedules the game ticks.
 */
import { HostClock } from "@typeonce/ritmo"
import type { Lint } from "@typeonce/ritmo-devtools"

import { levels } from "../content/levels.ts"
import { Game, InputSource, Presentation } from "./schema.ts"
import { idleInput, initialResources, setupSchedule, updateSchedule } from "./simulation.ts"

export const lintTarget = (): Lint.Target<typeof Game.schema, typeof Game.schema> => {
  const level = levels[0]
  if (!level) throw new Error("no levels")
  const made = Game.Runtime.make({
    services: Game.Runtime.services(
      Game.Runtime.service(InputSource, { snapshot: () => [idleInput] }),
      Game.Runtime.service(Presentation, { fx: () => undefined, chat: () => undefined })
    ),
    resources: initialResources(level, 1),
    debug: { hostClock: HostClock.test() }
  })
  if (!made.ok) throw new Error(JSON.stringify(made.error))
  return { runtime: made.value, schedules: { setup: setupSchedule, update: updateSchedule } }
}
