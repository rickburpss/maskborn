export function PageIntro({
  index,
  eyebrow,
  title,
  copy,
}: {
  index: string;
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <section className="page-intro shell">
      <div className="page-number">{index}</div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <p className="page-copy">{copy}</p>
    </section>
  );
}
