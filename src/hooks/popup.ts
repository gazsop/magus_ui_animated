import { useEffect, useRef, useState } from "preact/hooks";

let popupOwnerCounter = 0;

export default function usePopup() {
  const ownerIdRef = useRef("");
  if (!ownerIdRef.current) {
    popupOwnerCounter += 1;
    ownerIdRef.current = `popup-owner-${popupOwnerCounter}`;
  }
  const [popup, setPopup] = useState<{
    label: string;
    text: string;
    error?: string;
    input?: string | number;
    selectOptions?: Array<{ label: string; value: string }>;
    languageManager?: {
      options: string[];
      selected?: string;
      items: string[];
      onAdd: (value: string) => void | Promise<void>;
      onRemove: (value: string) => void | Promise<void>;
    };
    save?: string;
    prev?: string;
    showClose?: boolean;
    saveCallback?: (inputValue?: string) => void;
    prevCallback?: (inputValue?: string) => void;
  } | null>(null);

  const clearOwnedPopupContainer = () => {
    const popupContainer = document.getElementById("popup-container");
    if (popupContainer?.dataset.ownerId === ownerIdRef.current) popupContainer.remove();
  };

  useEffect(() => {
    if (popup) {
      const existing = document.getElementById("popup-container");
      if (existing) existing.remove();
      const ownerId = ownerIdRef.current;
      let popupInputEl: HTMLInputElement | HTMLSelectElement | null = null;
      const popupContainer = document.createElement("div");
      const popupWindow = document.createElement("div");
      const popupTextContainer = document.createElement("div");
      const popupText = document.createElement("p");
      const popupHr = document.createElement("hr");
      const label = document.createElement("label");
      const closeBtn = document.createElement("button");

      label.textContent = popup.label;
      label.id = "popup-label";
      label.classList.add("text-xl", "font-bold", "mb-2");
      popupHr.classList.add("fancy");
      popupContainer.id = "popup-container";
      popupContainer.dataset.ownerId = ownerId;
      popupContainer.classList.add(
        "fixed",
        "top-0",
        "left-0",
        "w-full",
        "h-full",
        "bg-black",
        "bg-opacity-50",
        "z-50"
      );
      popupWindow.classList.add(
        "flex",
        "flex-col",
        "fixed",
        "top-1/3",
        "left-1/2",
        "transform",
        "-translate-x-1/2",
        "-translate-y-1/2",
        "bg-white",
        "p-4",
        "rounded-md",
        "shadow-md",
        "w-[min(360px,95vw)]",
        "max-w-[95vw]",
        "h-auto",
        "max-h-[80%]",
        "overflow-auto",
        "fancy-container",
        "justify-stretch",
        "items-stretch",
        "gap-1",
        "select-none"
      );
      popupWindow.style.backgroundColor = "rgba(120, 64, 0, 0.9)";
      popupTextContainer.classList.add("overflow-auto", "flex-grow");
      popupText.classList.add("text-lg");
      popupText.textContent = popup.text;
      popupText.id = "popup-text";
      const popupError = document.createElement("p");
      popupError.id = "popup-error";
      popupError.classList.add("text-sm", "font-bold");
      popupError.style.color = "#ff4d4f";
      popupError.textContent = popup.error || "";
      closeBtn.textContent = "Close";
      closeBtn.addEventListener("click", () => {
        popupContainer.remove();
        setPopup(null);
      });
      const actions = document.createElement("div");
      actions.classList.add("flex", "gap-2", "justify-end");

      popupWindow.appendChild(label);
      popupWindow.appendChild(popupHr);
      popupTextContainer.appendChild(popupText);
      if (popup.error) {
        popupTextContainer.appendChild(popupError);
      }
      popupWindow.appendChild(popupTextContainer);
      if (popup.languageManager) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("flex", "flex-col", "gap-2");
        const topRow = document.createElement("div");
        topRow.classList.add("flex", "gap-2", "flex-wrap");
        const select = document.createElement("select");
        select.classList.add("border", "border-gray-300", "rounded-md", "p-1", "grow");
        popup.languageManager.options.forEach((option) => {
          const opt = document.createElement("option");
          opt.value = option;
          opt.textContent = option;
          select.appendChild(opt);
        });
        if (popup.languageManager.selected) {
          select.value = popup.languageManager.selected;
        }
        const addBtn = document.createElement("button");
        addBtn.textContent = "Add";
        addBtn.addEventListener("click", async () => {
          await popup.languageManager?.onAdd(select.value);
        });
        topRow.appendChild(select);
        topRow.appendChild(addBtn);
        wrapper.appendChild(topRow);

        const list = document.createElement("div");
        list.classList.add("flex", "flex-col", "gap-1", "max-h-[180px]", "overflow-auto");
        popup.languageManager.items.forEach((item) => {
          const row = document.createElement("div");
          row.classList.add("flex", "gap-2", "items-center", "flex-wrap");
          const labelEl = document.createElement("span");
          labelEl.textContent = item;
          labelEl.classList.add("grow");
          const removeBtn = document.createElement("button");
          removeBtn.textContent = "Remove";
          removeBtn.addEventListener("click", async () => {
            await popup.languageManager?.onRemove(item);
          });
          row.appendChild(labelEl);
          row.appendChild(removeBtn);
          list.appendChild(row);
        });
        wrapper.appendChild(list);
        popupWindow.appendChild(wrapper);
        requestAnimationFrame(() => select.focus());
      }
      if (popup.selectOptions !== undefined) {
        const select = document.createElement("select");
        select.classList.add("border", "border-gray-300", "rounded-md", "p-1");
        select.style.color = "black";
        const options = popup.selectOptions.length
          ? popup.selectOptions
          : popup.input !== undefined
            ? [{ label: popup.input.toString(), value: popup.input.toString() }]
            : [{ label: "-", value: "" }];
        options.forEach((option) => {
          const opt = document.createElement("option");
          opt.value = option.value;
          opt.textContent = option.label;
          select.appendChild(opt);
        });
        if (popup.input !== undefined) {
          const requested = popup.input.toString();
          const hasRequested = options.some((option) => option.value === requested);
          select.value = hasRequested ? requested : options[0].value;
        } else if (options.length > 0) {
          select.value = options[0].value;
        }
        popupInputEl = select;
        popupWindow.appendChild(select);
        requestAnimationFrame(() => select.focus());
      } else if (popup.input !== undefined) {
        const input = document.createElement("input");
        input.type = "text";
        input.value = popup.input.toString();
        input.classList.add("border", "border-gray-300", "rounded-md", "p-1");
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (popup.saveCallback) {
              popup.saveCallback(input.value);
            } else {
              setPopup(null);
              popupContainer.remove();
            }
          }
        });
        popupInputEl = input;
        popupWindow.appendChild(input);
        requestAnimationFrame(() => input.focus());
      }

      if (popup.prev) {
        const prevBtn = document.createElement("button");
        prevBtn.textContent = popup.prev;
        prevBtn.addEventListener("click", () => {
          if (popup.prevCallback) popup.prevCallback(popupInputEl?.value);
        });
        actions.appendChild(prevBtn);
      }
      if (popup.showClose !== false) {
        actions.appendChild(closeBtn);
      }

      if (popup.save) {
        const saveBtn = document.createElement("button");
        saveBtn.textContent = popup.save;
        //saveBtn.classList.add("bg-blue-500", "text-white", "rounded-md", "p-1");
        saveBtn.addEventListener("click", () => {
          if (popup.saveCallback) {
            popup.saveCallback(popupInputEl?.value);
          } else {
            setPopup(null);
            popupContainer.remove();
          }
        });
        actions.appendChild(saveBtn);
      }
      popupWindow.appendChild(actions);
      popupContainer.appendChild(popupWindow);
      document.body.appendChild(popupContainer);
    } else {
      clearOwnedPopupContainer();
    }
    return clearOwnedPopupContainer;
  }, [popup]);

  return { popup, setPopup };
}
