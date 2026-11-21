import {
  Tab as AriaTab,
  TabList as AriaTabList,
  type TabListProps as AriaTabListProps,
  TabPanel as AriaTabPanel,
  type TabPanelProps as AriaTabPanelProps,
  type TabProps as AriaTabProps,
  Tabs as AriaTabs,
  type TabsProps as AriaTabsProps,
} from "react-aria-components";
import styles from "./Tabs.module.css";

export function Tabs(props: Omit<AriaTabsProps, "className">) {
  return <AriaTabs {...props} className={styles.tabs} />;
}

/** Scrolls sideways rather than wrapping when the tabs don't fit. */
export function TabList<T extends object>(
  props: Omit<AriaTabListProps<T>, "className">,
) {
  return <AriaTabList {...props} className={styles.tabList} />;
}

export function Tab(props: Omit<AriaTabProps, "className">) {
  return <AriaTab {...props} className={styles.tab} />;
}

export function TabPanel(props: Omit<AriaTabPanelProps, "className">) {
  return <AriaTabPanel {...props} className={styles.panel} />;
}
