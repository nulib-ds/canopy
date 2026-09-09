import React, {useEffect, useState} from "react";

export default function ExampleClient({text}: {text?: string}) {
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    const handle = () => setViewportWidth(window.innerWidth || null);
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  return (
    <div>
      <p>
        This component is running in browser only as it requires access to the
        browser window and cannot safely be rendered at build time.
      </p>
      {text && <p>{text}</p>}
      <em>Viewport width: {viewportWidth ? `${viewportWidth}px` : "..."}</em>
    </div>
  );
}
