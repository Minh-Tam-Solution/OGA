import './globals.css';

export const metadata = {
  title: 'NQH Creative Studio',
  description: 'NQH Creative Studio — AI-powered creative studio for image and video generation.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
