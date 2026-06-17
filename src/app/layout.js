import "./globals.css";

export const metadata = {
  title: "OBAKE MONITOR",
  description: "obakeの生存状況を観察するためのサイト",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
