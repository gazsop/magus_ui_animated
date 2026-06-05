import { Character } from "@shared/contracts";
import { useEffect, useState } from "preact/hooks";
import { TargetedEvent } from "preact";
import { FlexCol, FlexRow } from "./Flex";
import Cropper, { Area, Point } from "react-easy-crop";
import { debugLog } from "@/core/logger";

const ASPECTS = [
  { label: "free", value: "free" as const },
  { label: "1:1", value: 1 },
  { label: "3:4", value: 3 / 4 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
];

export default function ImageUploadControl({
  id,
  label,
  value,
  fallbackSrc,
  onChange,
}: {
  id: string;
  label: string;
  value?: Character.TImageMeta | null;
  fallbackSrc?: string;
  onChange: (meta: Character.TImageMeta | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [source, setSource] = useState<string>("");
  const [fit, setFit] = useState<Character.TImageFit>(value?.fit || "cover");
  const [aspect, setAspect] = useState<number | "free">(value?.aspect || 1);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState<Area | null>(null);

  const previewSrc = value?.src || fallbackSrc || "";

  useEffect(() => {
    setFit(value?.fit || "cover");
    setAspect(value?.aspect || 1);
  }, [value?.fit, value?.aspect, value?.src]);

  const createImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });

  const cropToDataUrl = async (src: string, pixels: Area): Promise<string> => {
    const image = await createImage(src);
    const canvas = document.createElement("canvas");
    const rawW = Math.max(1, Math.floor(pixels.width));
    const rawH = Math.max(1, Math.floor(pixels.height));
    const maxEdge = 512;
    const scale = Math.min(1, maxEdge / Math.max(rawW, rawH));
    canvas.width = Math.max(1, Math.floor(rawW * scale));
    canvas.height = Math.max(1, Math.floor(rawH * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(
      image,
      pixels.x,
      pixels.y,
      pixels.width,
      pixels.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return canvas.toDataURL("image/jpeg", 0.82);
  };

  const onFile = async (e: TargetedEvent<HTMLInputElement, Event>) => {
    const target = e.currentTarget as HTMLInputElement | null;
    const file = target?.files?.[0];
    if (!file) return;
    try {
      const objectUrl = URL.createObjectURL(file);
      setSource(objectUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setIsOpen(true);
    } catch (error) {
      debugLog("Image picker failed:", error);
    }
  };

  return (
    <FlexCol className="w-full gap-1">
      <label>{label}</label>
      <FlexRow className="items-center gap-1 flex-wrap">
        {previewSrc ? (
          <div className="w-20 h-20 fancy-container overflow-hidden">
            <img
              src={previewSrc}
              className="w-full h-full"
              style={{ objectFit: value?.fit || fit || "cover" }}
            />
          </div>
        ) : (
          <div className="w-20 h-20 fancy-container flex items-center justify-center">
            No image
          </div>
        )}
        <input
          id={id}
          type="file"
          accept="image/*"
          onChange={onFile}
        />
        <button
          onClick={() => onChange(null)}
          className="fancy-container p-1"
        >
          Clear
        </button>
      </FlexRow>
      {isOpen && source ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2">
          <div className="fancy-container p-2 w-[min(760px,95vw)] max-h-[90vh] overflow-auto">
            <p>Képkivágás-szerkesztő</p>
            <div className="relative w-full h-[min(420px,60vh)] fancy-container">
              <Cropper
                image={source}
                crop={crop}
                zoom={zoom}
                aspect={aspect === "free" ? undefined : aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCropPixels(pixels)}
                objectFit="cover"
              />
            </div>
            <FlexRow className="items-center gap-1 mt-1 flex-wrap">
              <label>Arány</label>
              <select
                className="text-black h-[26px] rounded px-1"
                value={String(aspect)}
                onChange={(e) => {
                  const raw = e.currentTarget.value;
                  setAspect(raw === "free" ? "free" : Number(raw) || 1);
                }}
              >
                {ASPECTS.map((a) => (
                  <option key={a.label} value={String(a.value)}>
                    {a.label}
                  </option>
                ))}
              </select>
              <label>Renderelés</label>
              <select
                className="text-black h-[26px] rounded px-1"
                value={fit}
                onChange={(e) => setFit(e.currentTarget.value as Character.TImageFit)}
              >
                <option value="cover">kivágás</option>
                <option value="contain">illesztés</option>
                <option value="fill">nyújtás</option>
              </select>
              <label>Nagyítás</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onInput={(e) => setZoom(Number((e.currentTarget as HTMLInputElement).value) || 1)}
              />
              <button className="fancy-container p-1" onClick={() => setIsOpen(false)}>
                Cancel
              </button>
              <button
                className="fancy-container p-1"
                onClick={async () => {
                  const src = cropPixels ? await cropToDataUrl(source, cropPixels) : source;
                  onChange({ src, fit, aspect: aspect === "free" ? 1 : aspect });
                  setIsOpen(false);
                }}
              >
                Apply
              </button>
            </FlexRow>
          </div>
        </div>
      ) : null}
    </FlexCol>
  );
}


