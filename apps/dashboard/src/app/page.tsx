// La root reindirizza alla SPA staff (vedi redirect in next.config.ts). Questo
// componente è un fallback nel caso il redirect non scatti.
export default function RootPage() {
  return (
    <meta httpEquiv="refresh" content="0; url=/staff/index.html" />
  )
}
