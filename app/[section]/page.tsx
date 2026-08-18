import { notFound } from "next/navigation";
import { AppShell } from "../components/AppShell";
import { validSections } from "../lib/navigation";

export const dynamic = "force-dynamic";

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!validSections.includes(section)) notFound();
  return <AppShell section={section} />;
}
