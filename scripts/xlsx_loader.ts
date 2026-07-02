// Minimal xlsx loader using openpyxl-equivalent in Bun.
// Bun doesn't ship with a Python xlsx parser, but we can use the `xlsx` npm package.
// This file exposes a single function: load_workbook(path) -> SheetObject
// where SheetObject is indexed by cell ref (e.g. wb['Sheet1']['A1'].v)

import * as XLSX from 'xlsx'
import * as fs from 'fs'

export interface Cell {
  v: any // raw value
  f?: string // formula (without leading '=')
  t?: string // cell type
}

export type Sheet = Record<string, Cell>
export type Workbook = Record<string, Sheet>

export function load_workbook(path: string): Workbook {
  const buf = fs.readFileSync(path)
  const wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  const out: Workbook = {}
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const sheet: Sheet = {}
    // Iterate over all cells in the sheet
    for (const ref of Object.keys(ws)) {
      if (ref === '!ref' || ref === '!margins' || ref.startsWith('!')) continue
      const cell = ws[ref]
      sheet[ref] = {
        v: cell.v,
        f: cell.f,
        t: cell.t,
      }
    }
    out[sheetName] = sheet
  }
  return out
}
