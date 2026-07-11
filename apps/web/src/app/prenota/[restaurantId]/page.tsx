import { ReservationForm } from '@/components/ReservationForm'

// Prenotazione self-service: link pubblico /prenota/<restaurantId>.
export default async function ReservationPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  return <ReservationForm restaurantId={restaurantId} />
}
