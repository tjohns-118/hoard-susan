import './globals.css';

export const metadata = {
title: 'Hoard',
description: 'Broker Command Center',
};

export default function RootLayout({
children,
}: Readonly<{
children: React.ReactNode;
}>) {
return (
<html lang="en">
<body style={{ margin: 0 }}>{children}</body>
</html>
);
}
