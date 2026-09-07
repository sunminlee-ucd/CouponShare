"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { notificationCopy, type NotificationType, type VoucherType } from "./notifications/copy";
import { useLanguage } from "./i18n";
import styles from "./NotificationCenter.module.css";

type NotificationItem = {
  id: string;
  notification_type: NotificationType;
  voucher_id: string;
  voucher_type: VoucherType;
  read_at: string | null;
  created_at: string;
};

type NotificationResponse = {
  notifications?: NotificationItem[];
  unreadCount?: number;
};

type PushResponse = {
  publicKey?: string;
  subscribed?: boolean;
};

function decodeApplicationServerKey(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer as ArrayBuffer;
}

export default function NotificationCenter() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const visiblePath = pathname === "/"
    || pathname === "/dunnes"
    || pathname.startsWith("/dunnes/")
    || pathname.startsWith("/lidl-import");

  const copy = useMemo(() => language === "en" ? {
    label: "Notifications",
    title: "Notifications",
    empty: "No notifications yet.",
    allRead: "Mark all read",
    enable: "Enable device alerts",
    disable: "Disable device alerts",
    busy: "Saving…",
    unsupported: "Device alerts are not available in this browser. On iPhone or iPad, add CouponShare to the Home Screen first and enable notifications there.",
    denied: "Notifications are blocked in the browser settings. Allow CouponShare notifications there and try again.",
    failed: "Could not update device notifications. Please try again.",
  } : language === "fa" ? {
    label: "اعلان‌ها",
    title: "اعلان‌ها",
    empty: "هنوز اعلانی ندارید.",
    allRead: "همه خوانده شدند",
    enable: "فعال‌کردن اعلان دستگاه",
    disable: "غیرفعال‌کردن اعلان دستگاه",
    busy: "در حال ذخیره…",
    unsupported: "اعلان دستگاه در این مرورگر در دسترس نیست. در iPhone یا iPad ابتدا CouponShare را به Home Screen اضافه کنید و سپس اعلان‌ها را فعال کنید.",
    denied: "اعلان‌ها در تنظیمات مرورگر مسدود شده‌اند. اجازه اعلان CouponShare را فعال کرده و دوباره تلاش کنید.",
    failed: "به‌روزرسانی اعلان دستگاه انجام نشد. دوباره تلاش کنید.",
  } : language === "ja" ? {
    label: "通知",
    title: "通知",
    empty: "通知はまだありません。",
    allRead: "すべて既読にする",
    enable: "端末通知をオン",
    disable: "端末通知をオフ",
    busy: "保存中…",
    unsupported: "このブラウザでは端末通知を利用できません。iPhone / iPadでは、まずCouponShareをホーム画面に追加してから通知を有効にしてください。",
    denied: "ブラウザ設定で通知がブロックされています。CouponShareの通知を許可してからもう一度お試しください。",
    failed: "端末通知を更新できませんでした。もう一度お試しください。",
  } : {
    label: "알림",
    title: "알림",
    empty: "아직 알림이 없습니다.",
    allRead: "모두 읽음",
    enable: "기기 알림 켜기",
    disable: "기기 알림 끄기",
    busy: "처리 중…",
    unsupported: "이 브라우저에서는 기기 알림을 사용할 수 없습니다. iPhone/iPad에서는 CouponShare를 홈 화면에 추가한 뒤 알림을 켜 주세요.",
    denied: "브라우저 설정에서 알림이 차단되어 있습니다. CouponShare 알림을 허용한 뒤 다시 시도해 주세요.",
    failed: "기기 알림 설정을 변경하지 못했습니다. 다시 시도해 주세요.",
  }, [language]);

  const refresh = useCallback(async () => {
    if (!visiblePath) return;
    try {
      const response = await fetch("/api/notifications", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        if (response.status === 401 || response.status === 404) setAvailable(false);
        return;
      }
      const result = await response.json() as NotificationResponse;
      setAvailable(true);
      setNotifications(result.notifications ?? []);
      setUnreadCount(Number(result.unreadCount ?? 0));
    } catch {
      // The bell stays unobtrusive while the next refresh retries.
    }
  }, [visiblePath]);

  useEffect(() => {
    if (!visiblePath) {
      setAvailable(false);
      setOpen(false);
      return;
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, visiblePath]);

  useEffect(() => {
    if (!available || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    let cancelled = false;
    void Promise.all([
      fetch("/api/push-subscriptions", { cache: "no-store", credentials: "same-origin" }).then((response) => response.ok ? response.json() as Promise<PushResponse> : null),
      navigator.serviceWorker.getRegistration("/").then((registration) => registration?.pushManager.getSubscription() ?? null),
    ]).then(([server, browserSubscription]) => {
      if (!cancelled) setPushEnabled(Boolean(server?.subscribed && browserSubscription));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [available]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    if (response.ok) {
      setUnreadCount(0);
      setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!item.read_at) {
      void fetch("/api/notifications", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationId: item.id }),
      });
    }
    window.location.href = `/dunnes?notification=${encodeURIComponent(item.id)}`;
  }

  async function enablePush() {
    setPushBusy(true);
    setPushError("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("unsupported");
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("denied");

      const keyResponse = await fetch("/api/push-subscriptions", { cache: "no-store", credentials: "same-origin" });
      if (!keyResponse.ok) throw new Error("failed");
      const keyResult = await keyResponse.json() as PushResponse;
      if (!keyResult.publicKey) throw new Error("failed");

      await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(keyResult.publicKey),
      });
      const serialized = subscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) throw new Error("failed");

      const response = await fetch("/api/push-subscriptions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: serialized.endpoint, keys: serialized.keys, language }),
      });
      if (!response.ok) throw new Error("failed");
      setPushEnabled(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed";
      setPushError(message === "unsupported" ? copy.unsupported : message === "denied" ? copy.denied : copy.failed);
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushError("");
    try {
      const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/") : undefined;
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      const response = await fetch("/api/push-subscriptions", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription ? { endpoint: subscription.endpoint } : {}),
      });
      if (!response.ok) throw new Error("failed");
      if (subscription) await subscription.unsubscribe();
      setPushEnabled(false);
    } catch {
      setPushError(copy.failed);
    } finally {
      setPushBusy(false);
    }
  }

  if (!visiblePath || !available) return null;

  return (
    <div className={styles.root} ref={panelRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={copy.label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className={styles.bell}>♢</span>
        {unreadCount > 0 && <strong className={styles.badge}>{unreadCount > 99 ? "99+" : unreadCount}</strong>}
      </button>

      {open && (
        <section className={styles.panel} aria-label={copy.title}>
          <header className={styles.header}>
            <strong>{copy.title}</strong>
            {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()}>{copy.allRead}</button>}
          </header>

          <div className={styles.pushControls}>
            <button type="button" disabled={pushBusy} onClick={() => void (pushEnabled ? disablePush() : enablePush())}>
              {pushBusy ? copy.busy : pushEnabled ? copy.disable : copy.enable}
            </button>
            {pushError && <small role="alert">{pushError}</small>}
          </div>

          <div className={styles.list}>
            {notifications.length === 0 ? <p className={styles.empty}>{copy.empty}</p> : notifications.map((item) => {
              const itemCopy = notificationCopy(item.notification_type, item.voucher_type, language);
              return (
                <button
                  type="button"
                  className={`${styles.item}${item.read_at ? "" : ` ${styles.unread}`}`}
                  key={item.id}
                  onClick={() => void openNotification(item)}
                >
                  <span><strong>{itemCopy.title}</strong><small>{new Date(item.created_at).toLocaleString()}</small></span>
                  <p>{itemCopy.body}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
