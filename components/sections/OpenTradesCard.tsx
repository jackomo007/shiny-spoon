import { Table, Th, Tr, Td } from '@/components/ui/Table'
import Card from '../ui/Card'

type Trade = {
  name: string
  orderDate: string
  side: 'Long' | 'Short'
  price: string
  spent: string
}

export default function OpenTradesCard({ trades }: { trades: Trade[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="text-lg font-semibold">Open Trades</div>
        <div className="flex gap-3 text-gray-500">
          <button title="search">🔍</button>
          <button title="filter">⚙️</button>
          <button title="more">⋯</button>
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Order Date</Th>
            <Th>Side</Th>
            <Th>Price</Th>
            <Th>Spent</Th>
            <Th> </Th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <Tr key={i}>
              <Td>{t.name}</Td>
              <Td><span className="text-gray-600">{t.orderDate}</span></Td>
              <Td>{t.side}</Td>
              <Td>{t.price}</Td>
              <Td>{t.spent}</Td>
              <Td><a className="text-primary" href="#">↗</a></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}
