import { memo, useRef, useState } from "react";
import {
  Dialog,
  Form,
  GridList,
  GridListItem,
  Input,
  type Key,
  Modal,
  ModalOverlay,
  SearchField,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "react-aria-components";
import {
  type ImageResult,
  type ImageSource,
  searchErrorMessage,
} from "../core/imageSearch";
import { IMAGE_SOURCES } from "../core/sources";
import { useEditor } from "../hooks/useEditor";
import { Button } from "./ui/Button";
import { XIcon } from "./ui/icons";
import { ToolButton } from "./ui/ToolButton";

export interface ImageSearchProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

interface TabState {
  /** The search behind the results, so "Load more" continues it. */
  search: string;
  results: ImageResult[];
  nextPage: number | null;
  isSearching: boolean;
  error: string | null;
}

const emptyTab: TabState = {
  search: "",
  results: [],
  nextPage: null,
  isSearching: false,
  error: null,
};

export const ImageSearch = memo(function ImageSearch({
  isOpen,
  onOpenChange,
}: ImageSearchProps) {
  const { addFiles } = useEditor();
  const [search, setSearch] = useState("");
  // The last search submitted, which a tab runs when it's opened.
  const [submitted, setSubmitted] = useState("");
  const [sourceId, setSourceId] = useState(IMAGE_SOURCES[0].id);
  const [tabs, setTabs] = useState<Record<string, TabState>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  // Per source, a new request cancels the one before it.
  const requests = useRef<Record<string, AbortController>>({});

  function updateTab(id: string, changes: Partial<TabState>) {
    setTabs((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyTab), ...changes },
    }));
  }

  async function runSearch(source: ImageSource, search: string, page: number) {
    requests.current[source.id]?.abort();
    const request = new AbortController();
    requests.current[source.id] = request;
    const isLatest = () => !request.signal.aborted;
    updateTab(source.id, {
      isSearching: true,
      error: null,
      ...(page === 1 && { search, results: [], nextPage: null }),
    });
    try {
      const found = await source.search(search, page, request.signal);
      if (!isLatest()) return;
      setTabs((current) => {
        const tab = current[source.id] ?? emptyTab;
        // Pages can overlap when results reorder between requests.
        const seen = new Set(tab.results.map((result) => result.id));
        const results =
          page === 1
            ? found.results
            : [
                ...tab.results,
                ...found.results.filter((result) => !seen.has(result.id)),
              ];
        return {
          ...current,
          [source.id]: {
            ...tab,
            search,
            results,
            nextPage: found.nextPage,
            isSearching: false,
          },
        };
      });
    } catch (error) {
      if (!isLatest()) return;
      updateTab(source.id, {
        isSearching: false,
        error: searchErrorMessage(error, source.name),
      });
    }
  }

  function selectSource(key: Key) {
    const source = IMAGE_SOURCES.find((option) => option.id === key);
    if (!source) return;
    setSourceId(source.id);
    setAddError(null);
    const tab = tabs[source.id];
    if (submitted && tab?.search !== submitted && !tab?.isSearching) {
      runSearch(source, submitted, 1);
    }
  }

  async function add(result: ImageResult) {
    setAdding(result.id);
    setAddError(null);
    try {
      await addFiles([await result.download()], result.credit);
      onOpenChange(false);
    } catch {
      setAddError("Couldn’t download that image. Try another.");
    } finally {
      setAdding(null);
    }
  }

  const source =
    IMAGE_SOURCES.find((option) => option.id === sourceId) ?? IMAGE_SOURCES[0];
  const tab = tabs[source.id] ?? emptyTab;
  const error = addError ?? tab.error;

  return (
    <ModalOverlay
      className="modal-overlay"
      isDismissable
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Modal className="modal image-search-modal">
        <Dialog className="image-search" aria-label="Search images">
          <div className="image-search-header">
            <Form
              className="image-search-form"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = search.trim();
                if (!trimmed) return;
                setSubmitted(trimmed);
                setAddError(null);
                runSearch(source, trimmed, 1);
              }}
            >
              <SearchField
                aria-label="Search openly licensed images"
                value={search}
                onChange={setSearch}
                autoFocus
              >
                <Input placeholder="Search openly licensed images" />
              </SearchField>
              <Button
                type="submit"
                isDisabled={tab.isSearching || !search.trim()}
              >
                {tab.isSearching ? "Searching…" : "Search"}
              </Button>
            </Form>
            <ToolButton label="Close" slot="close">
              <XIcon />
            </ToolButton>
          </div>
          <Tabs
            className="image-search-tabs"
            selectedKey={source.id}
            onSelectionChange={selectSource}
          >
            <TabList
              aria-label="Collections"
              className="image-search-tab-list"
              items={IMAGE_SOURCES}
            >
              {(option) => (
                <Tab className="image-search-tab" id={option.id}>
                  {option.label}
                </Tab>
              )}
            </TabList>
            {IMAGE_SOURCES.map((option) => (
              <TabPanel
                key={option.id}
                id={option.id}
                className="image-search-panel"
              >
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                <GridList
                  aria-label={`Results from ${source.name}`}
                  className="image-search-results"
                  layout="grid"
                  items={tab.results}
                  disabledKeys={
                    adding ? tab.results.map((result) => result.id) : []
                  }
                  onAction={(key) => {
                    const result = tab.results.find(
                      (option) => option.id === key,
                    );
                    if (result) add(result);
                  }}
                  renderEmptyState={() => (
                    <p className="hint">
                      {tab.isSearching
                        ? "Searching…"
                        : tab.search
                          ? `No images found for “${tab.search}” in ${source.name}.`
                          : `Search public domain and openly licensed images from ${source.name}.`}
                    </p>
                  )}
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
                        {adding === result.id
                          ? "Adding…"
                          : result.credit.license}
                      </span>
                    </GridListItem>
                  )}
                </GridList>
                {tab.nextPage !== null && (
                  <Button
                    onPress={() =>
                      tab.nextPage &&
                      runSearch(source, tab.search, tab.nextPage)
                    }
                    isDisabled={tab.isSearching}
                  >
                    {tab.isSearching ? "Loading…" : "Load more"}
                  </Button>
                )}
              </TabPanel>
            ))}
          </Tabs>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
});
