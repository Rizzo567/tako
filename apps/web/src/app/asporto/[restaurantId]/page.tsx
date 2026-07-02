import { TakeawayApp } from '@/components/TakeawayApp'

// Ordine-ahead / asporto senza tavolo: link pubblico /asporto/<restaurantId>.
export default async function TakeawayPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  return <TakeawayApp restaurantId={restaurantId} />
}
