import { useEffect } from "react";

function setMetaTag(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
}

/** Sets the document title and description on mount so each public
 * route is distinguishable to search engines - this is a client-side
 * SPA with no server rendering, so without this every page would share
 * the same <title>/meta description from index.html. */
export function useDocumentMeta(title, description) {
  useEffect(() => {
    const previousTitle = document.title;

    document.title = title;
    if (description) setMetaTag("description", description);

    return () => {
      document.title = previousTitle;
    };
  }, [title, description]);
}
