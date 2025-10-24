export const metadata = {
  title: 'WordPress AI Editor - Vercel AI + MCP',
  description: 'AI-powered WordPress content management using Vercel AI SDK and MCP',
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