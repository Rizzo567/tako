import { forwardRef, type AnchorHTMLAttributes } from 'react'
// The shared ReservationForm only uses next/link for /privacy. A native anchor
// keeps browser navigation, new-tab, keyboard and download semantics intact.
export default forwardRef<HTMLAnchorElement,AnchorHTMLAttributes<HTMLAnchorElement>>(function StaticLink(props,ref){return <a {...props} ref={ref}/>})
