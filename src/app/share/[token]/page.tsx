"use client";

import { useParams } from "next/navigation";
import { AudiencePlayer } from "@/app/present/[id]/page";

export default function SharedPage() {
  const { token } = useParams<{ token: string }>();
  return <AudiencePlayer shareToken={token} />;
}
