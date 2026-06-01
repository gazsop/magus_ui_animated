import { render } from "preact";
import "./index.css";
import App from "./app";

if (import.meta.env.DEV) {
  import("preact/debug");
}

render(<App />, document.getElementById("app") as HTMLElement);
