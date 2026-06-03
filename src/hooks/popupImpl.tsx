import { createContext } from "preact";
import { JSX } from "preact/jsx-runtime";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import AppModal from "@components/AppModal";

type TPopupState = {
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
};

type TPopupContext = {
  popup: TPopupState | null;
  setPopup: (
    value:
      | TPopupState
      | null
      | ((prev: TPopupState | null) => TPopupState | null)
  ) => void;
};

const PopupContext = createContext<TPopupContext>({
  popup: null,
  setPopup: () => {},
});

function PopupModal({
  popup,
  onClose,
}: {
  popup: TPopupState;
  onClose: () => void;
}) {
  const selectInputRef = useRef<HTMLSelectElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const languageSelectRef = useRef<HTMLSelectElement>(null);
  const [inputValue, setInputValue] = useState(
    popup.input !== undefined ? popup.input.toString() : ""
  );
  const selectOptions =
    popup.selectOptions !== undefined
      ? popup.selectOptions.length
        ? popup.selectOptions
        : popup.input !== undefined
          ? [{ label: popup.input.toString(), value: popup.input.toString() }]
          : [{ label: "-", value: "" }]
      : [];

  useEffect(() => {
    const target = popup.languageManager
      ? languageSelectRef.current
      : popup.selectOptions !== undefined
        ? selectInputRef.current
        : textInputRef.current;
    target?.focus();
  }, [popup.languageManager, popup.selectOptions]);

  useEffect(() => {
    if (popup.selectOptions !== undefined && selectOptions.length > 0) {
      const requested = popup.input?.toString();
      setInputValue(
        requested && selectOptions.some((option) => option.value === requested)
          ? requested
          : selectOptions[0].value
      );
    } else {
      setInputValue(popup.input !== undefined ? popup.input.toString() : "");
    }
  }, [popup.label, popup.text, popup.input, popup.selectOptions]);

  const save = () => {
    if (popup.saveCallback) {
      popup.saveCallback(inputValue);
      return;
    }
    onClose();
  };

  const actions = (
    <>
      {popup.prev ? (
        <button type="button" onClick={() => popup.prevCallback?.(inputValue)}>
          {popup.prev}
        </button>
      ) : null}
      {popup.showClose !== false ? (
        <button type="button" onClick={onClose}>
          Close
        </button>
      ) : null}
      {popup.save ? (
        <button type="button" onClick={save}>
          {popup.save}
        </button>
      ) : null}
    </>
  );

  return (
    <AppModal
      id="popup-container"
      label={popup.label}
      widthClass="w-[min(360px,95vw)]"
      topClass="top-1/3"
      actions={actions}
    >
      <div className="overflow-auto flex-grow">
        <p id="popup-text" className="text-lg">{popup.text}</p>
        {popup.error ? (
          <p id="popup-error" className="text-sm font-bold text-[#ff4d4f]">
            {popup.error}
          </p>
        ) : null}
      </div>
      {popup.languageManager ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <select
              ref={languageSelectRef}
              className="border border-gray-300 rounded-md p-1 grow text-black"
              value={popup.languageManager.selected}
            >
              {popup.languageManager.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => popup.languageManager?.onAdd(languageSelectRef.current?.value || "")}
            >
              Add
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-[180px] overflow-auto">
            {popup.languageManager.items.map((item) => (
              <div key={item} className="flex gap-2 items-center flex-wrap">
                <span className="grow">{item}</span>
                <button
                  type="button"
                  onClick={() => popup.languageManager?.onRemove(item)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {popup.selectOptions !== undefined ? (
        <select
          ref={selectInputRef}
          className="border border-gray-300 rounded-md p-1 text-black"
          value={inputValue}
          onInput={(event) => setInputValue(event.currentTarget.value)}
        >
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : popup.input !== undefined ? (
        <input
          ref={textInputRef}
          type="text"
          value={inputValue}
          className="border border-gray-300 rounded-md p-1"
          onInput={(event) => setInputValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            save();
          }}
        />
      ) : null}
    </AppModal>
  );
}

export function PopupProvider(props: { children: JSX.Element | JSX.Element[] }) {
  const [popup, setPopup] = useState<TPopupState | null>(null);

  return (
    <PopupContext.Provider value={{ popup, setPopup }}>
      {props.children}
      {popup ? <PopupModal popup={popup} onClose={() => setPopup(null)} /> : null}
    </PopupContext.Provider>
  );
}

export default function usePopup() {
  return useContext(PopupContext);
}
