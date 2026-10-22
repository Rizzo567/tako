# Misure e parametri — gesto iPhone

Fonte: riferimento-iphone-sposta-app.mp4, 1290 × 2796, durata 7,4567 s. Il container dichiara 120 fps; i timestamp utili sono variabili, spesso distanziati di 16,7 ms. Analizzati fotogrammi iniziali, trascinamento, rilascio e Fine. Valori ottici stimati, non misure dei sensori del dito.

- Pressione lunga: **1.000 ms** per requisito. Il video comincia con il contatto già iniziato: il ritardo totale non si può ricavare in modo affidabile. La modalità appare intorno a 517 ms dall’inizio della registrazione.
- Scala sollevata: **1,10×**; il preview iniziale arriva circa a 1,12×. Il modulo usa 1,10× per il sollevamento, senza menu contestuale.
- Tremolio: **±1,8°**, periodo **255 ms**, fasi deterministiche diverse per id (hash con avalanche). Sulle card larghe l’angolo è limitato per mantenere l’escursione dell’angolo entro circa **1,9 px**, evitando grandi sventolamenti dei blocchi. Nessun badge meno.
- Traslazione verticale: **±0,4 px CSS**, sinusoidale con fase diversa dalla rotazione. L’elemento trascinato non trema; riprende il tremolio dopo circa 50 ms dal rilascio mentre si assesta.
- Molla di scansamento e rilascio: massa **1**, rigidità **361**, smorzamento **38** (critico, omega **19 s⁻¹**). Per spostamenti dell’ordine di 100 px si avvicina allo slot in circa **350–400 ms**. Il calcolo analitico mantiene posizione e velocità correnti al retargeting. Il video non mostra altre icone che si scansano: questa parte è una scelta di implementazione, non una misura ricavabile dal riferimento.
- Sollevamento: molla critica omega **28 s⁻¹**, rigidità **784**, smorzamento **56**.
- Fine: ritorno dell’angolo corrente a zero in **90 ms**.
- Tolleranza prima del trascinamento: **8 px**. Prima del long press lo scroll nativo resta libero; lo scroll/pointercancel annulla l’attesa.
- Auto-scroll: bordo sensibile **52 px**, velocità massima **750 px/s**, applicata dal contenitore più interno che può scorrere.

È una riproduzione tarata sul riferimento, non una certificazione di identità pixel per pixel con UIKit. La verifica su iPhone fisico, soprattutto del primo long press durante lo scroll Safari, resta da fare sul dispositivo.
