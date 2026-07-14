# Setup collaudo Tako nella VM Windows — passi per Manuel

Prerequisiti già fatti per HearFlow (se la VM è la stessa, salta al punto 2):
Node, Git, GitHub CLI, Claude Code, `gh auth login`.

## 1. Prerequisiti (solo se VM nuova)

```powershell
winget install OpenJS.NodeJS.LTS Git.Git GitHub.cli
# chiudi e riapri PowerShell
npm install -g @anthropic-ai/claude-code
gh auth login
```

## 2. Installa Tako (da utente vero)

```powershell
cd $HOME\Downloads
gh release download v0.1.0 -R Rizzo567/tako -p "*setup.exe"
.\Tako_0.1.0_x64_en-US-setup.exe
```
(Il nome esatto può variare: `dir *.exe` per vederlo. SmartScreen avviserà —
"Ulteriori informazioni" → "Esegui comunque": app non firmata, atteso.)

⚠️ Il primo avvio in VM emulata è LENTO (initdb Postgres + migrazioni): anche
qualche minuto. Non chiuderla.

## 3. Prepara il workspace di Claude

```powershell
cd $HOME
git clone https://github.com/Rizzo567/tako
cd tako
git checkout -b collaudo-vm-tako
corepack enable
pnpm install
copy collaudo-vm-kit\CLAUDE.md .\CLAUDE.md
```

## 4. Avvia Claude Code

```powershell
claude
```

## 5. Primo prompt (copia-incolla)

```
Leggi collaudo-vm-kit/CONTESTO.md e collaudo-vm-kit/GOAL.md, poi
docs/tako-tecnico-interno.md per l'architettura. Esegui il goal con loop
engineering (act→observe→verify→decide, verifier a ogni giro, max 3 tentativi
per voce poi BLOCCATO) usando tutti i sottoagenti che ti servono, inclusa la
verifica avversariale di ogni fix. Report vivo in
collaudo-vm-kit/REPORT-claude-vm.md: aggiornalo dopo ogni voce e fai
commit+push del branch collaudo-vm-tako così il Mac lo legge.
```

## Note

- I fix di Claude arrivano sul branch `collaudo-vm-tako`: li revisiona e integra
  l'istanza Mac. Le release le pubblica solo il Mac.
- Se `gh release download` non trova asset: la release v0.1.0 potrebbe essere
  ancora in build — chiedi al Claude del Mac lo stato.
- Puoi far girare i due collaudi (HearFlow e Tako) nella stessa VM, ma UNA
  sessione Claude per volta per non confondere i report.
