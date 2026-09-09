import React from "react";

export default function Example({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <article>
      <strong>{title}</strong>
      <p>{children}</p>
    </article>
  );
}
