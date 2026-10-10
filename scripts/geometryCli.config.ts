import type { ILogger, NodeIO, Transform } from '@gltf-transform/core'
import { Validator, type program as cliProgram } from '@gltf-transform/cli'
import { geometryTransforms } from './geometryOptimize.ts'
import { DEFAULT_OPTIMIZE_SETTINGS, optimizeSettingsSchema } from './settings.ts'

// The CLI config hook supplies its IO and Session, including the same
// extension codecs, metadata handling and final serialization as optimize.
type ProgramContext = {
  program: typeof cliProgram
  io: NodeIO
  Session: {
    create(
      io: NodeIO,
      logger: ILogger,
      input: unknown,
      output: unknown,
    ): {
      transform(...transforms: Transform[]): Promise<void>
    }
  }
}

export default {
  async onProgramReady({ program, io, Session }: ProgramContext): Promise<void> {
    const command = program
      .command('optimize-preserving', 'Optimize geometry with a declared animation error budget')
      .argument('<input>', 'Source GLB')
      .argument('<output>', 'Candidate GLB')
    for (const flag of ['flatten', 'join', 'simplify', 'palette', 'prune'] as const) {
      command.option(`--${flag} <bool>`, flag, {
        validator: Validator.BOOLEAN,
        default: DEFAULT_OPTIMIZE_SETTINGS[flag],
      })
    }
    command
      .option('--texture-compress <format>', 'Texture encoding already completed', {
        validator: [false],
        default: false,
      })
      .option('--compress <method>', 'Geometry compression', { validator: ['meshopt'] })
      .option('--resample-tolerance <value>', 'Per component curve error budget', {
        validator: Validator.NUMBER,
        required: true,
      })
      .action(({ args, options, logger }) => {
        const settings = optimizeSettingsSchema.parse({
          ...DEFAULT_OPTIMIZE_SETTINGS,
          ...Object.fromEntries(
            ['flatten', 'join', 'simplify', 'palette', 'prune', 'resampleTolerance'].map((key) => [
              key,
              options[key],
            ]),
          ),
        })
        return Session.create(io, logger, args.input, args.output).transform(
          ...geometryTransforms(settings),
        )
      })
  },
}
