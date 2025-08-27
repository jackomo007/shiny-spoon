import Card from "../ui/Card";

export default function GoalCard() {
  return (
    <Card>
      <div className="text-lg font-semibold mb-4">Next Goal</div>
      <div className="text-sm text-gray-600 mb-3">
        Completed: <span className="font-medium text-primary">70%</span>
      </div>
      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
        <div className="bg-primary h-2 w-[70%]" />
      </div>

      <ul className="mt-4 text-sm text-gray-700 space-y-1">
        <li><span className="font-medium">Make $2,000</span> trading in the month of July.</li>
        <li className="flex justify-between"><span>Start Date:</span><span>August 1</span></li>
        <li className="flex justify-between"><span>End Date:</span><span>August 30</span></li>
        <li className="flex justify-between">
          <span>Status:</span>
          <span className="inline-block rounded-md bg-orange-100 text-orange-700 px-2 py-0.5 text-xs">In Progress</span>
        </li>
      </ul>
    </Card>
  )
}
