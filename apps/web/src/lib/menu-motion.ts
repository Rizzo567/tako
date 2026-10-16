import tokens from './menu-motion.tokens.json'
export const MENU_MOTION=tokens
export const MENU_SPRING={type:'spring' as const,...tokens.spring}
export const MENU_FADE={duration:tokens.durationMs.fast/1000,ease:tokens.easing.out as [number,number,number,number]}
export const LANGUAGE_PRESENTATION:Record<string,{name:string;flag:string}>={it:{name:'Italiano',flag:'🇮🇹'},en:{name:'English',flag:'🇬🇧'},fr:{name:'Français',flag:'🇫🇷'},de:{name:'Deutsch',flag:'🇩🇪'},es:{name:'Español',flag:'🇪🇸'},pt:{name:'Português',flag:'🇵🇹'},nl:{name:'Nederlands',flag:'🇳🇱'},pl:{name:'Polski',flag:'🇵🇱'},ru:{name:'Русский',flag:'🇷🇺'},ar:{name:'العربية',flag:'🇸🇦'},zh:{name:'中文',flag:'🇨🇳'},ja:{name:'日本語',flag:'🇯🇵'}}

// Brand entrance: a slower sequence approved by Manuel, separate from gesture response.
export const MENU_LOGO_MOTION={enter:MENU_MOTION.durationMs.data*2,hold:MENU_MOTION.durationMs.reveal,exit:MENU_MOTION.durationMs.surface*2,header:MENU_MOTION.durationMs.reveal*2,ease:[.22,1,.36,1] as [number,number,number,number]}
