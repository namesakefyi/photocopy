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
import {
  downloadOpenverse,
  type OpenverseResult,
  searchErrorMessage,
  searchOpenverse,
} from "../openverse";
import type { Credit } from "../types";
import { Button } from "./ui/Button";

export interface ImageSearchProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAdd: (file: File, credit: Credit) => Promise<void>;
}

export function ImageSearch({ isOpen, onOpenChange, onAdd }: ImageSearchProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<OpenverseResult[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The search behind the results shown, so "Load more" continues it even if
  // the search box has been edited since.
  const [shownSearch, setShownSearch] = useState<string | null>(null);
  // Only the newest request's response is used; slower, older ones are dropped.
  const latestRequest = useRef(0);

  async function runSearch(search: string, page: number) {
    const trimmed = search.trim();
    if (!trimmed) return;
    const request = ++latestRequest.current;
    setIsSearching(true);
    setError(null);
    try {
      const found = await searchOpenverse(trimmed, { page });
      if (request !== latestRequest.current) return;
      setResults((current) => {
        if (page === 1) return found.results;
        // Pages can overlap when results reorder between requests.
        const seen = new Set(current.map((result) => result.id));
        return [
          ...current,
          ...found.results.filter((result) => !seen.has(result.id)),
        ];
      });
      setNextPage(found.nextPage);
      setShownSearch(trimmed);
      setHasSearched(true);
    } catch (error) {
      if (request !== latestRequest.current) return;
      setError(searchErrorMessage(error));
    } finally {
      if (request === latestRequest.current) setIsSearching(false);
    }
  }

  async function add(result: OpenverseResult) {
    setAdding(result.id);
    setError(null);
    try {
      await onAdd(await downloadOpenverse(result), result.credit);
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
      <Modal className="modal image-search-modal">
        <Dialog className="image-search">
          <div className="section-heading">
            <Heading slot="title">Search Openverse</Heading>
            <Button variant="quiet" slot="close">
              Close
            </Button>
          </div>
          <Form
            className="image-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch(search, 1);
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
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <GridList
            aria-label="Results"
            className="image-search-results"
            layout="grid"
            items={results}
            disabledKeys={adding ? results.map((result) => result.id) : []}
            onAction={(key) => {
              const result = results.find((option) => option.id === key);
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
                className="image-search-result"
                id={result.id}
                textValue={`${result.credit.title}, ${result.credit.license}`}
              >
                <img
                  className="image-search-thumb"
                  src={result.thumbnail}
                  alt=""
                  loading="lazy"
                />
                <span className="image-search-license">
                  {adding === result.id ? "Adding…" : result.credit.license}
                </span>
              </GridListItem>
            )}
          </GridList>
          {nextPage !== null && (
            <Button
              onPress={() => shownSearch && runSearch(shownSearch, nextPage)}
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
