# OBAKE MONITOR

身内向けの入浴・外出記録、リアクション、クエスト、観測者称号、ガチャを扱うNext.jsアプリです。

## データ保護

- 観測者のポイント、称号、ガチャ券はデータベースに保存されます。
- ブラウザの `observer_token` Cookieは既存観測者を特定する鍵です。値やCookie名を変更しないでください。
- DB変更前は稼働中のDBをバックアップし、復元と件数を確認してください。
- `obake.db` には観測者トークンが含まれます。外部へ共有しないでください。
- `test.js` はDBへテスト投稿を書き込むため、本番DBに接続した状態で実行しないでください。

## 設定

`.env.example` を参考に、`ADMIN_PASSWORD` と本番DB接続情報を環境変数で設定します。管理者パスワードの既定値はありません。

起動・ビルド前に `npm run db:migrate` が自動実行され、既存データを残したまま必要なテーブルとインデックスを追加します。

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
