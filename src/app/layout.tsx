export const metadata = {
  title: "MetaFroge AI Runtime",
  description: "Metadata-driven application backend runtime",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
