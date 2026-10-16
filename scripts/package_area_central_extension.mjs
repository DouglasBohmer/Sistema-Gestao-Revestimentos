import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// ZIP sem compressão, determinístico e sem dependências extras. Só fontes auditáveis.
export function zip(entries) {
  const local = [], central = []
  let offset = 0
  for (const [name, data] of entries) {
    const filename = Buffer.from(name)
    let crc = 0xffffffff
    for (const byte of data) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    crc = (crc ^ 0xffffffff) >>> 0
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0x800, 6); header.writeUInt16LE(33, 12)
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18)
    header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26)
    local.push(header, filename, data)
    const directory = Buffer.alloc(46)
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6)
    directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(33, 14)
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24)
    directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42)
    central.push(directory, filename)
    offset += header.length + filename.length + data.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directory, end])
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = ['manifest.json', 'background.js', 'protocol.js', 'app-bridge.js', 'portal.js']
  const entries = await Promise.all(files.map(async name => [name, await readFile(new URL(`../extensions/redeasso-area-central/${name}`, import.meta.url))]))
  const directory = new URL('../frontend-gestao-revestimento/public/extensions/', import.meta.url)
  await mkdir(directory, { recursive: true })
  await writeFile(new URL('redeasso-area-central.zip', directory), zip(entries))
  console.log('Extensão RedeASSO empacotada para download no Cloudflare.')
}
