import Grid, { GridItem } from "../layout/Grid.jsx";
import ArticleCard from "../layout/ArticleCard.jsx";
import Card from "../layout/Card.jsx";
import React from "react";
import {useLocale} from "../locale/index.js";

function DefaultArticleTemplate({ record, query }) {
  if (!record) return null;
  const metadata = Array.isArray(record.metadata) ? record.metadata : [];
  return (
    <ArticleCard
      href={record.href}
      title={record.title || record.href || 'Untitled'}
      annotation={record.annotation}
      summary={record.summary || record.summaryValue || ''}
      summaryMarkdown={record.summaryMarkdown || record.summary || record.summaryValue || ''}
      metadata={metadata}
      query={query}
      recordType={record.type}
    />
  );
}

function DefaultFigureTemplate({ record, thumbnailAspectRatio }) {
  if (!record) return null;
  const hasDims =
    Number.isFinite(Number(record.thumbnailWidth)) &&
    Number(record.thumbnailWidth) > 0 &&
    Number.isFinite(Number(record.thumbnailHeight)) &&
    Number(record.thumbnailHeight) > 0;
  const aspect = Number.isFinite(Number(thumbnailAspectRatio)) && Number(thumbnailAspectRatio) > 0
    ? Number(thumbnailAspectRatio)
    : hasDims
      ? Number(record.thumbnailWidth) / Number(record.thumbnailHeight)
      : undefined;
  return (
    <Card
      href={record.href}
      title={record.title || record.href}
      src={record.type === 'work' ? record.thumbnail : undefined}
      imgWidth={record.thumbnailWidth}
      imgHeight={record.thumbnailHeight}
      aspectRatio={aspect}
    />
  );
}

export default function SearchResults({
  results = [],
  type = "all",
  layout = "grid",
  query = "",
  templates = {},
  variant = "auto",
}) {
  const {getString} = useLocale();
  const resultsRegionLabel = getString(
    "common.phrases.results_label",
    "Search results",
  );
  const noResultsLabel = getString(
    "common.statuses.no_matches",
    "No matches found.",
  );
  if (!results.length) {
    return (
      <div className="text-gray-800">
        <em>{noResultsLabel}</em>
      </div>
    );
  }

  const normalizedType = String(type || 'all').toLowerCase();
  const normalizedVariant =
    variant === 'figure' || variant === 'article' ? variant : 'auto';
  const isAnnotationView = normalizedType === "annotation";
  const FigureTemplate = templates && templates.figure ? templates.figure : DefaultFigureTemplate;
  const ArticleTemplate = templates && templates.article ? templates.article : DefaultArticleTemplate;

  if (isAnnotationView) {
    return (
      <div id="search-results" className="space-y-4" role="region" aria-label={resultsRegionLabel}>
        {results.map((r, i) => {
          if (!r) return null;
          return (
            <ArticleTemplate
              key={r.id || i}
              record={r}
              query={query}
              layout={layout}
            />
          );
        })}
      </div>
    );
  }

  const isWorkRecord = (record) => String(record && record.type).toLowerCase() === 'work';

  const shouldRenderAsArticle = (record) => {
    if (normalizedVariant === 'article') return true;
    if (normalizedVariant === 'figure') return false;
    return !isWorkRecord(record) || normalizedType !== 'work';
  };

  if (layout === "list") {
    return (
      <div id="search-results" className="space-y-6" role="region" aria-label={resultsRegionLabel}>
        {results.map((r, i) => {
          if (shouldRenderAsArticle(r)) {
            return (
              <div key={i} className={`search-result ${r && r.type}`}>
                <ArticleTemplate record={r} query={query} layout={layout} />
              </div>
            );
          }
          const hasDims =
            Number.isFinite(Number(r.thumbnailWidth)) &&
            Number(r.thumbnailWidth) > 0 &&
            Number.isFinite(Number(r.thumbnailHeight)) &&
            Number(r.thumbnailHeight) > 0;
          const aspect = hasDims
            ? Number(r.thumbnailWidth) / Number(r.thumbnailHeight)
            : undefined;
          return (
            <div
              key={i}
              className={`search-result ${r.type}`}
              data-thumbnail-aspect-ratio={aspect}
            >
              <FigureTemplate
                record={r}
                query={query}
                layout={layout}
                thumbnailAspectRatio={aspect}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Default: grid (masonry)
  return (
    <div id="search-results" role="region" aria-label={resultsRegionLabel}>
      <Grid>
        {results.map((r, i) => {
          if (shouldRenderAsArticle(r)) {
            return (
              <GridItem key={i} className={`search-result ${r && r.type}`}>
                <ArticleTemplate record={r} query={query} layout={layout} />
              </GridItem>
            );
          }
          const hasDims =
            Number.isFinite(Number(r.thumbnailWidth)) &&
            Number(r.thumbnailWidth) > 0 &&
            Number.isFinite(Number(r.thumbnailHeight)) &&
            Number(r.thumbnailHeight) > 0;
          const aspect = hasDims
            ? Number(r.thumbnailWidth) / Number(r.thumbnailHeight)
            : undefined;
          return (
            <GridItem
              key={i}
              className={`search-result ${r.type}`}
              data-thumbnail-aspect-ratio={aspect}
            >
              <FigureTemplate
                record={r}
                query={query}
                layout={layout}
                thumbnailAspectRatio={aspect}
              />
            </GridItem>
          );
        })}
      </Grid>
    </div>
  );
}
