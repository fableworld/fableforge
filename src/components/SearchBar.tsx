import { useAtom } from "jotai";
import { Search, ArrowDownAZ, ArrowUpAZ, Calendar } from "lucide-react";
import { searchQueryAtom, sortOrderAtom } from "@/stores/registries";

export function SearchBar() {
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [sort, setSort] = useAtom(sortOrderAtom);

  return (
    <div className="search-bar">
      <div className="search-bar__input-wrapper">
        <Search size={16} className="search-bar__icon" />
        <input
          type="text"
          className="search-bar__input"
          placeholder="Search characters..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="search-bar__controls">
        <button
          className={`btn btn--ghost btn--sm ${sort === "name-asc" ? "btn--active" : ""}`}
          onClick={() => setSort(sort === "name-asc" ? "name-desc" : "name-asc")}
          title="Sort by name"
        >
          {sort === "name-desc" ? <ArrowUpAZ size={16} /> : <ArrowDownAZ size={16} />}
        </button>
        <button
          className={`btn btn--ghost btn--sm ${sort.startsWith("date") ? "btn--active" : ""}`}
          onClick={() => setSort(sort === "date-desc" ? "date-asc" : "date-desc")}
          title="Sort by date"
        >
          <Calendar size={16} />
        </button>
      </div>
    </div>
  );
}
