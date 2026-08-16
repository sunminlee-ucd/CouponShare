"use client";

import { type ReactNode, useState } from "react";

type ReviewStore = "dunnes" | "lidl";

type AdminReviewTabsProps = {
  dunnes: ReactNode;
  dunnesCount: number;
  lidl: ReactNode;
  lidlCount: number;
};

export default function AdminReviewTabs({ dunnes, dunnesCount, lidl, lidlCount }: AdminReviewTabsProps) {
  const [activeStore, setActiveStore] = useState<ReviewStore>("dunnes");
  const isDunnes = activeStore === "dunnes";

  return (
    <section className="admin-review-tabs" id="reviews">
      <div className="admin-review-tablist" role="tablist" aria-label="매장별 검수">
        <button
          aria-controls="admin-review-panel"
          aria-selected={isDunnes}
          className={isDunnes ? "active" : ""}
          id="admin-review-tab-dunnes"
          onClick={() => setActiveStore("dunnes")}
          role="tab"
          type="button"
        >
          Dunnes <span>{dunnesCount}</span>
        </button>
        <button
          aria-controls="admin-review-panel"
          aria-selected={!isDunnes}
          className={!isDunnes ? "active" : ""}
          id="admin-review-tab-lidl"
          onClick={() => setActiveStore("lidl")}
          role="tab"
          type="button"
        >
          Lidl <span>{lidlCount}</span>
        </button>
      </div>
      <div
        aria-labelledby={isDunnes ? "admin-review-tab-dunnes" : "admin-review-tab-lidl"}
        className="admin-review-panel-list"
        id="admin-review-panel"
        role="tabpanel"
      >
        {isDunnes ? dunnes : lidl}
      </div>
    </section>
  );
}
