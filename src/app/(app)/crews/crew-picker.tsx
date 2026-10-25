"use client";

import { useRouter } from "next/navigation";
import { CrewList, type CrewListItem } from "@/ui/CrewList";
import { useToast } from "@/ui/Toast";

/** The crew list on Find a crew: joining switches the phone to that crew and goes Home. */
export function CrewPicker({ crews }: { crews: CrewListItem[] }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <CrewList
      crews={crews}
      onJoined={(crew) => {
        toast(`You're in ${crew.name}.`);
        router.replace("/");
        router.refresh();
      }}
    />
  );
}
