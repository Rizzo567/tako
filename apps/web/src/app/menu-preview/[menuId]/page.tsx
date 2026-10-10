import { MenuPreview } from '@/components/MenuPreview'
export default async function PreviewPage({params}:{params:Promise<{menuId:string}>}) {const {menuId}=await params;return <MenuPreview menuId={menuId}/>}
