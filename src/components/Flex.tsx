import { ComponentChildren } from "preact";
import { InputHTMLAttributes } from "preact/compat";

export function FlexRow(
  props: {
    children?: ComponentChildren;
    className?: string;
  } & InputHTMLAttributes<HTMLDivElement>
) {
  return (
    <div
      {...props}
      className={`${
        props.className ? `${props.className} ` : ""
      }flex flex-row min-w-0 min-h-0`}
    >
      {props.children}
    </div>
  );
}

export function FlexCol(
  props: {
    children?: ComponentChildren;
    className?: string;
  } & InputHTMLAttributes<HTMLDivElement>
) {
  return (
    <div
      {...props}
      className={`${
        props.className ? `${props.className} ` : ""
      }flex flex-col min-w-0 min-h-0`} // bg-[rgba(255,255,255,0.5)]
    >
      {props.children}
    </div>
  );
}
