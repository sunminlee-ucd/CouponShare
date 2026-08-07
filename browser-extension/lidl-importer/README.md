# CouponShare Lidl Importer — personal test

1. Open `chrome://extensions` in desktop Chrome.
2. Enable Developer mode.
3. Choose **Load unpacked** and select this folder.
4. Use the extension button to open `https://www.lidl.ie/prm/promotions-list`.
5. Sign in directly on Lidl's website.
6. Open the extension and choose **다시 추출**.
7. Download the JSON and review it at `/lidl-import` on CouponShare.

The extension never reads or exports passwords, cookies, login tokens, or QR codes. It only parses visible promotion-card text from `www.lidl.ie`. This is a personal feasibility test, not an official Lidl integration.
