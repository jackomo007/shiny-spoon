export function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm">{children}</table></div>
}
export function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-gray-500 font-medium pb-2">{children}</th>
}
export function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-3 border-top border-gray-100">{children}</td>
}
export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="[&>td]:pr-4 last:[&>td]:pr-0">{children}</tr>
}
