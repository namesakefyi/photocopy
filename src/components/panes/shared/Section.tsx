import { createContext, useContext, useId } from "react";
import { ChevronIcon } from "../../ui/icons";
import styles from "./Section.module.css";

/** In the side strip sections collapse; the phone toolbar shows one at a time, open. */
export const SectionLayoutContext = createContext<"collapsible" | "panel">(
  "collapsible",
);

const HeadingIdContext = createContext("");

export function Section({ children }: { children: React.ReactNode }) {
  const headingId = useId();
  const content = (
    <HeadingIdContext value={headingId}>{children}</HeadingIdContext>
  );
  if (useContext(SectionLayoutContext) === "panel") {
    return <section aria-labelledby={headingId}>{content}</section>;
  }
  return (
    <details className={styles.section} open>
      {content}
    </details>
  );
}

export function SectionHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  const heading = (
    <h2 id={useContext(HeadingIdContext)} className={styles.title}>
      {title}
    </h2>
  );
  if (useContext(SectionLayoutContext) === "panel") {
    return (
      <div className={styles.panelHeading}>
        {heading}
        {children}
      </div>
    );
  }
  return (
    <>
      <summary className={styles.heading}>
        {heading}
        <ChevronIcon className={styles.chevron} />
      </summary>
      {children && <div className={styles.action}>{children}</div>}
    </>
  );
}

export function SectionBody({ children }: { children: React.ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}
