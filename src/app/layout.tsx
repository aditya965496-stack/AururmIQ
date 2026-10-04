import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'AurumIQ · Commodity intelligence',description:'A traceable, lifecycle-aware gold derivatives research workspace. Research, not investment advice.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
