# یادداشت درس (Cloudflare Worker + R2 + D1)

PWA برای خواندن PDF اسکن‌شده و نوشتن با S Pen، با همگام‌سازی بین دستگاه‌ها.

- `public/` خود اپ
- `src/worker.js` API (فقط `/api/*`) با R2 (فایل PDF) و D1 (نوشته‌ها)
- `schema.sql` جدول‌های D1
- `wrangler.jsonc` تنظیمات

اپ بدون فضای ابری هم کار می‌کند (فقط محلی). همگام‌سازی وقتی فعال می‌شود که API و Access درست تنظیم شده باشند.

## راه‌اندازی (یک بار)
1. **D1**: داشبورد کلودفلر > Storage & Databases > D1 > Create database با اسم `studynotes`. بعد توی تب Console همه محتوای `schema.sql` را اجرا کن. `database_id` را کپی کن و توی `wrangler.jsonc` بگذار.
2. **R2**: R2 > Create bucket با اسم `studynotes-books`. (R2 برای فعال‌سازی کارت می‌خواهد ولی تا ۱۰ گیگ رایگان است.)
3. ریپو را با این فایل‌ها آپدیت کن و Worker را دیپلوی کن (Workers Builds با `npx wrangler deploy` مثل قبل).
4. **قفل کردن با Access** (ضروری، چون PDFها خصوصی‌اند):
   - Workers & Pages > studynotes > Settings > Domains & Routes > روی ردیف `workers.dev` گزینه Cloudflare Access را فعال کن. وارد Zero Trust می‌شوی؛ یک Policy بساز که فقط ایمیل خودت را Allow کند.
   - توی Zero Trust > Access > Applications، اپلیکیشن ساخته‌شده را باز کن و **Application Audience (AUD) Tag** را کپی کن.
   - Team domain شبیه `اسم‌تیم.cloudflareaccess.com` است (Zero Trust > Settings).
   - این دو مقدار را توی `vars` فایل `wrangler.jsonc` بگذار و دوباره push کن.
5. بدون این دو مقدار، API عمداً همه درخواست‌ها را رد می‌کند (۴۰۱) و اپ فقط محلی کار می‌کند.

## تست محلی
فایل `.dev.vars` با `ALLOW_INSECURE=1` بساز و `npx wrangler dev` بزن. این فایل را هرگز commit نکن (در .gitignore هست).

## نحوه همگام‌سازی
- کتاب جدید: روی دستگاه ذخیره و در پس‌زمینه با آپلود ۸ مگی تکه‌تکه به R2 می‌رود.
- کتاب‌های دستگاه دیگر با برچسب «ابری» دیده می‌شوند و با باز کردن دانلود می‌شوند.
- نوشته‌ها هر چند ثانیه بعد از تغییر (فقط صفحات تغییرکرده) به D1 می‌روند و با باز کردن اپ یا هر ۳۰ ثانیه دریافت می‌شوند. در تداخل، آخرین تغییر هر صفحه برنده است.
- حذف کتاب از همه دستگاه‌ها پاک می‌شود و نیاز به آنلاین بودن دارد.
- اگر نشست Access تمام شد، اپ آفلاین‌وار ادامه می‌دهد؛ یک بار سایت را داخل Chrome باز کن تا دوباره وارد شوی.
