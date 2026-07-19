import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "实验室信息管理系统",
  description: "面向科研实验室的样品、任务、数据和报告管理平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
