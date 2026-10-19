/** 19/10 sera: unica condizione «email attive» (recupero password). La usano /web-accounts/capabilities e il bot WhatsApp:
 *  finché è false il bot non rimanda al tasto «Password dimenticata» ma all'agenzia. */
export const webEmailEnabled=()=>process.env.WEB_EMAIL_ENABLED==='1'&&!!process.env.RESEND_API_KEY&&!!process.env.EMAIL_FROM
