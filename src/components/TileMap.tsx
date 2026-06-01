import { render } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Application, ServerApi, User } from "@shared/contracts";
import { useDataContext } from "@/contexts/dataContext";
import useRequest from "@/hooks/request";
import MapPinIcon from "@components/icons/general/MapPinIcon";
import Trash2Icon from "@components/icons/general/Trash2Icon";
import { FlexRow } from "@components/Flex";

const TILE_SIZE = 512;
const MIN_SOURCE_ZOOM = 1;
const MAX_SOURCE_ZOOM = 6;
const LEAFLET_MIN_ZOOM = 0;
const LEAFLET_MAX_ZOOM = MAX_SOURCE_ZOOM - MIN_SOURCE_ZOOM;
const ZOOM_BOUNDS: Record<number, { maxColumn: number; maxRow: number }> = {
  1: { maxColumn: 0, maxRow: 1 },
  2: { maxColumn: 1, maxRow: 2 },
  3: { maxColumn: 3, maxRow: 4 },
  4: { maxColumn: 6, maxRow: 9 },
  5: { maxColumn: 12, maxRow: 19 },
  6: { maxColumn: 25, maxRow: 39 },
};
const MAX_BOUNDS = ZOOM_BOUNDS[MAX_SOURCE_ZOOM];
const MAX_ZOOM_SCALE = 2 ** LEAFLET_MAX_ZOOM;
const MAP_WIDTH = ((MAX_BOUNDS.maxColumn + 1) * TILE_SIZE) / MAX_ZOOM_SCALE;
const MAP_HEIGHT = ((MAX_BOUNDS.maxRow + 1) * TILE_SIZE) / MAX_ZOOM_SCALE;
const EMPTY_TILE =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

type TYnevLocation = {
  html: string;
  url?: string;
  x: string;
  y: string;
};

type TYnevMarkerKind = "search" | ServerApi.YnevRoutes.MarkerScope;
type TPendingMarker = {
  scope: ServerApi.YnevRoutes.MarkerScope;
  latLng: L.LatLng;
  hidden?: boolean;
};

const MARKER_STYLE: Record<TYnevMarkerKind, L.CircleMarkerOptions> = {
  search: {
    radius: 9,
    color: "#ef4444",
    weight: 3,
    fillColor: "#ef4444",
    fillOpacity: 0.85,
  },
  all: {
    radius: 8,
    color: "#22c55e",
    weight: 3,
    fillColor: "#22c55e",
    fillOpacity: 0.85,
  },
  self: {
    radius: 8,
    color: "#3b82f6",
    weight: 3,
    fillColor: "#3b82f6",
    fillOpacity: 0.85,
  },
};
const createCityMarkerIcon = () => {
  const icon = document.createElement("div");
  render(<MapPinIcon className="drop-shadow" fill="#fde68a" stroke="#d97706" />, icon);
  return L.divIcon({
    className: "",
    html: icon,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};
const createPinMarkerIcon = (color: string) => {
  const icon = document.createElement("div");
  render(<MapPinIcon className="drop-shadow" fill={color} stroke="#ffffff" />, icon);
  return L.divIcon({
    className: "",
    html: icon,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

const toSourceZoom = (leafletZoom: number) =>
  Math.max(
    MIN_SOURCE_ZOOM,
    Math.min(MAX_SOURCE_ZOOM, Math.round(leafletZoom) + MIN_SOURCE_ZOOM)
  );

class YnevTileLayer extends L.TileLayer {
  getTileUrl(coords: L.Coords) {
    const sourceZoom = toSourceZoom(coords.z);
    const bounds = ZOOM_BOUNDS[sourceZoom];
    if (
      coords.x < 0 ||
      coords.y < 0 ||
      coords.x > bounds.maxColumn ||
      coords.y > bounds.maxRow
    ) {
      return EMPTY_TILE;
    }
    return `/imgs/tiles/${sourceZoom}/${coords.x}/${coords.y}.png`;
  }
}

export default function TileMap(props: {
  resizeKey?: number;
  advId?: string;
  jumpX?: string;
  jumpY?: string;
  jumpNonce?: string;
}) {
  const { user } = useDataContext();
  const [ynevRequest] = useRequest(Application.REQUEST_CONTROLLER.YNEV);
  const advId = String(props.advId || "").trim();
  const isSuperAdmin = user?.json?.rank === User.USER_RANK.SUPERADMIN;
  const canAdminMarkers =
    user?.json?.rank === User.USER_RANK.ADMIN ||
    user?.json?.rank === User.USER_RANK.SUPERADMIN;
  const [locations, setLocations] = useState<TYnevLocation[]>([]);
  const [markers, setMarkers] = useState<ServerApi.YnevRoutes.Marker[]>([]);
  const [armedScope, setArmedScope] = useState<ServerApi.YnevRoutes.MarkerScope | null>(null);
  const [armedHidden, setArmedHidden] = useState(false);
  const [pendingMarker, setPendingMarker] = useState<TPendingMarker | null>(null);
  const [markerColor, setMarkerColor] = useState("#3b82f6");
  const [markerComment, setMarkerComment] = useState("");
  const [showCities, setShowCities] = useState(false);
  const [search, setSearch] = useState("");
  const [mouseSource, setMouseSource] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const ynevRequestRef = useRef(ynevRequest);
  const debugControlRef = useRef<L.Control | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const cityLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightRef = useRef<L.CircleMarker | L.Marker | null>(null);
  ynevRequestRef.current = ynevRequest;

  const searchResults = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (needle.length < 2) return [];
    return locations
      .filter((location) => location.html.toLocaleLowerCase().includes(needle))
      .slice(0, 8);
  }, [locations, search]);

  const cityLocations = useMemo(() => {
    if (!canAdminMarkers) return [];
    return locations.filter((location) => String(location.url || "").trim());
  }, [canAdminMarkers, locations]);

  const sourceToLatLng = useCallback((x: number, y: number) => {
    return L.latLng(y / MAX_ZOOM_SCALE, x / MAX_ZOOM_SCALE);
  }, []);

  const latLngToSource = useCallback((latLng: L.LatLng) => {
    return {
      x: latLng.lng * MAX_ZOOM_SCALE,
      y: latLng.lat * MAX_ZOOM_SCALE,
    };
  }, []);

  const createMapMarker = useCallback((
    kind: TYnevMarkerKind,
    x: number,
    y: number,
    label: string,
    onDelete?: () => void,
    color?: string,
    comment?: string,
    creatorName?: string,
    hidden?: boolean,
    onReveal?: () => void
  ) => {
    const marker = L.marker(sourceToLatLng(x, y), {
      icon: createPinMarkerIcon(color || MARKER_STYLE[kind].color || "#3b82f6"),
    });
    if (kind === "self" || kind === "all") {
      const popup = L.DomUtil.create("div");
      popup.style.position = "relative";
      popup.style.minWidth = "120px";
      if (onDelete) {
        popup.style.paddingRight = "24px";
      }
      const titleText = kind === "all" ? "K\u00f6z\u00f6s" : "";
      if (titleText) {
        const title = L.DomUtil.create("div", "", popup);
        title.textContent = hidden ? `${titleText} (hidden)` : titleText;
        title.style.color = "#000000";
        title.style.fontWeight = "700";
      }
      if (comment) {
        const note = L.DomUtil.create("p", "", popup);
        note.textContent = comment;
        note.style.marginTop = "4px";
        note.style.color = "#000000";
      }
      if (creatorName) {
        const creator = L.DomUtil.create("div", "", popup);
        creator.textContent = creatorName;
        creator.style.marginTop = "6px";
        creator.style.color = "#000000";
        creator.style.fontSize = "11px";
        creator.style.opacity = "0.75";
      }
      if (onDelete) {
        const button = L.DomUtil.create("span", "", popup);
        button.title = "Delete";
        button.style.position = "absolute";
        button.style.top = "0";
        button.style.right = "0";
        button.style.width = "20px";
        button.style.height = "20px";
        button.style.display = "flex";
        button.style.alignItems = "center";
        button.style.justifyContent = "center";
        button.style.color = "#ef4444";
        button.style.cursor = "pointer";
        render(<Trash2Icon className="h-4 w-4" />, button);
        button.querySelector("svg")?.setAttribute("stroke", "#ef4444");
        L.DomEvent.on(button, "click", L.DomEvent.stopPropagation)
          .on(button, "click", L.DomEvent.preventDefault)
          .on(button, "click", onDelete);
      }
      if (hidden && onReveal) {
        const reveal = L.DomUtil.create("button", "", popup);
        reveal.type = "button";
        reveal.textContent = "Set visible";
        reveal.style.display = "block";
        reveal.style.marginTop = "8px";
        reveal.style.color = "#000000";
        reveal.style.border = "1px solid #000000";
        reveal.style.padding = "2px 6px";
        reveal.style.cursor = "pointer";
        L.DomEvent.on(reveal, "click", L.DomEvent.stopPropagation)
          .on(reveal, "click", L.DomEvent.preventDefault)
          .on(reveal, "click", onReveal);
      }
      marker.bindPopup(popup);
    } else {
      marker.bindPopup(label || (kind === "search" ? "Search result" : "Marker"));
    }
    return marker;
  }, [sourceToLatLng]);

  const createCityMarker = useCallback((location: TYnevLocation) => {
    const x = Number(location.x);
    const y = Number(location.y);
    const url = String(location.url || "").trim();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !url) return null;

    const marker = L.marker(sourceToLatLng(x, y), { icon: createCityMarkerIcon() });
    const popup = L.DomUtil.create("div");
    const title = L.DomUtil.create("strong", "", popup);
    title.textContent = location.html;
    title.style.display = "block";
    title.style.color = "#000000";

    const link = L.DomUtil.create("a", "", popup);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${location.html} t\u00e9rk\u00e9p`;
    link.style.display = "block";
    link.style.marginTop = "4px";
    link.style.color = "#000000";
    L.DomEvent.on(link, "click", L.DomEvent.stopPropagation);

    marker.bindPopup(popup, {
      autoClose: true,
      closeOnClick: true,
      closeButton: false,
      offset: L.point(0, -6),
    });
    return marker;
  }, [sourceToLatLng]);

  const loadMarkers = useCallback(async () => {
    if (!user?.uid || !advId) {
      setMarkers([]);
      return;
    }
    try {
      const response = await ynevRequestRef.current<ServerApi.YnevRoutes.GetMarkersResponse, ServerApi.YnevRoutes.GetMarkersBody>({
        endPoint: "markers/get",
        body: { advId },
        errorMode: "quiet",
      });
      setMarkers(Array.isArray(response.data.markers) ? response.data.markers : []);
    } catch {
      setMarkers([]);
    }
  }, [advId, user?.uid]);

  const deleteMarker = useCallback(async (id: string) => {
    try {
      await ynevRequestRef.current<ServerApi.YnevRoutes.DeleteMarkerResponse, ServerApi.YnevRoutes.DeleteMarkerBody>({
        endPoint: "markers/delete",
        body: { id },
        errorMode: "quiet",
      });
      setMarkers((current) => current.filter((marker) => marker.id !== id));
    } catch {
      void loadMarkers();
    }
  }, [loadMarkers]);

  const revealMarker = useCallback(async (id: string) => {
    try {
      const response = await ynevRequestRef.current<ServerApi.YnevRoutes.RevealMarkerResponse, ServerApi.YnevRoutes.RevealMarkerBody>({
        endPoint: "markers/reveal",
        body: { id },
        errorMode: "quiet",
      });
      setMarkers((current) =>
        current.map((marker) => (marker.id === id ? response.data.marker : marker))
      );
    } catch {
      void loadMarkers();
    }
  }, [loadMarkers]);

  const saveMarker = useCallback(async (
    scope: ServerApi.YnevRoutes.MarkerScope,
    latLng: L.LatLng,
    color: string,
    comment: string,
    hidden = false
  ) => {
    if (!advId) return;
    const source = latLngToSource(latLng);
    const label = scope === "all" ? "K\u00f6z\u00f6s" : "";
    const response = await ynevRequestRef.current<ServerApi.YnevRoutes.Marker, ServerApi.YnevRoutes.CreateMarkerBody>({
      endPoint: "markers/create",
      body: {
        advId,
        scope,
        x: source.x,
        y: source.y,
        label,
        color,
        comment,
        hidden,
      },
      errorMode: "quiet",
    });
    setMarkers((current) => [...current, response.data]);
  }, [advId, latLngToSource]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const bounds = L.latLngBounds([-MAP_HEIGHT, 0], [0, MAP_WIDTH]);
    const map = L.map(containerRef.current, {
      attributionControl: false,
      crs: L.CRS.Simple,
      dragging: false,
      maxBounds: bounds,
      maxBoundsViscosity: 0.9,
      minZoom: LEAFLET_MIN_ZOOM,
      maxZoom: LEAFLET_MAX_ZOOM,
      wheelPxPerZoomLevel: 90,
      zoomSnap: 1,
      zoomDelta: 1,
    });

    new YnevTileLayer("", {
      bounds,
      noWrap: true,
      tileSize: TILE_SIZE,
      minZoom: LEAFLET_MIN_ZOOM,
      maxZoom: LEAFLET_MAX_ZOOM,
      keepBuffer: 2,
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    cityLayerRef.current = L.layerGroup().addTo(map);

    map.fitBounds(bounds);
    mapRef.current = map;
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      debugControlRef.current?.remove();
      debugControlRef.current = null;
      markerLayerRef.current?.clearLayers();
      markerLayerRef.current = null;
      cityLayerRef.current?.clearLayers();
      cityLayerRef.current = null;
      highlightRef.current?.remove();
      highlightRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    void loadMarkers();
  }, [loadMarkers]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (searchRef.current?.contains(target)) return;
      setSearch("");
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleMouseMove = (event: L.LeafletMouseEvent) => {
      if (!(map as L.Map & { _loaded?: boolean })._loaded) return;
      const source = latLngToSource(event.latlng);
      const next = {
        x: Math.round(source.x),
        y: Math.round(source.y),
      };
      setMouseSource((current) =>
        current?.x === next.x && current?.y === next.y ? current : next
      );
    };
    const handleMouseOut = () => {
      setMouseSource(null);
    };
    map.on("mousemove", handleMouseMove);
    map.on("mouseout", handleMouseOut);
    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("mouseout", handleMouseOut);
    };
  }, [latLngToSource]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleClick = (event: L.LeafletMouseEvent) => {
      if (!armedScope) return;
      const scope = armedScope;
      const hidden = armedHidden && scope === "all";
      setArmedScope(null);
      setArmedHidden(false);
      if (!advId) return;
      setMarkerColor(scope === "all" ? "#22c55e" : "#3b82f6");
      setMarkerComment("");
      setPendingMarker({ scope, latLng: event.latlng, hidden });
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [advId, armedHidden, armedScope, loadMarkers, saveMarker]);

  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markers.forEach((marker) => {
      const canDelete = marker.uid === user?.uid || canAdminMarkers;
      createMapMarker(
        marker.scope,
        marker.x,
        marker.y,
        marker.label,
        canDelete ? () => void deleteMarker(marker.id) : undefined,
        marker.color,
        marker.comment,
        marker.creatorName,
        Boolean(marker.hidden),
        Boolean(marker.hidden) && canAdminMarkers ? () => void revealMarker(marker.id) : undefined
      ).addTo(layer);
    });
  }, [canAdminMarkers, createMapMarker, deleteMarker, markers, revealMarker, user?.uid]);

  useEffect(() => {
    const layer = cityLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showCities || !canAdminMarkers) return;
    cityLocations.forEach((location) => {
      const marker = createCityMarker(location);
      if (marker) marker.addTo(layer);
    });
  }, [canAdminMarkers, cityLocations, createCityMarker, showCities]);

  useEffect(() => {
    fetch("/data/ynev_locations.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<TYnevLocation[]>;
      })
      .then((data) => {
        setLocations(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setLocations([]);
      });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const refresh = () => {
      map.invalidateSize();
    };

    refresh();
    const frame = window.requestAnimationFrame(refresh);
    return () => window.cancelAnimationFrame(frame);
  }, [props.resizeKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    debugControlRef.current?.remove();
    debugControlRef.current = null;
    if (!isSuperAdmin) return;

    const debugControl = new L.Control({ position: "topleft" });
    const updateHandlers: Array<() => void> = [];
    debugControl.onAdd = () => {
      const elem = L.DomUtil.create("div", "leaflet-bar");
      elem.style.display = "block";
      elem.style.position = "absolute";
      elem.style.top = "-80px";
      elem.style.left = "50px";
      elem.style.padding = "4px 6px";
      elem.style.minWidth = "190px";
      elem.style.background = "rgba(0, 0, 0, 0.82)";
      elem.style.color = "#ffffff";
      elem.style.font = "11px/1.25 monospace";
      elem.style.pointerEvents = "none";
      elem.style.position = "relative";
      elem.style.zIndex = "1000";

      const update = () => {
        const zoom = map.getZoom();
        const sourceZoom = toSourceZoom(zoom);
        const sourceBounds = ZOOM_BOUNDS[sourceZoom];
        const center = map.getCenter();
        const visibleBounds = map.getBounds();
        const northWest = visibleBounds.getNorthWest();
        const southEast = visibleBounds.getSouthEast();
        const sourceScale = 2 ** (sourceZoom - MIN_SOURCE_ZOOM);
        const sourceTileSize = TILE_SIZE / sourceScale;
        const minColumn = Math.max(0, Math.floor(northWest.lng / sourceTileSize));
        const maxColumn = Math.min(
          sourceBounds.maxColumn,
          Math.floor(southEast.lng / sourceTileSize)
        );
        const minRow = Math.max(0, Math.floor(Math.abs(northWest.lat) / sourceTileSize));
        const maxRow = Math.min(
          sourceBounds.maxRow,
          Math.floor(Math.abs(southEast.lat) / sourceTileSize)
        );

        elem.innerHTML = [
          `leaflet zoom: ${zoom.toFixed(2)}`,
          `source zoom: ${sourceZoom}`,
          `center: ${Math.round(center.lng)}, ${Math.round(Math.abs(center.lat))}`,
          `cols: ${minColumn}-${maxColumn} / 0-${sourceBounds.maxColumn}`,
          `rows: ${minRow}-${maxRow} / 0-${sourceBounds.maxRow}`,
          `tile: ${TILE_SIZE}px`,
        ].join("<br>");
      };

      updateHandlers.push(update);
      map.on("moveend zoomend", update);
      update();
      return elem;
    };
    debugControl.onRemove = () => {
      updateHandlers.forEach((update) => map.off("moveend zoomend", update));
      updateHandlers.length = 0;
    };
    debugControl.addTo(map);
    debugControlRef.current = debugControl;

    return () => {
      debugControl.remove();
      if (debugControlRef.current === debugControl) {
        debugControlRef.current = null;
      }
    };
  }, [isSuperAdmin]);

  const jumpToLocation = (location: TYnevLocation) => {
    const map = mapRef.current;
    if (!map) return;
    const x = Number(location.x);
    const y = Number(location.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const target = sourceToLatLng(x, y);
    map.setView(target, LEAFLET_MAX_ZOOM);
    highlightRef.current?.remove();
    highlightRef.current = createMapMarker("search", x, y, location.html)
      .addTo(map)
      .bindPopup(location.html);
    highlightRef.current.openPopup();
  };

  useEffect(() => {
    const x = Number(props.jumpX);
    const y = Number(props.jumpY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const jump = () => {
      const map = mapRef.current;
      if (!map) return false;
      const target = sourceToLatLng(x, y);
      map.setView(target, LEAFLET_MAX_ZOOM);
      highlightRef.current?.remove();
      highlightRef.current = createMapMarker(
        "search",
        x,
        y,
        `x:${Math.round(x)}, y:${Math.round(y)}`
      ).addTo(map);
      highlightRef.current.openPopup();
      return true;
    };
    if (jump()) return;
    const frame = window.requestAnimationFrame(jump);
    return () => window.cancelAnimationFrame(frame);
  }, [createMapMarker, props.jumpNonce, props.jumpX, props.jumpY, sourceToLatLng]);

  const submitPendingMarker = () => {
    if (!pendingMarker) return;
    const next = pendingMarker;
    setPendingMarker(null);
    void saveMarker(next.scope, next.latLng, markerColor, markerComment, next.hidden === true).catch(() => {
      void loadMarkers();
    });
  };

  return (
    <div className="ynev-tile-map relative w-full h-full min-w-0 min-h-0 grow overflow-hidden bg-black">
      <style>
        {`
          .ynev-tile-map .leaflet-popup-content,
          .ynev-tile-map .leaflet-popup-content-wrapper,
          .ynev-tile-map .leaflet-control,
          .ynev-tile-map .leaflet-control a,
          .ynev-tile-map .leaflet-bar a {
            color: #000000;
          }
        `}
      </style>
      <FlexRow
        className="absolute bottom-1 left-1 z-[1001] flex-wrap gap-1 text-xs w-full"
        onWheel={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <div
        ref={searchRef}
        className="z-[1001] w-[min(280px,calc(100%-1rem))] text-xs"
        onWheel={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <input
          type="search"
          className="w-full px-2 py-1 rounded text-black"
          placeholder="Search YNEV..."
          value={search}
          onInput={(event) => setSearch(event.currentTarget.value)}
        />
        {searchResults.length > 0 ? (
          <div className="mt-1 max-h-56 overflow-y-auto fancy-container bg-black/75">
            {searchResults.map((location) => (
              <button
                key={`${location.html}-${location.x}-${location.y}`}
                type="button"
                className="block w-full h-auto px-2 py-1 text-left"
                onClick={() => {
                  jumpToLocation(location);
                  setSearch(location.html);
                }}
              >
                {location.html}
              </button>
            ))}
          </div>
        ) : null}
      </div>
        <button
          type="button"
          disabled={!advId}
          className={`px-2 py-1 rounded text-white ${armedScope === "self" ? "bg-blue-700" : "bg-blue-500"}`}
          onClick={() => {
            if (!advId) return;
            setArmedHidden(false);
            setArmedScope((current) => current === "self" ? null : "self");
          }}
        >
          Self
        </button>
        <button
          type="button"
          disabled={!advId}
          className={`px-2 py-1 rounded text-white ${armedScope === "all" ? "bg-green-700" : "bg-green-500"}`}
          onClick={() => {
            if (!advId) return;
            setArmedHidden(false);
            setArmedScope((current) => current === "all" ? null : "all");
          }}
        >
          All
        </button>
        {canAdminMarkers ? (
          <button
            type="button"
            disabled={!advId}
            className={`px-2 py-1 rounded text-white ${armedScope === "all" && armedHidden ? "bg-zinc-800" : "bg-zinc-600"}`}
            onClick={() => {
              if (!advId) return;
              setArmedHidden(true);
              setArmedScope((current) => current === "all" && armedHidden ? null : "all");
            }}
          >
            Hidden
          </button>
        ) : null}
        {canAdminMarkers ? (
          <button
            type="button"
            className={`px-2 py-1 rounded text-white ${showCities ? "bg-amber-700" : "bg-amber-500"}`}
            onClick={() => setShowCities((current) => !current)}
          >
            Cities
          </button>
        ) : null}
        <div className="ml-auto mr-2 rounded bg-black/75 px-2 py-1 text-white tabular-nums">
          x:{mouseSource ? mouseSource.x : "-"} y:{mouseSource ? mouseSource.y : "-"}
        </div>
      </FlexRow>
      {pendingMarker ? (
        <div
          className="absolute left-1/2 top-1/2 z-[1002] w-[min(320px,calc(100%-1rem))] -translate-x-1/2 -translate-y-1/2 fancy-container bg-black/80 p-3 text-xs"
          onWheel={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
        >
          <div className="mb-2 font-bold">
            {pendingMarker.hidden ? "Hidden K\u00f6z\u00f6s" : pendingMarker.scope === "all" ? "K\u00f6z\u00f6s" : "Self marker"}
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {["#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#a855f7", "#111827"].map((color) => (
              <button
                key={color}
                type="button"
                className={`h-7 w-7 border ${markerColor === color ? "border-white" : "border-transparent"}`}
                style={{ backgroundColor: color }}
                onClick={() => setMarkerColor(color)}
                title={color}
              />
            ))}
          </div>
          <textarea
            className="mb-2 h-20 w-full rounded p-2 text-black"
            value={markerComment}
            placeholder="Comment"
            onInput={(event) => setMarkerComment(event.currentTarget.value)}
          />
          <FlexRow className="justify-end gap-2">
            <button type="button" className="px-2 py-1 rounded bg-gray-600 text-white" onClick={() => setPendingMarker(null)}>
              Cancel
            </button>
            <button type="button" className="px-2 py-1 rounded bg-green-600 text-white" onClick={submitPendingMarker}>
              Save
            </button>
          </FlexRow>
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="w-full h-full min-w-0 min-h-0 grow overflow-hidden"
        onWheel={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      />
    </div>
  );
}


