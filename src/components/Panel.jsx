export default function Panel({ title, children, variant = "default" }) {
  return (
    <section className={`panel panel-${variant}`}>
      {title ? <h2 className="panel-title">{title}</h2> : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}
