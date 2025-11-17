import { Suspense } from "react"
import Card from "@/components/ui/Card"
import JournalClient from "./journal-client"

export default function JournalPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6">
          <Card>
            <div className="py-10 text-center text-sm text-gray-500">
              Loading journal…
            </div>
          </Card>
        </div>
      }
    >
      <JournalClient />
    </Suspense>
  )
}
