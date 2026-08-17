"use client";

type Props = {
  profileId: string;
  userLabel: string;
  registeredVouchers: number;
};

export default function AdminUserResetActions({ profileId, userLabel, registeredVouchers }: Props) {
  return (
    <form className="admin-inline-actions" action="/api/admin/moderation" method="post">
      <input type="hidden" name="targetId" value={profileId} />
      <button name="action" value="reset_dunnes_reservations" type="submit" title="이 사용자의 오늘 Dunnes 예약 사용 횟수를 0으로 초기화합니다.">
        예약 횟수 초기화
      </button>
      <button name="action" value="reset_dunnes_upload_limit" type="submit" title="이 사용자의 오늘 Dunnes 바우처 등록 횟수를 0으로 초기화합니다.">
        등록 횟수 초기화
      </button>
      <button
        className="danger"
        name="action"
        value="reset_dunnes_vouchers"
        type="submit"
        title="등록한 Dunnes 바우처를 삭제하고 같은 바코드의 재등록을 허용합니다."
        onClick={(event) => {
          const detail = registeredVouchers > 0 ? ` 현재 등록된 ${registeredVouchers}개 바우처가 삭제됩니다.` : "";
          if (!window.confirm(`${userLabel}의 Dunnes 등록 바우처를 초기화할까요?${detail} 같은 바코드를 다시 등록할 수 있게 됩니다.`)) {
            event.preventDefault();
          }
        }}
      >
        등록 바우처 초기화
      </button>
    </form>
  );
}
