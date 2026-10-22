// UNICO punto di import del motore del gesto (CONTRATTO-GESTO.md). I tipi restano quelli del contratto (copiati in gesture-stub.ts).
// Passaggio al modulo vero: copiare il file in `packages/menu-gesture/src/index.ts`, poi sostituire SOLO la riga seguente con
//   export { createMenuGesture } from '../../../../../packages/menu-gesture/src/index'
export { createMenuGesture } from './gesture-stub'
export type { GestureOptions, ReorderDrop, MenuGesture } from './gesture-stub'
