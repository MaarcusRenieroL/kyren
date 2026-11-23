import { useEffect, useState } from "react";
import { useTrpcClient } from "@zentro/api/react";
import type { Person } from "../composer";

/** The people in a conversation, plus everyone else, for mentions. */
export function usePeople() {
  const trpc = useTrpcClient();
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    let live = true;
    trpc.chat.people
      .query()
      .then((rows) => live && setPeople(rows))
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [trpc]);

  return people;
}
