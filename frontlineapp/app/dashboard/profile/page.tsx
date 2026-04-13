import type { Metadata } from "next";
import { ProfileView } from "@/components/dashboard/ProfileView";

export const metadata: Metadata = {
  title: "Profile — Frontline",
  description: "Connected wallet profile, HBAR balance, and HTS token holdings.",
};

export default function ProfilePage() {
  return <ProfileView />;
}
