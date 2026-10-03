import { TextureChannel } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import {
  buildKtxCreateArgs,
  encodedFormat,
  encodedSize,
  type Ktx2TextureFacts,
} from './ktx2Args.ts'
import { DEFAULT_OPTIMIZE_SETTINGS } from './settings.ts'

const settings = DEFAULT_OPTIMIZE_SETTINGS

const factsWith = (overrides: Partial<Ktx2TextureFacts>): Ktx2TextureFacts => ({
  mode: 'uastc',
  slots: ['occlusionTexture'],
  colorSpace: null,
  channels: TextureChannel.R,
  srcSize: [1024, 1024],
  maxSize: settings.textureMaxSize,
  settings,
  ...overrides,
})

describe('buildKtxCreateArgs', () => {
  it('emits the exact arguments for a UASTC data texture that is a normal map, without RDO', () => {
    const args = buildKtxCreateArgs(
      factsWith({
        slots: ['normalTexture'],
        channels: TextureChannel.R | TextureChannel.G | TextureChannel.B,
      }),
      'in.png',
      'out.ktx2',
    )
    expect(args).toEqual([
      'create',
      '--generate-mipmap',
      '--encode',
      'uastc',
      '--uastc-quality',
      '4',
      '--zstd',
      '18',
      '--assign-tf',
      'linear',
      '--assign-primaries',
      'none',
      '--format',
      'R8G8B8_UNORM',
      '--threads',
      '1',
      'in.png',
      'out.ktx2',
    ])
  })

  it('emits RDO single-threaded for a UASTC texture that is not a normal map', () => {
    const args = buildKtxCreateArgs(factsWith({}), 'in.png', 'out.ktx2')
    expect(args).toEqual([
      'create',
      '--generate-mipmap',
      '--encode',
      'uastc',
      '--uastc-quality',
      '4',
      '--uastc-rdo',
      '--uastc-rdo-l',
      '4',
      '--uastc-rdo-m',
      '--zstd',
      '18',
      '--assign-tf',
      'linear',
      '--assign-primaries',
      'none',
      '--format',
      'R8_UNORM',
      '--threads',
      '1',
      'in.png',
      'out.ktx2',
    ])
  })

  it('emits the exact arguments for an ETC1S color texture in sRGB', () => {
    const args = buildKtxCreateArgs(
      factsWith({
        mode: 'etc1s',
        slots: ['baseColorTexture'],
        colorSpace: 'srgb',
        channels: TextureChannel.R | TextureChannel.G | TextureChannel.B,
      }),
      'in.png',
      'out.ktx2',
    )
    expect(args).toEqual([
      'create',
      '--generate-mipmap',
      '--encode',
      'basis-lz',
      '--qlevel',
      '255',
      '--assign-tf',
      'srgb',
      '--assign-primaries',
      'bt709',
      '--format',
      'R8G8B8_SRGB',
      '--threads',
      '1',
      'in.png',
      'out.ktx2',
    ])
  })

  it('emits the no-RDO flags for an ETC1S texture in a normal map slot', () => {
    const args = buildKtxCreateArgs(
      factsWith({
        mode: 'etc1s',
        slots: ['normalTexture'],
        channels: TextureChannel.R | TextureChannel.G | TextureChannel.B,
      }),
      'in.png',
      'out.ktx2',
    )
    expect(args).toContain('--no-endpoint-rdo')
    expect(args).toContain('--no-selector-rdo')
    // The endpoint and selector RDO of the ETC1S branch are off, but the
    // quality level and the rest of the parameters stay.
    expect(args).toEqual([
      'create',
      '--generate-mipmap',
      '--encode',
      'basis-lz',
      '--qlevel',
      '255',
      '--no-endpoint-rdo',
      '--no-selector-rdo',
      '--assign-tf',
      'linear',
      '--assign-primaries',
      'none',
      '--format',
      'R8G8B8_UNORM',
      '--threads',
      '1',
      'in.png',
      'out.ktx2',
    ])
  })

  it('resizes a texture above the stage maximum with --width and --height', () => {
    const args = buildKtxCreateArgs(factsWith({ maxSize: 512 }), 'in.png', 'out.ktx2')
    expect(args).toContain('--width')
    expect(args).toContain('--height')
    const width = args[args.indexOf('--width') + 1]
    const height = args[args.indexOf('--height') + 1]
    expect(width).toBe('512')
    expect(height).toBe('512')
    // The resize arguments sit with the other encoder parameters, before
    // the single-thread pin and the file paths.
    expect(args.indexOf('--width')).toBeLessThan(args.indexOf('--threads'))
    expect(args.indexOf('--threads')).toBeLessThan(args.indexOf('in.png'))
  })

  it('emits no resize arguments for a texture that already fits and is block aligned', () => {
    const args = buildKtxCreateArgs(factsWith({}), 'in.png', 'out.ktx2')
    expect(args).not.toContain('--width')
    expect(args).not.toContain('--height')
  })

  it('emits no color space assignment for a texture without slots', () => {
    const args = buildKtxCreateArgs(factsWith({ slots: [], channels: 0 }), 'in.png', 'out.ktx2')
    expect(args).not.toContain('--assign-tf')
    expect(args).not.toContain('--assign-primaries')
    expect(args).toContain('R8G8B8_UNORM')
  })
})

describe('encodedFormat', () => {
  it('names the format the CLI names for every channel mask and color space', () => {
    const { R, G, B, A } = TextureChannel
    expect(encodedFormat(R, null)).toBe('R8_UNORM')
    expect(encodedFormat(G, null)).toBe('R8G8_UNORM')
    expect(encodedFormat(R | G, null)).toBe('R8G8_UNORM')
    expect(encodedFormat(G | B, null)).toBe('R8G8B8_UNORM')
    expect(encodedFormat(R | G | B, 'srgb')).toBe('R8G8B8_SRGB')
    expect(encodedFormat(R | G | B, null)).toBe('R8G8B8_UNORM')
    expect(encodedFormat(R | G | B | A, 'srgb')).toBe('R8G8B8A8_SRGB')
    expect(encodedFormat(R | G | B | A, null)).toBe('R8G8B8A8_UNORM')
  })
})

describe('encodedSize', () => {
  it('keeps a texture that fits and is a multiple of four', () => {
    expect(encodedSize([1024, 1024], 2048)).toEqual([1024, 1024])
    expect(encodedSize([2048, 2048], 2048)).toEqual([2048, 2048])
  })

  it('scales a texture down to fit the maximum, keeping the aspect', () => {
    expect(encodedSize([1024, 1024], 512)).toEqual([512, 512])
    expect(encodedSize([4096, 2048], 2048)).toEqual([2048, 1024])
  })

  it('rounds a size that is not a multiple of four up to the next one', () => {
    expect(encodedSize([1022, 1022], 2048)).toEqual([1024, 1024])
    expect(encodedSize([3, 3], 2048)).toEqual([4, 4])
  })
})
