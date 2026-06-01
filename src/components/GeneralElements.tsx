import { ComponentChildren, InputHTMLAttributes, JSX, TargetedEvent } from "preact";
import Select, {
  GroupBase,
  MultiValue,
  SingleValue,
  StylesConfig,
} from "react-select";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  MDXEditor,
  MDXEditorMethods,
  Separator,
  UndoRedo,
  headingsPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { useEffect, useRef, useState } from "preact/hooks";
import { FlexCol, FlexRow } from "./Flex";
import { forwardRef } from "preact/compat";
import XIcon from "./icons/general/XIcon";

export type HTMLOptionData<T> = {
  label: string;
  value: T;
};

export function SelectUnq<
  T,
  K extends
    | MultiValue<HTMLOptionData<T>>
    | SingleValue<HTMLOptionData<T>> = SingleValue<HTMLOptionData<T>>
>({
  id,
  optionData,
  label,
  value,
  onChange,
  className,
  disabled = false,
  widthOverride,
  layout = "flex-row",
  multiple = false,
}: {
  id: string;
  optionData: HTMLOptionData<T>[];
  label: string;
  value: HTMLOptionData<T> | HTMLOptionData<T>[];
  onChange: (e: K) => void;
  className?: string;
  disabled?: boolean;
  widthOverride?: string;
  layout?: "flex-row" | "flex-col";
  multiple?: boolean;
}) {
  const LayoutSelector = (props: { children: ComponentChildren }) => {
    if (layout === "flex-row")
      return (
        <FlexRow
          className={`${
            className ? className + " " : ""
          }justify-stretch shrink-0 flex-wrap sm:flex-nowrap`}
        >
          {props.children}
        </FlexRow>
      );
    else
      return (
        <FlexCol
          className={`${
            className ? className + " " : ""
          }justify-stretch shrink-0 min-w-0`}
        >
          {props.children}
        </FlexCol>
      );
  };

  const getValue = (val: HTMLOptionData<T> | HTMLOptionData<T>[]) => {
    if (Array.isArray(val) && val.length > 0) {
      return val[0].label ? val : [];
    } else {
      const newVal = val as HTMLOptionData<T>;
      return newVal.label
        ? val
        : { label: "Válassz", value: "0" as unknown as T };
    }
  };

  const customStyles: StylesConfig<
    HTMLOptionData<T>,
    boolean,
    GroupBase<HTMLOptionData<T>>
  > = {
    menuPortal: (provided) => ({
      ...provided,
      zIndex: 9999, // your desired z-index
    }),
    control: (provided) => {
      return {
        ...provided,
        //border: "1px solid #111",
        //borderRadius: "0.25rem",
        //padding: "0.25rem",
        height: "26px",
        minHeight: "24px",
        padding: "0rem",
        margin: "0rem",
        width: "100%",
        backgroundColor: "#bf9040",
        border: "2px solid #b68035",
        boxShadow: "none",
        ":hover": {
          border: "2px solid #b68035",
        },
        userSelect: "none",
      };
    },
    singleValue: (provided) => ({
      ...provided,
      height: "24px",
      lineHeight: "24px",
      padding: "0rem",
      margin: "0rem",
      color: "rgba(0,0,0,0.8)",
    }),
    menu: (provided) => ({
      ...provided,
      border: "2px solid #b68035",
      backgroundColor: "#bf9040",
      width: "100%",
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: "transparent",
      color: state.isSelected ? "white" : "black",
      "&:hover": {
        backgroundColor: "rgba(120, 64, 0, 0.5)",
        color: "white",
      },
    }),
    indicatorsContainer: (provided) => ({
      ...provided,
      color: "black",
      padding: "0rem",
    }),
    valueContainer: (provided) => ({
      ...provided,
      padding: "0px 0px 0px 5px",
      margin: "0rem",
      height: "24px",
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      padding: "0rem",
      color: "black",
    }),
    input: (provided) => ({
      ...provided,
      padding: "0rem",
      margin: "0rem",
    }),
  };

  return (
    <LayoutSelector>
      {label && (
        <div className="flex justify-start items-center p-1 grow asd ">
          <label for={`${id}`} className="">
            {label}
          </label>
        </div>
      )}
      <Select<HTMLOptionData<T>, boolean, GroupBase<HTMLOptionData<T>>>
        id={`${id}`}
        className={`p-1 react-select ${
          widthOverride ? widthOverride : " w-full sm:w-40"
        }${multiple ? " multiple" : " single"}`}
        styles={customStyles}
        options={optionData}
        value={getValue(value) as K}
        onChange={(e) => {
          if (!e) return;
          const data = e as K;
          onChange(data);
        }}
        menuPortalTarget={document.body}
        isDisabled={disabled || false}
        isMulti={multiple}
        menuPlacement="auto"
      />
    </LayoutSelector>
  );
}

export const CheckBoxUnq = forwardRef<
  HTMLInputElement,
  {
    id: string;
    label: string;
    value: boolean;
    onChange: (e: TargetedEvent<HTMLInputElement, Event>) => void;
    className?: string;
    disabled?: boolean;
    layout?: "flex-row" | "flex-col";
    widthOverride?: string;
  }
>(
  (
    {
      id,
      label,
      value,
      onChange,
      className,
      disabled = false,
      layout = "flex-row",
      widthOverride,
    },
    ref
  ) => {
    const LayoutSelector = (props: { children: ComponentChildren }) => {
      if (layout === "flex-row")
        return (
          <FlexRow
            className={`${className ? className + " " : ""}justify-stretch ${
              widthOverride ? widthOverride : "w-full sm:w-32"
            } flex-wrap sm:flex-nowrap`}
          >
            {props.children}
          </FlexRow>
        );
      else
        return (
          <FlexCol
            className={`${className ? className + " " : ""}justify-stretch ${
              widthOverride ? widthOverride : "w-full sm:w-32"
            }`}
          >
            {props.children}
          </FlexCol>
        );
    };
    return (
      <LayoutSelector>
        <div className="flex justify-start items-center p-1 grow">
          <label for={`${id}`} className="">
            {label}
          </label>
        </div>
        <input
          id={`${id}`}
          className={`p-1`}
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e)}
          disabled={disabled || false}
          ref={ref}
        />
      </LayoutSelector>
    );
  }
);

type InputUnqProps<T extends number | string> =
  InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    value: T;
    layout?: "flex-row" | "flex-col";
    widthOverride?: string;
    id: string;
    svgIcon?: JSX.Element;
  };

export const InputUnq = forwardRef<
  HTMLInputElement,
  InputUnqProps<number | string>
>(
  (
    {
      label,
      value,
      widthOverride,
      id,
      layout = "flex-row",
      svgIcon,
      onChange,
      onBlur,
      className,
      disabled,
      placeholder,
      type,
      ...rest
    },
    ref
  ) => {
    const LayoutSelector = ({ children }: { children: ComponentChildren }) =>
      layout === "flex-row" ? (
        <FlexRow
          className={`${
            className ? className + " " : ""
          }justify-stretch shrink-0 flex-wrap sm:flex-nowrap`}
        >
          {children}
        </FlexRow>
      ) : (
        <FlexCol
          className={`${
            className ? className + " " : ""
          }justify-stretch shrink-0 min-w-0`}
        >
          {children}
        </FlexCol>
      );

    return (
      <LayoutSelector>
        {(svgIcon || label) && (
          <div className="flex justify-start items-center p-1 grow">
            {svgIcon}
            {label && (
              <label htmlFor={id} className="grow">
                {label}
              </label>
            )}
          </div>
        )}
        <input
          {...rest}
          id={id}
          className={`m-[2px] px-1 ${
            widthOverride ? widthOverride : "w-full sm:w-40"
          }`}
          type={type ? type : typeof value === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => {
            const inputElem = e.currentTarget as HTMLInputElement;
            const cursorPos = inputElem.selectionStart;
            onChange?.(e);
            requestAnimationFrame(() => {
              const nextElem = document.getElementById(id) as HTMLInputElement | null;
              if (!nextElem) return;
              if (document.activeElement !== nextElem) {
                nextElem.focus();
              }
              if (
                typeof cursorPos === "number" &&
                nextElem.type !== "number"
              ) {
                try {
                  nextElem.setSelectionRange(cursorPos, cursorPos);
                } catch {}
              }
            });
          }}
          onBlur={onBlur}
          disabled={disabled || false}
          placeholder={placeholder}
          ref={ref}
        />
      </LayoutSelector>
    );
  }
);

export function TextAreaUnq({
  id,
  label,
  value,
  onChange,
  onSave,
  onBlur,
  className,
  textAreaClassName,
  disabled,
  placeholder,
  layout = "flex-col",
  element = "textarea",
}: {
  id: string;
  label?: string;
  value: string;
  onChange?: (msg: string) => void;
  onSave?: (msg: string) => void;
  onBlur?: (e: FocusEvent) => void;
  className?: string;
  textAreaClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  layout?: "flex-col" | "flex-row";
  element?: "textarea" | "editor";
  keepFocusOnChange?: boolean;
}) {
  const textareaId = `${id}-textarea`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    const isFocused = document.activeElement === textareaRef.current;
    if (!isFocused) setLocalValue(value);
  }, [value]);

  const elementRef = useRef<MDXEditorMethods>(null);
  const Save = () => {
    if (!onSave) return null;
    return (
      <button
        onClick={() => {
          const markdown = elementRef.current?.getMarkdown() || "";
          if (
            onSave &&
            typeof onSave === "function" &&
            typeof markdown === "string"
          ) {
            onSave(markdown);
          }
        }}
        className="p-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none shrink-0"
      >
        Save
      </button>
    );
  };
  const LabelElement = (
    <div className="flex justify-start items-center p-1">
      <label for={textareaId} className="grow">
        {label}
      </label>
    </div>
  );

  if (layout === "flex-row") {
    return (
      <FlexRow
        className={`${
          className ? className + " " : ""
        } max-w-full shrink-0 grow`}
      >
        {label && LabelElement}
        {element === "editor" ? (
          <MDXEditor
            key={id}
            ref={elementRef}
            markdown={value}
            plugins={[
              toolbarPlugin({
                toolbarContents: () => (
                  <>
                    <BlockTypeSelect />
                    <Separator />
                    <UndoRedo />
                    <Separator />
                    <BoldItalicUnderlineToggles />
                    <Separator />
                    <Save />
                  </>
                ),
              }),
              headingsPlugin(),
            ]}
            className={`${className ? className + " " : ""}p-1 grow max-w-full mdxx`}
            placeholder={placeholder}
            onChange={(e) => onChange && onChange(e)}
            onBlur={(e) => onBlur && onBlur(e)}
          />
        ) : (
          <textarea
            id={textareaId}
            ref={textareaRef}
            className={`${textAreaClassName ? textAreaClassName + " " : ""}p-1 shrink-0 grow w-full min-h-[80px]`}
            value={localValue}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              const nextValue = target.value;
              setLocalValue(nextValue);
              if (onChange && typeof onChange === "function") onChange(nextValue);
            }}
            disabled={disabled || false}
            placeholder={placeholder}
          />
        )}
      </FlexRow>
    );
  }
  return (
    <FlexCol
      className={`${className ? className + " " : ""} max-w-full shrink-0 grow`}
    >
      {label && LabelElement}
      {element === "editor" ? (
        <MDXEditor
          key={id}
          ref={elementRef}
          markdown={value}
          plugins={[
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <BlockTypeSelect />
                  <Separator />
                  <UndoRedo />
                  <Separator />
                  <BoldItalicUnderlineToggles />
                  <Separator />
                  <Save />
                </>
              ),
            }),
            headingsPlugin(),
          ]}
          className={`${className ? className + " " : ""}p-1 grow max-w-full mdxx`}
          placeholder={placeholder}
          onChange={(e) => onChange && onChange(e)}
          onBlur={(e) => onBlur && onBlur(e)}
        />
      ) : (
        <textarea
          id={textareaId}
          ref={textareaRef}
          className={`${textAreaClassName ? textAreaClassName + " " : ""}p-1 shrink-0 grow w-full min-h-[80px]`}
          value={localValue}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            const nextValue = target.value;
            setLocalValue(nextValue);
            if (onChange && typeof onChange === "function") onChange(nextValue);
          }}
          disabled={disabled || false}
          placeholder={placeholder}
        />
      )}
    </FlexCol>
  );
}

export function ButtonUnq({
  id,
  onClick,
  className,
  disabled = false,
  children,
}: {
  id: string;
  onClick: (e: Event) => void;
  className?: string;
  disabled?: boolean;
  children: ComponentChildren;
}) {
  return (
    <button
      className={`m-[2px] px-1${className ? " " + className : ""}`}
      onClick={onClick}
      disabled={disabled || false}
      id={id}
    >
      {children}
    </button>
  );
}

type TTabProps = {
  tabs: { name: string; value: string }[];
  selectedTabIndexProp?: number;
  label?: string;
  layout?: "row" | "col";
};

type TEditorProps = {
  editor: boolean;
  onSave: (tab: { name: string; value: string }) => void;
  onDelete: (tabName: string) => void;
  addNewTab: (name: string) => void;
};

type TTabEditorProps = TEditorProps & TTabProps;

export const TabComponent = ({
  tabs,
  selectedTabIndexProp = -1,
  label = "",
  layout = "row",
  ...props
}: TTabProps | TTabEditorProps) => {
  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(
    tabs.length === 0 ? selectedTabIndexProp : 0
  );
  const tabInputIdRef = useRef(
    `tab-name-${Math.random().toString(36).slice(2, 10)}`
  );

  const isTabEditorProps = (
    props: TEditorProps | {}
  ): props is TTabEditorProps => {
    return (props as TTabEditorProps).editor !== undefined;
  };

  const LayoutWrapper = ({
    children,
    tabs,
    label,
  }: {
    children: JSX.Element | JSX.Element[];
    tabs: { name: string; value: string }[];
    label: string;
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    return layout === "row" ? (
      <FlexRow className="justify-start fancy-container shrink-0 h-auto sm:h-[200px] flex-col sm:flex-row min-w-0">
        <FlexCol className="shrink-0 min-w-0">
          {label && <div className="p-1">{label}</div>}
          <FlexCol className="w-full sm:w-[300px] grow overflow-y-auto gap-1">
            {tabs.map((tab, index) => (
              <FlexRow
                className="shrink-0 justify-stretch gap-1"
                key={tab.name}
              >
                <ButtonUnq
                  id={`tab-${tab.name}`}
                  onClick={() => setSelectedTabIndex(index)}
                  className={`grow${
                    index === selectedTabIndex ? " selected" : ""
                  }`}
                >
                  {tab.name}
                </ButtonUnq>
                <ButtonUnq
                  id={`tab-${tab.name}-delete`}
                  onClick={() => {
                    if (isTabEditorProps(props)) {
                      props.onDelete(tab.name);
                      setSelectedTabIndex(-1);
                    }
                  }}
                >
                  <XIcon className="h-4 w-4" />
                </ButtonUnq>
              </FlexRow>
            ))}
          </FlexCol>
          <FlexRow className="justify-stretch items-center gap-1 h-auto sm:h-[30px] shrink-0 flex-wrap sm:flex-nowrap">
            <InputUnq
              id={tabInputIdRef.current}
              value=""
              onChange={() => {}}
              placeholder="Tab name"
              className="grow"
              widthOverride="w-full"
              ref={inputRef}
            />
            <ButtonUnq
              id="add-tab"
              onClick={() => {
                if (isTabEditorProps(props)) {
                  props.addNewTab(inputRef.current?.value || "");
                  setSelectedTabIndex(tabs.length);
                  inputRef.current!.value = "";
                }
              }}
            >
              Add
            </ButtonUnq>
          </FlexRow>
        </FlexCol>
        {children}
      </FlexRow>
    ) : (
      <FlexCol className="justify-start fancy-container max-h-[200px] shrink-0">
        {children}
      </FlexCol>
    );
  };
  return (
    <LayoutWrapper tabs={tabs} label={label}>
      <FlexRow className="justify-stretch grow fancy-container overflow-y-auto">
        {selectedTabIndex < 0 || selectedTabIndex >= tabs.length
          ? ""
          : isTabEditorProps(props) && props.editor
          ? (
              <TextAreaUnq
                id={`tab-${tabs[selectedTabIndex].name}`}
                value={tabs[selectedTabIndex].value}
                onChange={() => {}}
                element="editor"
                onSave={(msg) => {
                  props.onSave({ ...tabs[selectedTabIndex], value: msg });
                }}
              />
            )
          : tabs[selectedTabIndex].value}
      </FlexRow>
    </LayoutWrapper>
  );
};


