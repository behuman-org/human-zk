import { createElement, type CSSProperties, type ReactNode } from "react";
import { useInView } from "../../hooks/useInView";
import "./ScrollReveal.css";

type ScrollRevealElement = "div" | "article" | "li" | "blockquote" | "section";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ScrollRevealElement;
  id?: string;
}

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  as = "div",
  id,
}: ScrollRevealProps) {
  const { ref, inView } = useInView();

  return createElement(
    as,
    {
      ref,
      id,
      className: `scroll-reveal ${inView ? "is-visible" : ""} ${className}`.trim(),
      style: { "--reveal-delay": `${delay}ms` } as CSSProperties,
    },
    children,
  );
}
