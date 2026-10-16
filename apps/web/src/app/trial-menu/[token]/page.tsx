import {OnboardingPreview} from '@/components/OnboardingPreview'
export const metadata={robots:{index:false,follow:false},title:'PROVA · Takomenu'}
export default async function TrialMenuPage({params}:{params:Promise<{token:string}>}){const {token}=await params;return <OnboardingPreview token={token} trial/>}
