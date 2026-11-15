# یادداشت درس (Cloudflare Worker + Static Assets)

وب‌اپ نصب‌شدنی (PWA) برای خواندن PDF و نوشتن با S Pen. فعلاً یک Worker فقط-فایل‌های-استاتیک است (بدون کد سمت سرور و بدون مرحله build). بعداً API، R2 و D1 به همین Worker اضافه می‌شوند.

## ساختار
- `public/` : خود اپ (index.html، sw.js، manifest و آیکون‌ها). محتوای این پوشه ریشه سایت می‌شود.
- `wrangler.jsonc` : تنظیم Worker (اسم و پوشه assets).

## دیپلوی با Git (پیشنهادی، یک بار)
1. توی GitHub یک ریپوی Private بساز و همه این پوشه (با ساختار بالا) را آپلود کن.
2. dash.cloudflare.com > Workers & Pages > Create application > Import a repository (Workers Builds) و ریپو را انتخاب کن.
3. تنظیمات:
   - Build command: خالی
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`
4. Deploy. آدرس `studynotes.<حساب‌تو>.workers.dev` ساخته می‌شود.
5. آدرس را روی تبلت با Chrome باز کن > منو > Install app.

## دیپلوی دستی (بدون GitHub)
```
npx wrangler login
npx wrangler deploy
```

## آپدیت
هر تغییری روی `main` push کنی، خودکار دیپلوی می‌شود. اپ نصب‌شده دفعه بعد که باز کنی نسخه جدید را می‌گیرد.

## توجه
- فعلاً کتاب‌ها و نوشته‌ها فقط روی همان دستگاه (IndexedDB) ذخیره می‌شوند. همگام‌سازی مرحله بعد است.
- اگر اسم `studynotes` قبلاً گرفته شده بود، `name` را توی wrangler.jsonc عوض کن.
