/**
 * Data sources the project plans to use but that are NOT connected (docs/data/DATA_SOURCES.md). They are listed so
 * people know what is coming, never as datasets: no records, no dates, and they can't be linked to a project.
 * When a source is connected (roadmap Stage 6, via the backend), remove it here and add its datasets to the catalog.
 */
import type { DataSourceEntry } from "@/data/types";

export const NOT_CONNECTED_SOURCES: DataSourceEntry[] = [
  {
    id: "source-nasa-firms",
    name: "NASA FIRMS active-fire detections",
    provider: "NASA",
    kind: "active-fire-points",
    status: "not-connected",
    provides: "Real heat-spot detections from satellites (thermal anomalies), for finding possible fires.",
    needs: ["A backend that requests the data (the access key must stay on a server).", "A free FIRMS map key.", "Data discovery module (roadmap Stage 6)."],
    terms: "NASA open data terms",
    notes: ["Heat spots are thermal anomalies, never confirmed fires or burned area."],
  },
  {
    id: "source-nisar",
    name: "NASA–ISRO NISAR radar products (GCOV, GSLC)",
    provider: "NASA–ISRO, via the Alaska Satellite Facility (ASF)",
    kind: "sar-scene",
    status: "not-connected",
    provides: "Real L-band and S-band radar scenes for surface-change analysis.",
    needs: [
      "A backend with an Earthdata login (credentials stay on a server).",
      "Readers and checks for the products (roadmap Stage 3); the product layout is not verified yet.",
      "Data discovery module (roadmap Stage 6).",
    ],
    terms: "NASA open data",
    notes: ["L-band and S-band are kept separate; a band is never assumed."],
  },
  {
    id: "source-sentinel-1",
    name: "Copernicus Sentinel-1 radar (C-band)",
    provider: "ESA Copernicus, via the Copernicus Data Space Ecosystem",
    kind: "sar-scene",
    status: "not-connected",
    provides: "Real C-band radar scenes, planned for testing only.",
    needs: ["A backend with a Copernicus Data Space account (credentials stay on a server).", "Readers and checks for the products (roadmap Stage 3)."],
    terms: "Copernicus free and open terms",
    notes: ["Always labelled Sentinel-1 C-band; never presented as NISAR."],
  },
];
