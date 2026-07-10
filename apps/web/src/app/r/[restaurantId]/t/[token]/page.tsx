import { CustomerApp } from '@/components/CustomerApp'

export default async function TablePage({ params }: { params: Promise<{ restaurantId: string; token: string }> }) {
  const { restaurantId, token } = await params
  return <CustomerApp restaurantId={restaurantId} token={token} />
}
