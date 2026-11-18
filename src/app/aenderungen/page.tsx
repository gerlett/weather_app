import type { Metadata } from "next";
import { ChangelogPage } from "@/components/ChangelogPage";

export const metadata: Metadata = {
  title: "Änderungen · Wetter",
  description: "Was sich auf der Website von Version zu Version geändert hat.",
};

export default function Page() {
  return <ChangelogPage />;
}
