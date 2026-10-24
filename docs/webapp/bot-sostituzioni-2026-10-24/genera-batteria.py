#!/usr/bin/env python3
"""Batteria avversaria «stile Luisa» 24/10 (sostituzioni, conferme, refusi del Menu, pronomi, omonimi).
Scrive casi-now.json (fixture = menu di Victoria alle 18:11 del 24/10) e casi-base.json (Menu Giorno com'era la mattina).
Attese: `final` = sottomenu toccati -> piatti attesi (insieme, nomi normalizzati); tutto il resto deve restare identico.
`alt` = altri esiti accettabili (lista di final, {} = nessuna scrittura). `noAsk` = turni in cui il bot NON deve fare domande.
`forbid` = testi vietati nelle risposte. Uso: python3 genera-batteria.py [--seed N] [--set nuove]"""
import json, random, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
MGP = ['Lasagna', 'Strozzapreti con zola e pistacchio', 'Orecchiette con zucca']
MGS = ['Cotoletta', 'Arrosto']
MGC = ['Patate al forno', 'Spinaci']
MCP = ['tagliatelle vongole totano zucchine e pomodorini', 'tortiglioni alla norma con ricotta salata', 'linguine alla carbonara']
MCS = ['branzino al forno', 'scaloppine al vino bianco', 'pollo al forno']
MCC = ['Patate al forno', 'Insalata mista', 'melanzana al forno', 'insalata verde', 'patate al forno']
K = {'MGP': 'Menu Giorno›Primi', 'MGS': 'Menu Giorno›Secondi', 'MGC': 'Menu Giorno›Contorni', 'MCP': 'Menu Cena›Primi', 'MCS': 'Menu Cena›Secondi', 'MCC': 'Menu Cena›Contorni'}
CUR = {'MGP': MGP, 'MGS': MGS, 'MGC': MGC, 'MCP': MCP, 'MCS': MCS, 'MCC': MCC}
now, base = [], []
_fx = json.load(open(os.path.join(HERE, 'fixture-base.json')))
CARTA_PRIMI_PESTO9 = [i['name'] + ' ' + ('9' if i['name'] == 'Pasta al pesto' else ('%g' % i['price'])) for m in _fx['menus'] if m['name'] == 'Alla carta' for s in m['sections'] if s['name'] == 'Primi piatti' for i in s['items'] if not i.get('hidden')]
def case(lst, cid, turns, final=None, alt=None, noAsk=None, forbid=None, note=''):
    lst.append({'id': cid, 'turns': turns, 'expect': {'final': final or {}, 'alt': alt or [], 'noAsk': noAsk if noAsk is not None else [], 'forbid': forbid or []}, 'note': note})
def sub(key, out, add):
    cur = [x for x in CUR[key] if x.lower() not in [o.lower() for o in out]]
    return {K[key]: cur + add}

nuove = '--set' in sys.argv and sys.argv[sys.argv.index('--set') + 1] == 'nuove'
if not nuove:
    # ---------- S: sostituzioni in una frase (prefissi del Menu con refusi) ----------
    FR = ['togli {x} metti {y}', 'togli {x} e metti {y}', 'al posto della {x} metti {y}', 'invece della {x} metti {y}', 'cambia {x} con {y}',
          'sostituisci {x} con {y}', '{x} no metti {y}', 'leva {x} e metti {y}', 'via {x} metti {y}', 'togli {x} e al suo posto metti {y}',
          'togli {x}  metti {y}', 'Togli {x}. Metti {y}.', 'invece di {x} fai {y}', 'al posto di {x} {y}', 'cambia {x} in {y}']
    PRE_G = ['', 'menu mezzogirno ', 'x pranzo ', 'nel menù giorno ', 'pranzzo ', 'da 12 ', 'a pranzo ', 'menu giorno ', 'Menù mezzogiorno da 12 euro ', 'nel pranzo ']
    PRE_C = ['stasera ', 'cena ', 'nel menu cena ', 'x stasera ', 'menu sera ', 'cena stasera ']
    T = [('MGP', 'lasagna', 'Lasagna', 'rigatoni', 'Rigatoni'), ('MGP', 'orecchiette con zucca', 'Orecchiette con zucca', 'gnocchi al pomodoro', 'Gnocchi al pomodoro'),
         ('MGS', 'cotoletta', 'Cotoletta', 'polpette', 'Polpette'), ('MGS', 'arrosto', 'Arrosto', 'scaloppine al limone', 'Scaloppine al limone'),
         ('MGC', 'spinaci', 'Spinaci', 'insalata', 'Insalata'), ('MGP', 'strozzapreti', 'Strozzapreti con zola e pistacchio', 'pasta e fagioli', 'Pasta e fagioli')]
    TC = [('MCS', 'pollo al forno', 'pollo al forno', 'salsiccia alla griglia', 'Salsiccia alla griglia'), ('MCP', 'linguine alla carbonara', 'linguine alla carbonara', 'spaghetti alla puttanesca', 'Spaghetti alla puttanesca'),
          ('MCC', 'melanzana al forno', 'melanzana al forno', 'zucchine trifolate', 'Zucchine trifolate')]
    rnd = random.Random(1024); n = 0
    for (k, x, xn, y, yn) in T:
        for i in range(8):
            fr = FR[(n + i * 3) % len(FR)]; pre = PRE_G[(n * 7 + i) % len(PRE_G)]; n += 1
            case(now, f'sost-{n:03d}', [pre + fr.format(x=x, y=y)], sub(k, [xn], [yn]), noAsk=[0], note='sostituzione in una frase')
    for (k, x, xn, y, yn) in TC:
        for i in range(5):
            fr = FR[(n + i * 5) % len(FR)]; pre = PRE_C[(n + i) % len(PRE_C)]; n += 1
            case(now, f'sost-{n:03d}', [pre + fr.format(x=x, y=y)], sub(k, [xn], [yn]), noAsk=[0], note='sostituzione cena')
    # vocali trascritti
    V = ['allora ehm nel menu del giorno togli la lasagna e metti i rigatoni all amatriciana', 'allora oggi a pranzo al posto della cotoletta mettiamo le polpette al sugo',
         'ehm allora stasera togli il pollo al forno e metti la salsiccia alla griglia', 'allora nel menu di mezzogiorno invece degli spinaci metti la cicoria ripassata']
    VF = [sub('MGP', ['Lasagna'], ['Rigatoni all amatriciana']), sub('MGS', ['Cotoletta'], ['Polpette al sugo']), sub('MCS', ['pollo al forno'], ['Salsiccia alla griglia']), sub('MGC', ['Spinaci'], ['Cicoria ripassata'])]
    for i, (v, f) in enumerate(zip(V, VF)):
        case(now, f'voce-{i+1:03d}', [{'voice': v}], f, noAsk=[0], note='vocale con allora/ehm')
    # doppie sostituzioni e multi-operazione
    case(now, 'multi-001', ['menu giorno togli lasagna e orecchiette metti rigatoni e gnocchi'], sub('MGP', ['Lasagna', 'Orecchiette con zucca'], ['Rigatoni', 'Gnocchi']), noAsk=[0])
    case(now, 'multi-002', ['togli la lasagna metti rigatoni e la cotoletta è finita'], {**sub('MGP', ['Lasagna'], ['Rigatoni']), K['MGS']: ['Cotoletta (finito)', 'Arrosto']}, noAsk=[0])
    case(now, 'multi-003', ['togli lasagna e spinaci'], {**sub('MGP', ['Lasagna'], []), **sub('MGC', ['Spinaci'], [])}, noAsk=[0])
    case(now, 'multi-004', ['la cotoletta è finita e togli gli spinaci'], {K['MGS']: ['Cotoletta (finito)', 'Arrosto'], **sub('MGC', ['Spinaci'], [])}, noAsk=[0])
    case(now, 'multi-005', ['nei primi del pranzo togli lasagna e orecchiette e aggiungi gnocchi'], sub('MGP', ['Lasagna', 'Orecchiette con zucca'], ['Gnocchi']), noAsk=[0])
    case(now, 'multi-006', ['togli la lasagna aggiungi rigatoni e l arrosto è finito'], {**sub('MGP', ['Lasagna'], ['Rigatoni']), K['MGS']: ['Cotoletta', 'Arrosto (finito)']}, noAsk=[0])
    case(now, 'multi-007', ['x pranzo togli cotoletta metti polpette  contorni togli spinaci metti fagiolini'], {**sub('MGS', ['Cotoletta'], ['Polpette']), **sub('MGC', ['Spinaci'], ['Fagiolini'])}, noAsk=[0])
    case(now, 'multi-008', ['pranzo: lasagna finita, nei secondi aggiungi polpette'], {K['MGP']: ['Lasagna (finito)', MGP[1], MGP[2]], K['MGS']: MGS + ['Polpette']}, noAsk=[0])
    # correzioni e annulla dopo la sostituzione
    case(now, 'corr-001', ['togli lasagna metti rigatoni', 'annulla'], {}, noAsk=[0, 1])
    case(now, 'corr-002', ['togli lasagna metti rigatoni', 'no scusa al posto dei rigatoni metti i paccheri'], sub('MGP', ['Lasagna'], ['Paccheri']), noAsk=[0, 1])
    case(now, 'corr-003', ['al posto della cotoletta metti polpette', 'i rigatoni... no scusa, le polpette sono finite'], {K['MGS']: ['Arrosto', 'Polpette (finito)']}, noAsk=[0])
    case(now, 'corr-004', ['togli lasagna metti rigatoni', 'rimetti la lasagna'], sub('MGP', [], ['Rigatoni']), noAsk=[0], note='lasagna ripristinata, rigatoni restano')
    # ---------- C: risposte sì/ok/esatto/1 a una domanda del bot ----------
    YES = ['si', 'sì', 'ok sì', 'esatto', 'si si', 'Si', 'ok', 'sì grazie']
    for i, y in enumerate(YES):
        case(now, f'si-elim-{i+1:03d}', ['elimina la lasagna', y], sub('MGP', ['Lasagna'], []), note='«elimina» chiede sì: il sì esegue')
    for i, y in enumerate(YES[:5]):
        case(now, f'si-refuso-{i+1:03d}', ['togli le orechiete', y], sub('MGP', ['Orecchiette con zucca'], []), note='refuso: subito o domanda + sì')
    for i, y in enumerate(YES[:4]):
        case(now, f'si-lista-{i+1:03d}', ['nei secondi del pranzo metti salsiccia alla griglia  funghi misti e peperoni', y], {K['MGS']: MGS + ['Salsiccia alla griglia', 'Funghi misti', 'Peperoni']}, note='proposta «Ho capito così»')
    for i, y in enumerate(YES[:4]):
        case(now, f'si-finito-{i+1:03d}', ['la lasagnia è finita', y], {K['MGP']: ['Lasagna (finito)', MGP[1], MGP[2]]})
    case(now, 'si-sost-001', ['togli la lasagnia metti i rigatoni', 'si'], sub('MGP', ['Lasagna'], ['Rigatoni']), note='refuso nella sostituzione: anche con domanda il sì esegue tutto')
    case(now, 'si-sost-002', ['al posto delle orechiette metti gnocchi', 'sì'], sub('MGP', ['Orecchiette con zucca'], ['Gnocchi']))
    case(now, 'si-sost-003', ['togli la coteletta metti le polpette', 'esatto'], sub('MGS', ['Cotoletta'], ['Polpette']))
    case(now, 'si-sost-004', ['cambia gli spinacci con la cicoria', 'ok sì'], sub('MGC', ['Spinaci'], ['Cicoria']))
    case(now, 'si-sost-005', ['menu mezzogirno togli lasagnia metti rigatoni', 'si'], sub('MGP', ['Lasagna'], ['Rigatoni']))
    # ---------- prezzo fisso: «mettila a 5 euro» ----------
    case(now, 'fisso-001', ['la cotoletta mettila a 5 euro'], {}, alt=[], forbid=['A quale piatto metto'], note='piatto di Menu a prezzo fisso: niente prezzo, spiegalo')
    case(now, 'fisso-002', ['la cotoletta è finita', 'mettila a 5 euro'], {K['MGS']: ['Cotoletta (finito)', 'Arrosto']}, forbid=['A quale piatto metto'])
    case(now, 'fisso-003', ['nei primi del pranzo aggiungi rigatoni', 'mettili a 8'], sub('MGP', [], ['Rigatoni']), forbid=['A quale piatto metto'])
    case(now, 'fisso-004', ['la lasagna costa 7'], {}, forbid=['A quale piatto metto'])
    case(now, 'fisso-005', ['il completo del pranzo a 13'], {'Menu Giorno›opzione Completo': ['13']}, noAsk=[0])
    # ---------- piatti che non esistono: niente proposte che non somigliano ----------
    for i, t in enumerate(['porta il tiramisu a 6 euro', 'togli il tiramisù', 'il tiramisu è finito', 'la panna cotta a 5', 'togli la carbonara dal pranzo']):
        case(now, f'nonce-{i+1:03d}', [t], {}, forbid=['Pirata', 'Turbolenti', 'Paoletta'], note='piatto inesistente: niente nome che non somiglia')
    # ---------- pronomi e piatti appena toccati/creati ----------
    case(now, 'pron-001', ['la lasagna è finita', 'rimettila'], {}, noAsk=[0, 1])
    case(now, 'pron-002', ['la lasagna è finita', 'no scusa toglila proprio'], sub('MGP', ['Lasagna'], []), noAsk=[0])
    case(now, 'pron-003', ['nei primi del pranzo aggiungi carbonara', 'toglila'], {}, noAsk=[0, 1])
    case(now, 'pron-004', ['togli la lasagna', 'rimettila'], {}, noAsk=[0, 1])
    case(now, 'pron-005', ['la cotoletta è finita', 'anche l arrosto'], {K['MGS']: ['Cotoletta (finito)', 'Arrosto (finito)']}, noAsk=[0, 1])
    case(now, 'pron-006', ['togli gli spinaci', 'rimettili'], {}, noAsk=[0, 1])
    case(now, 'pron-007', ['nei primi del pranzo aggiungi rigatoni al sugo', 'i rigatoni sono finiti'], {K['MGP']: MGP + ['Rigatoni al sugo (finito)']}, noAsk=[0, 1])
    case(now, 'pron-008', ['nei secondi del pranzo aggiungi polpette', 'togli le polpette metti le salsicce'], {K['MGS']: MGS + ['Salsicce']}, alt=[{K['MGS']: MGS + ['Salsiccia']}], noAsk=[0, 1], note='«salsicce» → «Salsiccia» (correzione d ortografia verso il lessico): MINORE')
    case(now, 'pron-009', ['nei primi del pranzo aggiungi rigatoni', 'anzi no toglili'], {}, noAsk=[0, 1])
    case(now, 'pron-010', ['la lasagna è finita', 'e anche le orecchiette'], {K['MGP']: ['Lasagna (finito)', MGP[1], 'Orecchiette con zucca (finito)']}, noAsk=[0, 1])
    # ---------- refusi del Menu + inserimento ----------
    R = [('menu mezzogirno nei primi aggiungi rigatoni', sub('MGP', [], ['Rigatoni'])), ('pranzzo aggiungi nei secondi polpette', sub('MGS', [], ['Polpette'])),
         ('menù giorno nei contorni metti insalata', sub('MGC', [], ['Insalata'])), ('cena stasera nei contorni aggiungi zucchine trifolate', sub('MCC', [], ['Zucchine trifolate'])),
         ('aggiungi nei contorni della cena le zucchine trifolate', sub('MCC', [], ['Zucchine trifolate'])), ('da 12 nei secondi metti polpette al sugo', sub('MGS', [], ['Polpette al sugo'])),
         ('nel menu di mezzogiorno nei primi aggiungi pasta e ceci', sub('MGP', [], ['Pasta e ceci'])), ('x mezzogiorno nei contorni aggiungi patate fritte', sub('MGC', [], ['Patate fritte'])),
         ('aggiungi nei primi della cena gli gnocchi al ragù', sub('MCP', [], ['Gnocchi al ragù'])), ('nei secondi della sera metti la tagliata', sub('MCS', [], ['Tagliata']))]
    for i, (t, f) in enumerate(R):
        case(now, f'refuso-{i+1:03d}', [t], f, noAsk=[0], forbid=['*Della*', '*Allora*'])
    for i, (v, f) in enumerate([('allora nei primi oggi mettiamo anche la pasta alla norma', sub('MGP', [], ['Pasta alla norma'])), ('ehm allora nel menu del giorno nei secondi aggiungi le polpette', sub('MGS', [], ['Polpette'])),
                                ('allora per stasera nei contorni aggiungi le zucchine', sub('MCC', [], ['Zucchine']))]):
        case(now, f'voce-ins-{i+1:03d}', [{'voice': v}], f, alt=[{}] if i == 0 else None, noAsk=[] if i == 0 else [0], forbid=['*Allora*', '*Ehm*'])
    # ---------- negazioni / domande: nessuna scrittura ----------
    for i, t in enumerate(['non togliere la lasagna', 'la lasagna resta', 'quanto costa il menu del giorno', 'cosa c è nei primi a pranzo', 'nn togliere niente oggi']):
        case(now, f'neg-{i+1:03d}', [t], {}, note='nessuna scrittura')
    # ---------- omonimi tra Menu (fixture base: Pasta al pesto e linguine allo scoglio anche alla carta) ----------
    case(base, 'omon-001', ['nel menu giorno togli pasta al pesto metti pasta al ragù'], {K['MGP']: ['linguine allo scoglio', 'Rigatoni al sugo', 'Pasta al ragù']}, noAsk=[0])
    case(base, 'omon-002', ['pranzo togli linguine allo scoglio metti spaghetti alle vongole'], {K['MGP']: ['Pasta al pesto', 'Rigatoni al sugo', 'Spaghetti alle vongole']}, noAsk=[0])
    case(base, 'omon-003', ['togli la pasta al pesto metti trofie al pesto'], {K['MGP']: ['linguine allo scoglio', 'Rigatoni al sugo', 'Trofie al pesto']}, alt=[{}], note='senza Menu: Menu Giorno o domanda; alla carta mai')
    case(base, 'omon-004', ['al posto delle linguine allo scoglio metti spaghetti alle vongole'], {K['MGP']: ['Pasta al pesto', 'Rigatoni al sugo', 'Spaghetti alle vongole']}, alt=[{}])
    case(base, 'omon-005', ['la pasta al pesto del pranzo è finita'], {K['MGP']: ['Pasta al pesto (finito)', 'linguine allo scoglio', 'Rigatoni al sugo']}, noAsk=[0])
    case(base, 'omon-006', ['a pranzo togli la pasta al pesto'], {K['MGP']: ['linguine allo scoglio', 'Rigatoni al sugo']}, noAsk=[0])
    case(base, 'omon-007', ['la pasta al pesto alla carta mettila a 9'], {'Alla carta›Primi piatti': CARTA_PRIMI_PESTO9}, noAsk=[0], note='solo prezzo alla carta')
    case(base, 'omon-008', ['menu mezzogirno togli rigatoni al sugo metti lasagna'], {K['MGP']: ['Pasta al pesto', 'linguine allo scoglio', 'Lasagna']}, noAsk=[0])
    case(base, 'omon-009', ['nel pranzo togli l insalata metti spinaci'], {K['MGC']: ['Funghi misti', 'Peperoni', 'Spinaci']}, noAsk=[0], note='Insalata anche alla carta e in cena (mista/verde)')
    case(base, 'omon-010', ['menu giorno togli peperoni metti melanzane'], {K['MGC']: ['Insalata', 'Funghi misti', 'Melanzane']}, noAsk=[0])
    out = [('casi-now.json', now), ('casi-base.json', base)]
else:
    out = []
for f, l in out:
    json.dump(l, open(os.path.join(HERE, f), 'w'), ensure_ascii=False, indent=1)
print({f: len(l) for f, l in out}, 'totale', sum(len(l) for _, l in out))
