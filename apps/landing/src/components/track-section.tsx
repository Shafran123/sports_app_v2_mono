"use client";

import * as React from "react";
import { trackEvent } from "@/lib/analytics";

/** Fires one `section_view` event per section, per visit. Renders nothing. */
export function TrackSection({ name }: { name: string }) {
  React.useEffect(() => {
    trackEvent("section_view", { section: name });
  }, [name]);

  return null;
}