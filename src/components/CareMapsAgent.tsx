import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import {
  Compass,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
} from "lucide-react";
import { MapsGroundingPlaceLink, queryMapsHealthAgent } from "../lib/gemini";
import { SupportedLanguage } from "../lib/i18n";

const GOOGLE_MAPS_API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (import.meta as any).env?.GOOGLE_MAPS_API_KEY ||
  "";

interface LivePlacePin {
  id: string;
  displayName: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  rating?: number;
  googleMapsURI?: string;
}

/**
 * Child component inside `<GoogleMap>` that uses modern `useMapsLibrary('places')` (`Place.searchByText`)
 * and `useMapsLibrary('routes')` (`Route.computeRoutes` + `createPolylines`)
 * in strict compliance with the Google Maps Platform Zero-Legacy Mandate.
 */
function LivePlacesAndRouteLayer({
  center,
  searchQuery,
  selectedDestination,
  travelMode,
  onPlacesFound,
  onRouteComputed,
}: {
  center: { lat: number; lng: number };
  searchQuery: string;
  selectedDestination: LivePlacePin | null;
  travelMode: "DRIVING" | "WALKING";
  onPlacesFound: (places: LivePlacePin[]) => void;
  onRouteComputed: (summary: { distanceKm: string; durationMins: string } | null) => void;
}) {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const routesLib = useMapsLibrary("routes");
  const polylinesRef = useRef<any[]>([]);

  // Live Places API (New) text search
  useEffect(() => {
    if (!placesLib || !map || !searchQuery) return;
    const PlaceClass = (placesLib as any).Place;
    if (!PlaceClass || typeof PlaceClass.searchByText !== "function") return;

    let cancelled = false;
    PlaceClass.searchByText({
      textQuery: searchQuery,
      locationBias: { center, radius: 6000 },
      fields: ["id", "displayName", "formattedAddress", "location", "rating", "googleMapsURI"],
      maxResultCount: 6,
    })
      .then((res: any) => {
        if (cancelled) return;
        const found: LivePlacePin[] = (res?.places || [])
          .filter((p: any) => p.location)
          .map((p: any) => ({
            id: p.id || String(Math.random()),
            displayName: p.displayName || "Healthcare / Wellness Location",
            formattedAddress: p.formattedAddress || "",
            location: {
              lat: typeof p.location.lat === "function" ? p.location.lat() : p.location.lat,
              lng: typeof p.location.lng === "function" ? p.location.lng() : p.location.lng,
            },
            rating: p.rating,
            googleMapsURI: p.googleMapsURI,
          }));
        onPlacesFound(found);
      })
      .catch((err: any) => {
        const msg = String(err?.message || err);
        if (
          msg.includes("429") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("OVER_QUERY_LIMIT") ||
          msg.includes("QuotaExceeded")
        ) {
          window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [placesLib, map, searchQuery, center.lat, center.lng]);

  // Modern Routes API (`Route.computeRoutes` + `createPolylines`)
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!routesLib || !map || !selectedDestination) {
      onRouteComputed(null);
      return;
    }

    const RouteClass = (routesLib as any).Route;
    if (!RouteClass || typeof RouteClass.computeRoutes !== "function") return;

    RouteClass.computeRoutes({
      origin: center,
      destination: selectedDestination.location,
      travelMode,
      fields: ["path", "distanceMeters", "durationMillis", "viewport"],
    })
      .then(({ routes }: { routes: any[] }) => {
        const primaryRoute = routes?.[0];
        if (!primaryRoute) {
          onRouteComputed(null);
          return;
        }

        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((polyline: any) => {
          polyline.setOptions({
            strokeColor: "#0D9488",
            strokeWeight: 5,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        const distKm = ((primaryRoute.distanceMeters ?? 0) / 1000).toFixed(1);
        const durMins = Math.max(1, Math.round((primaryRoute.durationMillis ?? 0) / 60000));
        onRouteComputed({ distanceKm: `${distKm} km`, durationMins: `${durMins} mins` });
      })
      .catch((err: any) => {
        const msg = String(err?.message || err);
        if (
          msg.includes("429") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("OVER_QUERY_LIMIT") ||
          msg.includes("QuotaExceeded")
        ) {
          window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
        }
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, center.lat, center.lng, selectedDestination, travelMode]);

  return null;
}

export function CareMapsAgent({ language }: { language: SupportedLanguage }) {
  // User location (defaults to New Delhi if geolocation not granted yet)
  const [userCenter, setUserCenter] = useState<{ lat: number; lng: number }>({
    lat: 28.6139,
    lng: 77.209,
  });
  const [locationLabel, setLocationLabel] = useState("New Delhi, India (Default)");
  const [livePlaces, setLivePlaces] = useState<LivePlacePin[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<LivePlacePin | null>(null);
  const [travelMode, setTravelMode] = useState<"WALKING" | "DRIVING">("WALKING");
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: string;
    durationMins: string;
  } | null>(null);
  const [mapSearchCategory, setMapSearchCategory] = useState(
    "Diagnostic pathology lab near New Delhi"
  );

  // Conversational Maps Grounding Agent state
  const [agentQuery, setAgentQuery] = useState(
    "Find NABL diagnostic labs for HbA1c and public walking parks near Connaught Place, New Delhi"
  );
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentAnswer, setAgentAnswer] = useState<string>("");
  const [agentLinks, setAgentLinks] = useState<MapsGroundingPlaceLink[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserCenter(next);
        setLocationLabel(
          `GPS (${next.lat.toFixed(4)}, ${next.lng.toFixed(4)})`
        );
        setMapSearchCategory("Diagnostic pathology laboratory");
      },
      () => {
        setLocationLabel("New Delhi (Location permission declined)");
      }
    );
  };

  const handleAskMapsAgent = useCallback(
    async (customPrompt?: string) => {
      const q = (customPrompt ?? agentQuery).trim();
      if (!q) return;
      setAgentLoading(true);
      setAgentError(null);
      try {
        const res = await queryMapsHealthAgent({
          query: q,
          lat: userCenter.lat,
          lng: userCenter.lng,
          language,
        });
        setAgentAnswer(res.answer);
        setAgentLinks(res.mapLinks);
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
          window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
        }
        setAgentError(msg);
      } finally {
        setAgentLoading(false);
      }
    },
    [agentQuery, userCenter.lat, userCenter.lng, language]
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700 dark:text-teal-400">
            <Compass className="w-4 h-4" />
            <span>Real-Time Google Maps Platform & Grounded Places Agent</span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
            Find Diagnostic Labs, Hospitals, Pharmacies & Post-Meal Walking Routes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active center: {locationLabel} · Powered by Google Maps Platform (Places API New & Routes API) and Gemini Maps Grounding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <LocateFixed className="w-3.5 h-3.5 text-teal-700" />
            <span>Use My GPS Location</span>
          </button>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTravelMode("WALKING")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                travelMode === "WALKING"
                  ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Walk Route
            </button>
            <button
              type="button"
              onClick={() => setTravelMode("DRIVING")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                travelMode === "DRIVING"
                  ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Drive Route
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: "Diagnostic & Blood Labs", query: "Diagnostic pathology lab" },
          { label: "Walkable Parks (Post-meal walk)", query: "Public walking park garden" },
          { label: "Hospitals & Urgent Care", query: "Multi-specialty hospital clinic" },
          { label: "24x7 Pharmacies", query: "Pharmacy medical store" },
        ].map((cat) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => {
              setSelectedPlace(null);
              setMapSearchCategory(cat.query);
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              mapSearchCategory === cat.query
                ? "border-teal-700 bg-teal-50/70 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Interactive Map + Places & Route List Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="lg:col-span-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 h-[380px] relative bg-slate-100 dark:bg-slate-800">
          {GOOGLE_MAPS_API_KEY ? (
            <APIProvider
              apiKey={GOOGLE_MAPS_API_KEY}
              language={language === "hi" ? "hi" : "en"}
              region="IN"
            >
              <GoogleMap
                defaultCenter={userCenter}
                defaultZoom={13}
                mapId="DEMO_MAP_ID"
                gestureHandling="greedy"
                internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                style={{ width: "100%", height: "100%" }}
              >
                {/* User Position Marker */}
                <AdvancedMarker position={userCenter}>
                  <Pin background="#0F172A" glyphColor="#FFFFFF" borderColor="#0F172A" />
                </AdvancedMarker>

                {/* Live Places Markers */}
                {livePlaces.map((p) => (
                  <AdvancedMarker
                    key={p.id}
                    position={p.location}
                    onClick={() => setSelectedPlace(p)}
                  >
                    <Pin background="#0D9488" glyphColor="#FFFFFF" borderColor="#0F766E" />
                  </AdvancedMarker>
                ))}

                {selectedPlace && (
                  <InfoWindow
                    position={selectedPlace.location}
                    onCloseClick={() => setSelectedPlace(null)}
                  >
                    <div className="p-1 max-w-xs text-slate-900">
                      <p className="text-xs font-semibold">{selectedPlace.displayName}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {selectedPlace.formattedAddress}
                      </p>
                      {routeSummary && (
                        <p className="text-[11px] font-semibold text-teal-800 mt-1 tabular-nums">
                          {travelMode}: {routeSummary.distanceKm} · {routeSummary.durationMins}
                        </p>
                      )}
                      {selectedPlace.googleMapsURI && (
                        <a
                          href={selectedPlace.googleMapsURI}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-teal-700 underline mt-1"
                        >
                          <span>Open in Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </InfoWindow>
                )}

                <LivePlacesAndRouteLayer
                  center={userCenter}
                  searchQuery={mapSearchCategory}
                  selectedDestination={selectedPlace}
                  travelMode={travelMode}
                  onPlacesFound={setLivePlaces}
                  onRouteComputed={setRouteSummary}
                />
              </GoogleMap>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-xs text-slate-600 dark:text-slate-300">
              <MapPin className="w-7 h-7 text-teal-700 mb-2" />
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                Interactive Google Map Ready
              </p>
              <p className="max-w-md mt-1">
                Use the Gemini Maps Grounding Agent below to pull real-time places, clinics, walking parks, and directions with direct Google Maps links.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Live Places Results & Route Calculator */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
              <span>Live Nearby Places ({livePlaces.length})</span>
              {routeSummary && (
                <span className="text-teal-700 dark:text-teal-400 tabular-nums">
                  {routeSummary.distanceKm} · {routeSummary.durationMins}
                </span>
              )}
            </h4>

            {livePlaces.length === 0 ? (
              <p className="text-xs text-slate-500 py-6">
                Select a category above or ask the Maps Agent below to pull verified places and routes.
              </p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {livePlaces.map((place) => {
                  const isSel = selectedPlace?.id === place.id;
                  return (
                    <div
                      key={place.id}
                      className={`p-2.5 rounded-lg border text-xs transition-colors ${
                        isSel
                          ? "border-teal-600 bg-white dark:bg-slate-900"
                          : "border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50"
                      }`}
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {place.displayName}
                      </div>
                      <div className="text-slate-500 text-[11px] line-clamp-1 mt-0.5">
                        {place.formattedAddress}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPlace(place)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Show {travelMode.toLowerCase()} route</span>
                        </button>
                        {place.googleMapsURI && (
                          <a
                            href={place.googleMapsURI}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 underline"
                          >
                            <span>Maps</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 pt-3 border-t border-slate-200 dark:border-slate-700 mt-3">
            Text alternative: Select any place card to compute the real-time {travelMode.toLowerCase()} distance and travel duration on the map.
          </p>
        </div>
      </div>

      {/* Conversational Gemini Maps Grounding Agent */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Ask the Real-Time Google Maps Agent
            </h4>
            <p className="text-xs text-slate-500">
              Pulls live place details, walking parks, diagnostic centers, and review snippets grounded in Google Maps.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Best morning walking parks near me",
              "NABL blood test labs for HbA1c & lipid profile",
              "Hospitals with diabetes & kidney clinic",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAgentQuery(preset);
                  handleAskMapsAgent(preset);
                }}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={agentQuery}
            onChange={(e) => setAgentQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskMapsAgent()}
            placeholder="Ask about places, walking routes, diagnostic labs, or directions..."
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm"
          />
          <button
            type="button"
            disabled={agentLoading}
            onClick={() => handleAskMapsAgent()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>{agentLoading ? "Searching Maps..." : "Ask Maps Agent"}</span>
          </button>
        </div>

        {agentError && (
          <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/70 text-xs text-rose-900">
            {agentError}
          </div>
        )}

        {agentAnswer && (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
            <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {agentAnswer}
            </div>

            {agentLinks.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  Google Maps Grounded Place Links & Review Snippets:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {agentLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-teal-600 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-teal-800 dark:text-teal-300">
                        <span className="truncate">{link.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </div>
                      {link.reviewSnippets && link.reviewSnippets.length > 0 && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          “{link.reviewSnippets[0]}”
                        </p>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
