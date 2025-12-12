"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

function cx(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(" ")
}

export default function ProfileEditor() {
  const { data: session, update } = useSession()
  const router = useRouter()

  const [displayName, setDisplayName] = useState<string>(session?.user?.name ?? "")
  const [avatarUrl, setAvatarUrl] = useState<string>(session?.user?.image ?? "")
  const [busy, setBusy] = useState<boolean>(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function saveDisplayName(): Promise<void> {
    setBusy(true)
    try {
      const r = await fetch("/api/profile/display-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      })
      if (!r.ok) throw new Error(await r.text())
      await update({ name: displayName })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update display name"
      alert(msg)
    } finally {
      setBusy(false)
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return

    if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(file.type)) {
      alert("Escolha PNG/JPG/WEBP/GIF/AVIF")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("No máx. 5MB")
      return
    }
    setBusy(true)
    try {
      const qs = new URLSearchParams({ contentType: file.type })
      const up = await fetch(`/api/profile/avatar/upload-url?${qs.toString()}`)
      if (!up.ok) throw new Error(await up.text())
      const { url, publicUrl }: { url: string; publicUrl: string } = await up.json()

    const put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })
    if (!put.ok) {
      const errText = await put.text().catch(() => "")
      console.error("S3 PUT failed", put.status, errText)
      alert("Upload to S3 failed")
      return
    }
      const confirm = await fetch("/api/profile/avatar/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: publicUrl }),
      })
      if (!confirm.ok) throw new Error(await confirm.text())

      setAvatarUrl(publicUrl)
      await update({ image: publicUrl })
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed"
      alert(msg)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function removeAvatar(): Promise<void> {
    setBusy(true)
    try {
      const r = await fetch("/api/profile/avatar/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "" }),
      })
      if (!r.ok) throw new Error(await r.text())
      setAvatarUrl("")
      await update({ image: "" })
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to remove avatar"
      alert(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="text-lg font-semibold">Profile settings</div>

      <div className="mt-4 grid gap-6 md:grid-cols-[160px_1fr]">
        <div>
          <div className="text-sm text-gray-600 mb-2">Profile picture</div>
          <div className="flex flex-col items-start gap-3">
            <div className="relative h-24 w-24 rounded-full overflow-hidden bg-gray-100">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" fill className="object-cover" sizes="96px" />
              ) : (
                <div className="h-full w-full grid place-items-center text-gray-400 text-sm">No photo</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cx("rounded-xl px-3 py-2 text-sm text-white", busy ? "bg-gray-400" : "bg-black")}
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                {busy ? "Uploading…" : "Upload new"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-sm border cursor-pointer"
                  onClick={removeAvatar}
                  disabled={busy}
                >
                  Remove
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            <div className="text-xs text-gray-500">PNG/JPG up to 5MB</div>
          </div>
        </div>

        {/* Display name */}
        <div>
          <div className="text-sm text-gray-600 mb-2">Display name</div>
          <div className="flex items-center gap-2">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Ex.: Angel Prieto"
              maxLength={100}
            />
            <button
              type="button"
              onClick={saveDisplayName}
              disabled={busy || displayName === (session?.user?.name ?? "")}
              className={cx("rounded-xl px-4 py-2 text-sm text-white", busy ? "bg-gray-400" : "bg-primary")}
            >
              Save
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-1">This name appears in the header.</div>
        </div>
      </div>
    </div>
  )
}
