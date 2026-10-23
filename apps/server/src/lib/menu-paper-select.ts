/** Scelta leggera (nessuna dipendenza: si carica all'avvio delle route senza tirarsi dietro pdfkit). Vedi menu-paper-pdf.ts. */
type MenuLike={id:string;paper?:{templateUrl?:string|null}|null}
/** Il Menu usa un modello grafico? (campo facoltativo `paper.templateUrl`, immagine negli asset del locale). */
export const paperTemplateOf = (menu: { paper?: { templateUrl?: string | null } | null } | undefined | null) => menu?.paper?.templateUrl?.trim() || null
/** PDF da modello solo se TUTTI i Menu richiesti ne hanno uno (una pagina per Menu); altrimenti resta il PDF di prima. */
export function paperMenuIds(workspace: { menus: MenuLike[] }, menuIds: string[]): string[] | null {
  if (!menuIds.length) return null
  const menus = menuIds.map(id => workspace.menus.find(m => m.id === id))
  return menus.every(m => !!m && !!paperTemplateOf(m)) ? menuIds : null
}

