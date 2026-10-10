import { DigitalMenu } from '@/components/DigitalMenu'
export default async function DigitalMenuPage({params}:{params:Promise<{restaurantId:string}>}) {const {restaurantId}=await params;return <DigitalMenu restaurantId={restaurantId}/>}
