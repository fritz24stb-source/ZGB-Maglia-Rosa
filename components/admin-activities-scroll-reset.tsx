"use client";

import { useEffect } from "react";

export function AdminActivitiesScrollReset({ resetKey }: { resetKey: string }) {
  useEffect(() => {
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }, [resetKey]);

  return null;
}
