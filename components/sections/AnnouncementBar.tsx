import Card from "../ui/Card";
import Button from "../ui/Button";

const DISCORD_INVITE_URL = "https://discord.gg/YXjrcApn";

export default function AnnouncementBar() {
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-full grid place-items-center text-white"
          style={{ backgroundColor: "#5865F2" }}
          aria-hidden
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            role="img"
            aria-label="Discord"
          >
            <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.676 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.027c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.104 13.245 13.245 0 0 1-1.885-.9.077.077 0 0 1-.008-.128c.127-.095.254-.194.374-.291a.074.074 0 0 1 .077-.01c3.928 1.794 8.18 1.794 12.061 0a.074.074 0 0 1 .078.01c.121.098.247.197.375.291a.077.077 0 0 1-.006.128 12.299 12.299 0 0 1-1.886.9.076.076 0 0 0-.04.104c.36.699.772 1.364 1.225 1.994a.076.076 0 0 0 .084.028 19.865 19.865 0 0 0 6.002-3.03.077.077 0 0 0 .03-.056c.5-5.177-.838-9.673-3.548-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.175 1.095 2.157 2.418 0 1.334-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.175 1.095 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z" />
          </svg>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">
            Join our Discord community
          </p>
          <p className="text-sm text-gray-700">
            Get trade feedback, share setups, and ask questions in real time with other traders.
          </p>
        </div>
      </div>

      <Button
        as="a"
        href={DISCORD_INVITE_URL}
        rel="noopener noreferrer"
        className="w-full sm:w-auto"
        style={{ backgroundColor: "#5865F2" }}
      >
        Join Discord
      </Button>
    </Card>
  );
}
