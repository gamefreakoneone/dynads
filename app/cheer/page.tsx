import type { Metadata } from "next";
import { CheerExperience } from "@/components/cheer/cheer-experience";

export const metadata: Metadata = { title: "Cheer for your team · Dynads", description: "Your movement brings the team back to life." };
export default function CheerPage() { return <CheerExperience />; }
