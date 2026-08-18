"use client";

export default function AdminAccessCodeCopy() {
  return (
    <>
      <style>{`.policy-row:has([data-retired-invite-code]){display:none!important}`}</style>
      <span data-retired-invite-code hidden />
    </>
  );
}
