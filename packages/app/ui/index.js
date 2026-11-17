export {HelloWorld} from "./src/HelloWorld.jsx";
export {default as Card} from "./src/layout/Card.jsx";
export {default as ArticleCard} from "./src/layout/ArticleCard.jsx";
export {default as Grid, GridItem} from "./src/layout/Grid.jsx";
export {default as Container} from "./src/layout/Container.jsx";
export {default as Button} from "./src/layout/Button.jsx";
export {default as ButtonWrapper} from "./src/layout/ButtonWrapper.jsx";
export {default as Swoosh} from "./src/layout/Swoosh.jsx";
export {default as Band} from "./src/layout/Band.jsx";
export {default as Feature} from "./src/layout/Feature.jsx";
export {default as CanopyHeader} from "./src/layout/CanopyHeader.jsx";
export {default as CanopyFooter} from "./src/layout/CanopyFooter.jsx";
export {default as LanguageToggle} from "./src/layout/LanguageToggle.jsx";
export {default as AppearanceToggle} from "./src/layout/AppearanceToggle.jsx";
export {default as CanopyBrand} from "./src/layout/CanopyBrand.jsx";
export {default as CanopyModal} from "./src/layout/CanopyModal.jsx";
export {default as TeaserCard} from "./src/layout/TeaserCard.jsx";
export {default as GoogleAnalytics} from "./src/layout/GoogleAnalytics.jsx";
export {Viewer} from "./src/iiif/Viewer.jsx";
export {Slider} from "./src/iiif/Slider.jsx";
export {Scroll} from "./src/iiif/Scroll.jsx";
export {Image} from "./src/iiif/Image.jsx";
export {ImageStory} from "./src/iiif/ImageStory.jsx";
export {Id} from "./src/iiif/Properties/Id.jsx";
export {
  mergeSliderOptions,
  normalizeSliderOptions,
  rem,
  sliderOptions,
} from "./src/iiif/sliderOptions.js";
export {mountImageStory} from "./src/iiif/imageStoryRuntime.js";
// New: RelatedItems placeholder (new data attribute)
export {default as RelatedItems} from "./src/iiif/MdxRelatedItems.jsx";
// Search UI (React)
export {default as SearchResults} from "./src/search/MdxSearchResults.jsx";
export {default as SearchSummary} from "./src/search/SearchSummary.jsx";
export {default as SearchTabs} from "./src/search/MdxSearchTabs.jsx";
export {default as Search} from "./src/search/MdxSearch.jsx";

export {default as SearchResultsUI} from "./src/search/SearchResults.jsx";
export {default as SearchTabsUI} from "./src/search/SearchTabs.jsx";
export {default as SearchFiltersDialog} from "./src/search/SearchFiltersDialog.jsx";
// Removed deprecated exports: useSearch, Search placeholder
// Search form modal placeholder (SSR-safe). Client runtime hydrates with the search form app.
export {default as SearchFormModal} from "./src/search-form/MdxSearchFormModal.jsx";
// Search panel (SSR-safe) and its parts
export {default as SearchPanel} from "./src/search/SearchPanel.jsx";
export {default as SearchPanelForm} from "./src/search/SearchPanelForm.jsx";
export {default as SearchPanelTeaserResults} from "./src/search/SearchPanelTeaserResults.jsx";
export {default as DocsMarkdownTable} from "./src/docs/MarkdownTable.jsx";
export {CanopyDiagram} from "./src/docs/Diagram.jsx";
export {default as Timeline} from "./src/content/timeline/Timeline.jsx";
export {default as TimelinePoint} from "./src/content/timeline/TimelinePoint.jsx";
export {default as Map} from "./src/content/map/Map.jsx";
export {default as MapPoint} from "./src/content/map/MapPoint.jsx";
export {
  default as Gallery,
  GalleryItem,
  GalleryContent,
} from "./src/content/gallery/Gallery.jsx";
// Clover 4, from the runtimes: Canopy's 1.x props translated, and each part drawn from
// the module a runtime loads on demand.
export {
  cloverImage,
  cloverScroll,
  cloverSlider,
  cloverViewer,
  toCanvasProps,
  toItemsProps,
  toViewerProps,
  unsupportedOptions,
} from "./src/iiif/clover-compat.js";
