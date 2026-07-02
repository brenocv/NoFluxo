// Inspect "Contas casa" section (rows 33-47) and other rows I might have missed.
import { load_workbook } from '/home/z/my-project/scripts/xlsx_loader'

const wb = load_workbook('/home/z/my-project/upload/Porto 2026.xlsx')
const ws = wb['Despesas']

console.log('=== Contas casa section (rows 33-50) ===')
for (let r = 33; r <= 50; r++) {
  const c = ws[`C${r}`]
  const d = ws[`D${r}`]
  const e = ws[`E${r}`]
  const j = ws[`J${r}`]
  console.log(`R${r}: name="${c?.v ?? ''}" | Jan(D)=${d?.v ?? ''} | Fev(E)=${e?.v ?? ''} | Jul(J)=${j?.v ?? ''}`)
}

console.log()
console.log('=== All named rows 4-25 (Despesas + Rendimentos BRL) ===')
for (let r = 4; r <= 26; r++) {
  const c = ws[`C${r}`]
  if (c && c.v) {
    const d = ws[`D${r}`]
    const j = ws[`J${r}`]
    console.log(`R${r}: "${c.v}" | Jan=${d?.v ?? '-'} | Jul=${j?.v ?? '-'}`)
  }
}
