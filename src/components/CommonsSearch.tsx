import { useRef, useState } from "react";
import {
  Dialog,
  Form,
  GridList,
  GridListItem,
  Heading,
  Input,
  Modal,
  ModalOverlay,
  SearchField,
} from "react-aria-components";
import { type CommonsResult, downloadCommons, searchCommons } from "../commons";
import type { Credit } from "../types";
import { Button } from "./ui/Button";
import { Switch } from "./ui/Switch";

export interface CommonsSearchProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAdd: (file: File, credit: Credit) => Promise<void>;
}

export function CommonsSearch({
  isOpen,
  onOpenChange,
  onAdd,
}: CommonsSearchProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CommonsResult[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noAttributionOnly, setNoAttributionOnly] = useState(false);
  // The query behind the results shown, so "Load more" continues it even if
  // the search box has been edited since.
  const [shownQuery, setShownQuery] = useState<{
    search: string;
    noAttributionOnly: boolean;
  } | null>(null);
  // Only the newest request's response is used; slower, older ones are dropped.
  const latestRequest = useRef(0);

  async function runSearch(query: {
    search: string;
    noAttributionOnly: boolean;
    offset: number;
  }) {
    const trimmed = query.search.trim();
    if (!trimmed) return;
    const request = ++latestRequest.current;
    setIsSearching(true);
    setError(null);
    try {
      const page = await searchCommons(trimmed, {
        offset: query.offset,
        noAttributionOnly: query.noAttributionOnly,
      });
      if (request !== latestRequest.current) return;
      setResults((current) => {
        if (query.offset === 0) return page.results;
        // Pages can overlap when Commons reorders between requests.
        const seen = new Set(current.map((result) => result.title));
        return [
          ...current,
          ...page.results.filter((result) => !seen.has(result.title)),
        ];
      });
      setNextOffset(page.nextOffset);
      setShownQuery({
        search: trimmed,
        noAttributionOnly: query.noAttributionOnly,
      });
      setHasSearched(true);
    } catch {
      if (request !== latestRequest.current) return;
      setError("Couldn’t reach Wikimedia Commons. Try again.");
    } finally {
      if (request === latestRequest.current) setIsSearching(false);
    }
  }

  async function add(result: CommonsResult) {
    setAdding(result.title);
    setError(null);
    try {
      await onAdd(await downloadCommons(result), result.credit);
      onOpenChange(false);
    } catch {
      setError("Couldn’t download that image. Try another.");
    } finally {
      setAdding(null);
    }
  }

  return (
    <ModalOverlay
      className="modal-overlay"
      isDismissable
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Modal className="modal commons-modal">
        <Dialog className="commons-search">
          <div className="section-heading">
            <Heading slot="title">Wikimedia Commons</Heading>
            <Button variant="quiet" slot="close">
              Close
            </Button>
          </div>
          <Form
            className="commons-form"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch({ search, noAttributionOnly, offset: 0 });
            }}
          >
            <SearchField
              aria-label="Search openly licensed photos"
              value={search}
              onChange={setSearch}
              autoFocus
            >
              <Input placeholder="Search openly licensed photos" />
            </SearchField>
            <Button type="submit" isDisabled={isSearching || !search.trim()}>
              {isSearching ? "Searching…" : "Search"}
            </Button>
          </Form>
          <Switch
            isSelected={noAttributionOnly}
            onChange={(isSelected) => {
              setNoAttributionOnly(isSelected);
              // Re-runs the search on screen with the new filter.
              if (shownQuery) {
                runSearch({
                  search: shownQuery.search,
                  noAttributionOnly: isSelected,
                  offset: 0,
                });
              }
            }}
          >
            No attribution required
          </Switch>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <GridList
            aria-label="Results"
            className="commons-results"
            layout="grid"
            items={results}
            disabledKeys={adding ? results.map((result) => result.title) : []}
            onAction={(key) => {
              const result = results.find((option) => option.title === key);
              if (result) add(result);
            }}
            renderEmptyState={() =>
              hasSearched && !isSearching ? (
                <p className="hint">No photos found.</p>
              ) : null
            }
          >
            {(result) => (
              <GridListItem
                className="commons-result"
                id={result.title}
                textValue={`${result.credit.title}, ${result.credit.license}`}
              >
                <img
                  className="commons-thumb"
                  src={result.thumbnail}
                  alt=""
                  loading="lazy"
                />
                <span className="commons-license">
                  {adding === result.title ? "Adding…" : result.credit.license}
                </span>
              </GridListItem>
            )}
          </GridList>
          {nextOffset !== null && (
            <Button
              onPress={() =>
                shownQuery && runSearch({ ...shownQuery, offset: nextOffset })
              }
              isDisabled={isSearching}
            >
              {isSearching ? "Loading…" : "Load more"}
            </Button>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
