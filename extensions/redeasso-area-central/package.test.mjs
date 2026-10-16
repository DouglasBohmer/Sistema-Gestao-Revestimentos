import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zip } from '../../scripts/package_area_central_extension.mjs'
test('ZIP contém entradas determinísticas e diretório central válido', () => {
  const files = [['manifest.json', Buffer.from('{"manifest_version":3}')], ['portal.js', Buffer.from('/* fictício */')]]
  const archive = zip(files)
  assert.deepEqual(archive, zip(files))
  assert.equal(archive.readUInt32LE(0), 0x04034b50)
  const end = archive.subarray(-22)
  assert.equal(end.readUInt32LE(0), 0x06054b50)
  assert.equal(end.readUInt16LE(8), files.length)
  assert.equal(archive.readUInt32LE(end.readUInt32LE(16)), 0x02014b50)
})
