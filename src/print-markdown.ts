import {formatFileSizeIEC} from './file-sizes'
import type {AssetDiff, WebpackStatsDiff} from './types'

function conditionalPercentage(number: number): string {
  if ([Infinity, -Infinity].includes(number)) {
    return '-'
  }

  const absValue = Math.abs(number)

  if ([0, 100].includes(absValue)) {
    return `${number}%`
  }

  const value = [0, 100].includes(absValue) ? absValue : absValue.toFixed(2)

  return `${signFor(number)}${value}%`
}

function capitalize(text: string): string {
  return `${text[0].toUpperCase()}${text.slice(1)}`
}

function makeHeader(columns: readonly string[]): string {
  return `${columns.join(' | ')}
${columns
  .map(x =>
    Array.from(new Array(x.length))
      .map(() => '-')
      .join('')
  )
  .join(' | ')}`
}

const TOTAL_HEADERS = makeHeader([
  'Files count',
  'Type',
  'Total bundle size',
  '% Changed'
])
const TABLE_HEADERS = makeHeader(['Asset', 'Type', 'File Size', '% Changed'])

function signFor(num: number): '' | '+' | '-' {
  if (num === 0) return ''
  return num > 0 ? '+' : '-'
}

function toFileSizeDiff(
  oldSize: number | null,
  newSize: number | null,
  diff?: number | undefined
): string {
  const diffLine = [
    `${formatFileSizeIEC(oldSize)} -> ${formatFileSizeIEC(newSize)}`
  ]
  if (typeof diff !== 'undefined') {
    diffLine.push(`(${signFor(diff)}${formatFileSizeIEC(diff)})`)
  }
  return diffLine.join(' ')
}

function toFileSizeDiffCell(asset: AssetDiff): string {
  const lines = []
  if (asset.diff === 0) {
    lines.push(formatFileSizeIEC(asset.new.size))
    if (asset.new.gzipSize) {
      lines.push(formatFileSizeIEC(asset.new.gzipSize))
    }
  } else {
    lines.push(toFileSizeDiff(asset.old.size, asset.new.size, asset.diff))
    if (asset.old.gzipSize || asset.new.gzipSize) {
      lines.push(toFileSizeDiff(asset.old.gzipSize, asset.new.gzipSize))
    }
  }

  return lines.join('<br />')
}

function printAssetTableRow(asset: AssetDiff): string {
  return [
    asset.name,
    asset.old.gzipSize || asset.new.gzipSize ? 'bundled<br />gzip' : 'bundled',
    toFileSizeDiffCell(asset),
    conditionalPercentage(asset.diffPercentage)
  ].join(' | ')
}

export function printAssetTablesByGroup(
  statsDiff: Omit<WebpackStatsDiff, 'total'>
): string {
  const statsFields = [
    'added',
    'removed',
    'bigger',
    'smaller',
    'unchanged'
  ] as const
  return statsFields
    .map(field => {
      const assets = statsDiff[field]
      if (assets.length === 0) {
        return `**${capitalize(field)}**

No assets were ${field}`
      }

      return `**${capitalize(field)}**

${TABLE_HEADERS}
${assets
  .map(asset => {
    return printAssetTableRow(asset)
  })
  .join('\n')}`
    })
    .join('\n\n')
}

const CHUNK_TABLE_HEADERS = makeHeader(['File', 'Δ'])

function printChunkModuleRow(chunkModule: AssetDiff): string {
  const emoji =
    chunkModule.diffPercentage === Infinity
      ? '🆕'
      : chunkModule.diffPercentage <= -100
      ? '🔥'
      : chunkModule.diffPercentage > 0
      ? '📈'
      : chunkModule.diffPercentage < 0
      ? '📉'
      : ' '

  let chunkName = chunkModule.name
  if (chunkName.startsWith('./')) {
    chunkName = chunkName.substring(2)
  } else if (chunkName.startsWith('/')) {
    chunkName = chunkName.substring(1)
  }

  return [
    `${emoji} \`${chunkName}\``,
    `<details><summary>${chunkModule.diff >= 0 ? '+' : '-'}${formatFileSizeIEC(
      chunkModule.diff
    )}${
      Number.isFinite(chunkModule.diffPercentage)
        ? ` (${conditionalPercentage(chunkModule.diffPercentage)})`
        : ''
    }</summary>

    Old size: ${formatFileSizeIEC(chunkModule.old.size)}
    New size: ${formatFileSizeIEC(chunkModule.new.size)}
    </details>`
  ].join(' | ')
}

export function printChunkModulesTable(
  statsDiff: Omit<WebpackStatsDiff, 'total' | 'unchanged'> | null
): string {
  if (!statsDiff) return ''
  const changedModules = [
    ...statsDiff.added,
    ...statsDiff.removed,
    ...statsDiff.bigger,
    ...statsDiff.smaller
  ]

  if (changedModules.length === 0) {
    return `
**Changeset**

No files were changed`
  }

  const modulesBySizeDescending = changedModules.sort(
    (a, b) => b.diffPercentage - a.diffPercentage
  )

  return `
**Changeset**

${CHUNK_TABLE_HEADERS}
${modulesBySizeDescending
  .map(chunkModule => printChunkModuleRow(chunkModule))
  .join('\n')}`
}

export function printTotalAssetTable(
  statsDiff: Pick<WebpackStatsDiff, 'total'>
): string {
  return `**Total**

${TOTAL_HEADERS}
${printAssetTableRow(statsDiff.total)}`
}
