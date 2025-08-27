import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Purpose - Application UI Kit',
  description: '',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-gray-900 antialiased">{children}</body>
    </html>
  )
}
