import { customType } from 'drizzle-orm/pg-core'

// Tipo soldi: in DB è numeric(10,2) (centesimi esatti, niente errori float di `real`),
// ma in JS resta un `number` — così tutta l'aritmetica esistente continua a funzionare
// senza modifiche. Postgres restituisce numeric come stringa: la convertiamo qui.
export const money = customType<{ data: number; driverData: string }>({
  dataType() {
    return 'numeric(10, 2)'
  },
  toDriver(value: number): string {
    return value.toString()
  },
  fromDriver(value: string): number {
    return parseFloat(value)
  },
})
