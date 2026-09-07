export type NotificationType = "voucher_reserved" | "reservation_cancelled" | "voucher_expiring_today" | "voucher_used";
export type NotificationLanguage = "ko" | "en" | "fa" | "ja";
export type VoucherType = "5off25" | "10off40" | "10off50";

export function voucherLabel(voucherType: VoucherType) {
  if (voucherType === "5off25") return "€5 OFF €25";
  if (voucherType === "10off40") return "€10 OFF €40";
  return "€10 OFF €50";
}

export function notificationCopy(type: NotificationType, voucherType: VoucherType, language: NotificationLanguage) {
  const label = voucherLabel(voucherType);

  if (language === "en") {
    if (type === "voucher_reserved") return { title: "Your voucher was reserved", body: `Another user reserved your ${label} voucher.` };
    if (type === "reservation_cancelled") return { title: "The reservation was cancelled", body: `The user cancelled their reservation for your ${label} voucher. It is available to share again.` };
    if (type === "voucher_expiring_today") return { title: "Your voucher expires today", body: `Your ${label} voucher can only be used today. Please check it before it expires.` };
    return { title: "Voucher use completed", body: `Your ${label} voucher was marked as used. The user may have tapped this by mistake, so we recommend checking the status if anything looks unusual.` };
  }

  if (language === "fa") {
    if (type === "voucher_reserved") return { title: "ووچر شما رزرو شد", body: `کاربر دیگری ووچر ${label} شما را رزرو کرد.` };
    if (type === "reservation_cancelled") return { title: "رزرو لغو شد", body: `کاربر رزرو ووچر ${label} شما را لغو کرد. این ووچر دوباره برای اشتراک‌گذاری در دسترس است.` };
    if (type === "voucher_expiring_today") return { title: "ووچر شما امروز منقضی می‌شود", body: `ووچر ${label} شما فقط تا پایان امروز قابل استفاده است. لطفاً پیش از انقضا وضعیت آن را بررسی کنید.` };
    return { title: "استفاده از ووچر تکمیل شد", body: `ووچر ${label} شما به‌عنوان استفاده‌شده ثبت شد. ممکن است کاربر اشتباهی این گزینه را زده باشد، بنابراین در صورت مشاهده مورد غیرعادی بهتر است وضعیت را بررسی کنید.` };
  }

  if (language === "ja") {
    if (type === "voucher_reserved") return { title: "バウチャーが予約されました", body: `別のユーザーがあなたの${label}バウチャーを予約しました。` };
    if (type === "reservation_cancelled") return { title: "予約がキャンセルされました", body: `ユーザーがあなたの${label}バウチャーの予約をキャンセルしました。再び共有できます。` };
    if (type === "voucher_expiring_today") return { title: "バウチャーは本日までです", body: `あなたの${label}バウチャーは本日中のみ利用できます。期限前に状態をご確認ください。` };
    return { title: "バウチャーの利用が完了しました", body: `あなたの${label}バウチャーが使用済みになりました。ユーザーが誤って押した可能性もあるため、不審な点があれば状態を確認することをおすすめします。` };
  }

  if (type === "voucher_reserved") return { title: "회원님의 Voucher가 예약되었습니다.", body: `다른 사용자가 회원님의 ${label} Voucher를 예약했습니다.` };
  if (type === "reservation_cancelled") return { title: "예약이 취소되었습니다.", body: `예약했던 사용자가 회원님의 ${label} Voucher 예약을 취소했습니다. 다시 공유 가능한 상태입니다.` };
  if (type === "voucher_expiring_today") return { title: "회원님의 Voucher가 오늘 만료됩니다.", body: `회원님의 ${label} Voucher는 오늘까지만 사용할 수 있습니다. 만료 전에 상태를 확인해 주세요.` };
  return { title: "Voucher 사용이 완료되었습니다.", body: `회원님의 ${label} Voucher가 사용 완료 처리되었습니다. 사용자가 잘못 눌렀을 가능성도 있으니, 이상한 점이 있다면 상태를 한 번 확인해 보시는 것을 권장합니다.` };
}
