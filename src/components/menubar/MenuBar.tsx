import { Toolbar } from "react-aria-components";
import { cx } from "../ui/cx";
import { AppMenu } from "./AppMenu";
import { EditMenu } from "./EditMenu";
import { FileMenu } from "./FileMenu";
import styles from "./MenuBar.module.css";
import { ViewMenu } from "./ViewMenu";

export function MenuBar() {
  return (
    <Toolbar aria-label="Menu bar" className={styles.menuBar}>
      <AppMenu className={cx(styles.menuTitle, styles.brand)} />
      <FileMenu className={styles.menuTitle} />
      <EditMenu className={styles.menuTitle} />
      <ViewMenu className={styles.menuTitle} />
    </Toolbar>
  );
}
