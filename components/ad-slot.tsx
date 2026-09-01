"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

type AdSenseConfig = {
  client: string;
  slot: string;
  layoutKey?: string;
};

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

const readAdSenseConfigToken = () => {
  const { adsenseClient, adsenseFeedSlot, adsenseFeedLayoutKey } =
    document.documentElement.dataset;

  return [adsenseClient ?? "", adsenseFeedSlot ?? "", adsenseFeedLayoutKey ?? ""].join("|");
};

const subscribeToStaticConfig = () => () => {};

const parseAdSenseConfig = (token: string): AdSenseConfig | null => {
  const [client, slot, layoutKey] = token.split("|");

  if (!/^ca-pub-\d{16}$/.test(client) || !/^\d+$/.test(slot)) {
    return null;
  }

  return {
    client,
    slot,
    layoutKey: layoutKey || undefined,
  };
};

export function FeedAdSlot() {
  const configToken = useSyncExternalStore(
    subscribeToStaticConfig,
    readAdSenseConfigToken,
    () => "",
  );
  const config = useMemo(() => parseAdSenseConfig(configToken), [configToken]);

  useEffect(() => {
    if (!config) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers and delayed AdSense loading should not affect the content feed.
    }
  }, [config]);

  if (!config) return null;

  const inFeedAttributes = config.layoutKey
    ? { "data-ad-format": "fluid", "data-ad-layout-key": config.layoutKey }
    : { "data-ad-format": "auto", "data-full-width-responsive": "true" };

  return (
    <aside className="feed-ad" aria-label="광고">
      <span>ADVERTISEMENT</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={config.client}
        data-ad-slot={config.slot}
        {...inFeedAttributes}
      />
    </aside>
  );
}
