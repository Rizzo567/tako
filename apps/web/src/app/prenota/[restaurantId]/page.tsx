import { I18nProvider } from '@/lib/i18n'
import { ReservationForm } from '@/components/ReservationForm'

// Prenotazione self-service: link pubblico /prenota/<restaurantId>.
export default async function ReservationPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  return (
    <I18nProvider restaurantId={restaurantId}>
      <ReservationForm restaurantId={restaurantId} />
    </I18nProvider>
  )
}
