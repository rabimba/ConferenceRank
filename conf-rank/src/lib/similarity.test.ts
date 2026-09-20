import test from "node:test";
import assert from "node:assert/strict";
import {
  similarity,
  buildVenueDoc,
  indexVenueDocuments,
  type IndexableVenueInput,
} from "./similarity.ts";
import { suggestVenues, type SuggesterVenue } from "./suggest.ts";

test("similarity indexing supports both conferences and journals with type tag", () => {
  const venues: IndexableVenueInput[] = [
    {
      id: "conf-1",
      title: "Conference on Neural Information Processing Systems",
      acronym: "NeurIPS",
      categories: ["Machine Learning", "Artificial Intelligence"],
      topics: ["Deep Learning", "Transformers"],
      type: "conference",
    },
    {
      id: "journal-1",
      title: "Journal of Machine Learning Research",
      acronym: "JMLR",
      categories: ["Machine Learning"],
      topics: ["Supervised Learning", "Deep Learning"],
      type: "journal",
    },
  ];

  const docs = venues.map(buildVenueDoc);
  assert.equal(docs[0].type, "conference");
  assert.equal(docs[1].type, "journal");

  const index = indexVenueDocuments(venues);
  assert.equal(index.docs.size, 2);
  assert.equal(index.docs.get("conf-1")?.type, "conference");
  assert.equal(index.docs.get("journal-1")?.type, "journal");

  const confSim = similarity(index, "conf-1", "deep learning and transformers in neural systems");
  const journalSim = similarity(index, "journal-1", "deep learning and machine learning research");
  assert.ok(confSim > 0);
  assert.ok(journalSim > 0);
});

test("suggestVenues filters accurately by venueType", () => {
  const mixedVenues: SuggesterVenue[] = [
    {
      id: "icml",
      type: "conference",
      acronym: "ICML",
      title: "International Conference on Machine Learning",
      rank: "A*",
      core_rank: null,
      sjr_quartile: null,
      categories: ["Machine Learning"],
      latest_rate: 21.5,
      latest_accepted: 1200,
      has_stats: true,
      topics: ["Deep Learning", "Optimization"],
    },
    {
      id: "jmlr",
      type: "journal",
      acronym: "JMLR",
      title: "Journal of Machine Learning Research",
      rank: "A*",
      core_rank: "A*",
      sjr_quartile: "Q1",
      categories: ["Machine Learning"],
      latest_rate: null,
      latest_accepted: null,
      has_stats: false,
      topics: ["Statistical Learning", "Neural Networks"],
    },
    {
      id: "tods",
      type: "journal",
      acronym: "TODS",
      title: "ACM Transactions on Database Systems",
      rank: "A*",
      core_rank: "A*",
      sjr_quartile: "Q1",
      categories: ["Data Management & Mining"],
      latest_rate: null,
      latest_accepted: null,
      has_stats: false,
      topics: ["Relational Databases", "Indexing"],
    },
  ];

  const abstract =
    "We present a novel deep learning neural network model for machine learning optimization. Our empirical evaluation demonstrates significant improvements in statistical convergence across standard benchmarks. Furthermore, we analyze gradient dynamics, loss surface geometry, and generalization error across multiple large-scale benchmark datasets.";

  const allResult = suggestVenues(abstract, mixedVenues, {
    ambition: "all",
    venueType: "all",
    topN: 10,
  });
  assert.ok(allResult.suggestions.length >= 2);
  const typesInAll = new Set(allResult.suggestions.map((s) => s.venue.type));
  assert.ok(typesInAll.has("conference"));
  assert.ok(typesInAll.has("journal"));

  const confResult = suggestVenues(abstract, mixedVenues, {
    ambition: "all",
    venueType: "conference",
    topN: 10,
  });
  assert.ok(confResult.suggestions.length >= 1);
  assert.ok(confResult.suggestions.every((s) => s.venue.type === "conference"));

  const journalResult = suggestVenues(abstract, mixedVenues, {
    ambition: "all",
    venueType: "journal",
    topN: 10,
  });
  assert.ok(journalResult.suggestions.length >= 1);
  assert.ok(journalResult.suggestions.every((s) => s.venue.type === "journal"));
});
