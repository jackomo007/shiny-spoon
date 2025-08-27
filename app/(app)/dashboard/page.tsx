import AnnouncementBar from '@/components/sections/AnnouncementBar'
import GoalCard from '@/components/sections/GoalCard'
import CourseProgressCard from '@/components/sections/CourseProgressCard'
import OpenTradesCard from '@/components/sections/OpenTradesCard'
import EarningsChart, { Point } from '@/components/charts/EarningsChart'
import Card from '@/components/ui/Card'

export default function DashboardPage() {
  const earnings: Point[] = [
    { name: 'Jan', value: 5 }, { name: 'Feb', value: 4 }, { name: 'Mar', value: 8 },
    { name: 'Apr', value: 28 }, { name: 'May', value: 18 }, { name: 'Jun', value: 22 },
    { name: 'Jul', value: 8 },
  ]

  const trades = [
    { name: 'ADA/USDT', orderDate: '06/01/2025 05:00:00', side: 'Long' as const, price: '$0.65', spent: '$2500' },
  ]

  return (
    <div className="grid gap-6">
      <AnnouncementBar />
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card>
          <div className="text-lg font-semibold mb-4">Earnings</div>
          <EarningsChart data={earnings} />
        </Card>
        <GoalCard />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <CourseProgressCard />
        <OpenTradesCard trades={trades} />
      </div>

      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
        <span>© 2025 Maverick AI. All rights reserved.</span>
        <a href="#" className="hover:underline">Support</a>
        <a href="#" className="hover:underline">Terms</a>
        <a href="#" className="hover:underline">Privacy</a>
      </footer>
    </div>
  )
}
