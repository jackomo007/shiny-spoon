import Button from "../ui/Button";
import Card from "../ui/Card";

export default function AnnouncementBar() {
  return (
    <Card className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-gray-100 grid place-items-center">🦉</div>
        <p className="text-sm text-gray-700">
          Have a trade you&apos;re interested in taking? Use our AI Trade Analyzer to get a second opinion.
        </p>
      </div>
      <Button as="a" href="/trade-analyzer">Use Trade Analyzer</Button>
    </Card>
  )
}
