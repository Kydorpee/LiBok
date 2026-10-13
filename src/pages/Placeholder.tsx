import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router";

/** Página provisória — substituída na parte B pelas telas reais. */
export function Placeholder({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} · LiBok`;
  }, [title]);
  const params = useParams();
  const [search] = useSearchParams();
  const details = [...Object.entries(params), ...search.entries()].map(([k, v]) => `${k}=${v}`).join(" · ");
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{title}</h1>
      {details && <p>{details}</p>}
    </section>
  );
}
