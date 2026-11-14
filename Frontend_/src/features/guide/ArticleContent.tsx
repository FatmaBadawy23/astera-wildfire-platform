import type { GuideArticle } from "./guideArticles";

/** An article's plain-language text, with its technical details collapsed underneath. */
export function ArticleContent({ article }: { article: GuideArticle }) {
  return (
    <div className="grid gap-2 [&_strong]:font-semibold [&_strong]:text-foreground-strong">
      {article.body}
      {article.technical && (
        <details className="rounded-md border border-border bg-background px-3 py-1">
          <summary className="min-h-9 cursor-pointer py-1.5 text-sm font-medium text-primary">Technical details</summary>
          <div className="grid gap-2 pb-2 text-sm">{article.technical}</div>
        </details>
      )}
    </div>
  );
}
