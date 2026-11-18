import { useState } from "react";
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

  async function runSearch(offset = 0, onlyNoAttribution = noAttributionOnly) {
    const trimmed = search.trim();
    if (!trimmed) return;
    setIsSearching(true);
    setError(null);
    try {
      const page = await searchCommons(trimmed, {
        offset,
        noAttributionOnly: onlyNoAttribution,
      });
      setResults((current) =>
        offset === 0 ? page.results : [...current, ...page.results],
      );
      setNextOffset(page.nextOffset);
      setHasSearched(true);
    } catch {
      setError("Couldn’t reach Wikimedia Commons. Try again.");
    } finally {
      setIsSearching(false);
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
              runSearch();
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
              if (hasSearched) runSearch(0, isSelected);
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
              onPress={() => runSearch(nextOffset)}
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
