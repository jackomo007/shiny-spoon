import Card from "../ui/Card"

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs">{children}</span>
}

export default function CourseProgressCard() {
  return (
    <Card>
      <div className="text-lg font-semibold mb-4">Course Progress</div>

      <div className="grid gap-4">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-pink-500/10 text-pink-600 grid place-items-center">in</div>
              <div>
                <div className="font-medium">Intro To Trading</div>
                <Badge>In Progress</Badge>
              </div>
            </div>
            <div className="text-sm text-gray-600">60%</div>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-2">
            <div className="bg-primary h-2 w-[60%]" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-600 grid place-items-center">R</div>
              <div>
                <div className="font-medium">Crypto Security</div>
                <Badge>Up Next</Badge>
              </div>
            </div>
            <div className="text-sm text-gray-600">0%</div>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-2">
            <div className="bg-primary h-2 w-[0%]" />
          </div>
        </div>

        <button className="mt-2 w-full rounded-xl bg-gray-100 hover:bg-gray-200 py-2 text-sm">Resume Course</button>
      </div>
    </Card>
  )
}
