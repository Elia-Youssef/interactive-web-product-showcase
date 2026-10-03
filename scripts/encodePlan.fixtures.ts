// The encode plan table for the pipeline test: one texture per class the
// pipeline can meet, with the exact plan entry the pipeline must build for
// it. The occlusion override is set to 512 by the test, so the claiming
// stage is visible in the size: a texture the data or color stage claims is
// encoded at 2048, one the occlusion stage claims at 512.
import { TextureChannel } from '@gltf-transform/core'
import type { EncodePlanEntry } from './ktx2Plan.ts'
import type { TextureFixture } from './texture.fixtures.ts'

// The exact ktx arguments of one planned encode, written as the command
// line it spawns: the arguments contain no spaces, so splitting on spaces
// is the exact argument list.
const ktx = (line: string): string[] => line.split(' ')

export type PlanTableRow = {
  name: string
  def: TextureFixture
  entry: EncodePlanEntry
}

export const PLAN_TABLE: readonly PlanTableRow[] = [
  {
    name: 'opaque base color is ETC1S at the maximum in sRGB without alpha',
    def: { name: 'opaque-color', slots: ['baseColorTexture'] },
    entry: {
      textureIndex: 0,
      label: 'opaque-color',
      stage: 'color',
      mode: 'etc1s',
      sizeRule: 'textureMaxSize',
      maxSize: 2048,
      colorSpace: 'srgb',
      channels: TextureChannel.R | TextureChannel.G | TextureChannel.B,
      srcSize: [1024, 1024],
      slots: ['baseColorTexture'],
      sourceName: '0.png',
      targetName: '0.ktx2',
      arguments: ktx(
        'create --generate-mipmap --encode basis-lz --qlevel 255 --assign-tf srgb --assign-primaries bt709 --format R8G8B8_SRGB --threads 1 0.png 0.ktx2',
      ),
    },
  },
  {
    name: 'blended base color keeps alpha in the format',
    def: { name: 'blended-color', slots: ['baseColorTexture'], alphaMode: 'BLEND' },
    entry: {
      textureIndex: 1,
      label: 'blended-color',
      stage: 'color',
      mode: 'etc1s',
      sizeRule: 'textureMaxSize',
      maxSize: 2048,
      colorSpace: 'srgb',
      channels: TextureChannel.R | TextureChannel.G | TextureChannel.B | TextureChannel.A,
      srcSize: [1024, 1024],
      slots: ['baseColorTexture'],
      sourceName: '1.png',
      targetName: '1.ktx2',
      arguments: ktx(
        'create --generate-mipmap --encode basis-lz --qlevel 255 --assign-tf srgb --assign-primaries bt709 --format R8G8B8A8_SRGB --threads 1 1.png 1.ktx2',
      ),
    },
  },
  {
    name: 'a normal map is UASTC at the maximum without RDO',
    def: { name: 'normal-map', slots: ['normalTexture'] },
    entry: {
      textureIndex: 2,
      label: 'normal-map',
      stage: 'data',
      mode: 'uastc',
      sizeRule: 'textureMaxSize',
      maxSize: 2048,
      colorSpace: null,
      channels: TextureChannel.R | TextureChannel.G | TextureChannel.B,
      srcSize: [1024, 1024],
      slots: ['normalTexture'],
      sourceName: '2.png',
      targetName: '2.ktx2',
      arguments: ktx(
        'create --generate-mipmap --encode uastc --uastc-quality 4 --zstd 18 --assign-tf linear --assign-primaries none --format R8G8B8_UNORM --threads 1 2.png 2.ktx2',
      ),
    },
  },
  {
    name: 'an ORM texture is claimed by the data stage at the maximum, not the override',
    def: { name: 'packed-orm', slots: ['occlusionTexture', 'metallicRoughnessTexture'] },
    entry: {
      textureIndex: 3,
      label: 'packed-orm',
      stage: 'data',
      mode: 'uastc',
      sizeRule: 'textureMaxSize',
      maxSize: 2048,
      colorSpace: null,
      channels: TextureChannel.R | TextureChannel.G | TextureChannel.B,
      srcSize: [1024, 1024],
      slots: ['occlusionTexture', 'metallicRoughnessTexture'],
      sourceName: '3.png',
      targetName: '3.ktx2',
      arguments: ktx(
        'create --generate-mipmap --encode uastc --uastc-quality 4 --uastc-rdo --uastc-rdo-l 4 --uastc-rdo-m --zstd 18 --assign-tf linear --assign-primaries none --format R8G8B8_UNORM --threads 1 3.png 3.ktx2',
      ),
    },
  },
  {
    name: 'an occlusion-only texture is UASTC at the occlusion override',
    def: { name: 'ao-only', slots: ['occlusionTexture'] },
    entry: {
      textureIndex: 4,
      label: 'ao-only',
      stage: 'occlusion',
      mode: 'uastc',
      sizeRule: 'occlusionTextureMaxSize',
      maxSize: 512,
      colorSpace: null,
      channels: TextureChannel.R,
      srcSize: [1024, 1024],
      slots: ['occlusionTexture'],
      sourceName: '4.png',
      targetName: '4.ktx2',
      arguments: ktx(
        'create --generate-mipmap --encode uastc --uastc-quality 4 --uastc-rdo --uastc-rdo-l 4 --uastc-rdo-m --zstd 18 --assign-tf linear --assign-primaries none --format R8_UNORM --width 512 --height 512 --threads 1 4.png 4.ktx2',
      ),
    },
  },
  {
    name: 'an emissive texture is ETC1S color in sRGB',
    def: { name: 'emissive-map', slots: ['emissiveTexture'] },
    entry: {
      textureIndex: 5,
      label: 'emissive-map',
      stage: 'color',
      mode: 'etc1s',
      sizeRule: 'textureMaxSize',
      maxSize: 2048,
      colorSpace: 'srgb',
      channels: TextureChannel.R | TextureChannel.G | TextureChannel.B,
      srcSize: [1024, 1024],
      slots: ['emissiveTexture'],
      sourceName: '5.png',
      targetName: '5.ktx2',
      arguments: ktx(
        'create --generate-mipmap --encode basis-lz --qlevel 255 --assign-tf srgb --assign-primaries bt709 --format R8G8B8_SRGB --threads 1 5.png 5.ktx2',
      ),
    },
  },
  {
    name: 'a clearcoat normal texture is claimed by the data stage without RDO',
    def: { name: 'clearcoat-normal', slots: ['clearcoatNormalTexture'] },
    entry: {
      textureIndex: 6,
      label: 'clearcoat-normal',
      stage: 'data',
      mode: 'uastc',
      sizeRule: 'textureMaxSize',
      maxSize: 2048,
      colorSpace: null,
      channels: TextureChannel.R | TextureChannel.G | TextureChannel.B,
      srcSize: [1024, 1024],
      slots: ['clearcoatNormalTexture'],
      sourceName: '6.png',
      targetName: '6.ktx2',
      arguments: ktx(
        'create --generate-mipmap --encode uastc --uastc-quality 4 --zstd 18 --assign-tf linear --assign-primaries none --format R8G8B8_UNORM --threads 1 6.png 6.ktx2',
      ),
    },
  },
  {
    name: 'a texture shared by occlusion and a color slot is UASTC at the occlusion override',
    def: { name: 'shared-ao-color', slots: ['occlusionTexture', 'baseColorTexture'] },
    entry: {
      textureIndex: 7,
      label: 'shared-ao-color',
      stage: 'occlusion',
      mode: 'uastc',
      sizeRule: 'occlusionTextureMaxSize',
      maxSize: 512,
      colorSpace: 'srgb',
      channels: TextureChannel.R | TextureChannel.G | TextureChannel.B,
      srcSize: [1024, 1024],
      slots: ['occlusionTexture', 'baseColorTexture'],
      sourceName: '7.png',
      targetName: '7.ktx2',
      arguments: ktx(
        'create --generate-mipmap --encode uastc --uastc-quality 4 --uastc-rdo --uastc-rdo-l 4 --uastc-rdo-m --zstd 18 --assign-tf srgb --assign-primaries bt709 --format R8G8B8_SRGB --width 512 --height 512 --threads 1 7.png 7.ktx2',
      ),
    },
  },
]
