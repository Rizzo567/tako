# Note implementazione

- Font Poppins/Staatliches/Amaranth/Italiana scaricati dalla fonte ufficiale google/fonts, dieci facce TTF con quattro licenze OFL, server e web locali senza CDN.
- Nuove opzioni persistite in JSON revisionato: nessuna migrazione distruttiva.
- Audit ha trovato footer48px con margine15px tagliato; renderer riserva altezza reale del footer.
- HACCP riferimento non scaricabile nel tentativo in sola lettura: non è stata inventata una certificazione.

- QA desktop ha rilevato preview cliente extra che sottraeva spazio al PDF: rimossa dalla sola scheda PDF, test SSR e screenshot verificati.
- Fallback visibili PDF allineati al renderer: opacità1, titoli categoriaheading-2, descrizione/legendafont-1.
