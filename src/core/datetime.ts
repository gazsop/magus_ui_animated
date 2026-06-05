export const CLIENT_DATETIME_DISPLAY_FORMAT = "YYYY.MM.DD. HH:MM:SS";

export const formatClientDateTime = (value: number | Date | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  const date = value instanceof Date ? value : new Date(Number(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}. ${hh}:${min}:${sec}`;
};

export const formatClientTime = (value: number | Date | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  const date = value instanceof Date ? value : new Date(Number(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${min}:${sec}`;
};
