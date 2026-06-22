# Guida authoring schermate — App Tako (Expo / React Native)

Stai creando UNA schermata dell'app Tako (Expo Router) in React Native, collegata
al server locale via i nostri hook. È un'app NATIVA: usa SOLO primitive React
Native (`View`, `Text`, `Pressable`, `TextInput`, `ScrollView`, `Modal`, `FlatList`),
**niente HTML/CSS/Tailwind**. Stili inline o StyleSheet, colori dal tema.

## Leggi prima
- `apps/app/src/ui/kit.tsx` — componenti: `Card, Button(kind brand|soft|ghost|danger|ok|dark, size sm|md|lg, icon, full, onPress), IconButton(name,tone), Badge(tone ok|wait|info|brand|danger|muted, solid), Kpi(label,value,accent), Title, EmptyState(icon,title,sub), Loader, Icon(name) , euro(n)`. Le icone sono nomi Feather (es. 'shopping-bag','credit-card','map','plus','check','x','edit-2','trash-2','minus','search','refresh-cw').
- `apps/app/src/theme-context.tsx` — `useTheme()` → colori/fonts/radii: `t.brand,t.deep,t.tint,t.wash,t.onBrand,t.bg,t.surface,t.raised,t.sunken,t.hairline,t.ink,t.ink2,t.ink3,t.ok,t.wait,t.info,t.danger (+ *Bg, okDeep), t.stFree/stBusy/stWait/stReady/stClean/stResv, t.radii.{xs,sm,md,lg,xl,pill}, t.fonts.{display,displayBlack,ui,uiMedium,uiBold,mono}`. Per la palette: `useBrand()` → `{brand, setBrand, theme}`.
- `apps/app/src/lib/api.ts` — `apiGet(path), apiPost(path,body), apiPatch(path,body), apiDelete(path)` (auth Bearer automatica, base = server locale).
- `apps/app/app/(app)/ordini.tsx` — schermata di RIFERIMENTO già fatta (pattern ScrollView + maxWidth 1000 + Card + useQuery + useMutation).

## Pattern
- Contenitore: `<ScrollView style={{flex:1,backgroundColor:t.bg}} contentContainerStyle={{padding:20, maxWidth:1000, width:'100%', alignSelf:'center'}}>`. KDS/Sala possono usare larghezza piena.
- Dati: `useQuery({ queryKey:[...], queryFn:()=>apiGet('/...'), refetchInterval:15000 })` e `useMutation({ mutationFn, onSuccess:()=>qc.invalidateQueries({queryKey:[...]}) })` con `useQueryClient`.
- **Real-time**: NON aggiungere socket — la shell (`(app)/_layout.tsx`) invalida già i queryKey su ogni evento. Usa gli stessi queryKey indicati.
- Modali: usa `Modal` di react-native (animationType="slide"/"fade", transparent) con overlay scuro.
- Stati: loading `<Loader/>`, vuoto `<EmptyState/>`. Niente toast lib (usa stato locale o Alert se serve).
- Responsive: opzionale via `useWindowDimensions()`.

## Vincoli
- Crea SOLO il file assegnato sotto `apps/app/app/(app)/`. Non toccare kit/tema/lib/layout.
- TypeScript pulito (`pnpm exec tsc --noEmit` da apps/app). Niente nuove dipendenze.
- Importa dai percorsi relativi corretti (da `app/(app)/x.tsx`: `../../src/ui/kit`, `../../src/theme-context`, `../../src/lib/api`).
