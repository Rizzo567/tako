import { CustomerApp } from '@/components/CustomerApp'

export default function TablePage({ params }: { params: { restaurantId: string; token: string } }) {
  return <CustomerApp restaurantId={params.restaurantId} token={params.token} />
}
