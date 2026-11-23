import { router } from "../trpc";
import { searchByIdProcedure } from "./search/search-by-id";
import { searchQueryProcedure } from "./search/search-query";

export type { SearchResult } from "./search/scope";

export const searchRouter = router({
  searchById: searchByIdProcedure,
  query: searchQueryProcedure,
});
