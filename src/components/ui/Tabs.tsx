import {
  Tab as AriaTab,
  TabList as AriaTabList,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
} from "react-aria-components";
import { withClassName } from "./cx";
import styles from "./Tabs.module.css";

export const Tabs = withClassName(AriaTabs, styles.tabs);
export const TabList = withClassName(AriaTabList, styles.tabList);
export const Tab = withClassName(AriaTab, styles.tab);
export const TabPanel = withClassName(AriaTabPanel, styles.panel);
