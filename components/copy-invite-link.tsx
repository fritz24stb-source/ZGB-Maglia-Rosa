"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

type CopyInviteLinkProps = {
  value: string;
};

export function CopyInviteLink({ value }: CopyInviteLinkProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
      onClick={copyLink}
      type="button"
    >
      <Copy aria-hidden className="h-4 w-4" />
      {copied ? "Kopiert" : "Kopieren"}
    </button>
  );
}
