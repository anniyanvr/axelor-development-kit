import { clsx } from "@axelor/ui";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useMemo } from "react";

import { Select, SelectProps, SelectValue } from "@/components/select";
import { Selection as SelectionType } from "@/services/client/meta.types";
import convert from "@/utils/convert";

import { FieldControl, FieldProps } from "../../builder";
import { useSelectionDefault, useSelectionList } from "./hooks";
import { getMultiValues, joinMultiValues } from "./utils";

import styles from "./selection.module.scss";

const optionKey = (item: SelectionType) => item.value!;
const optionLabel = (item: SelectionType) => item.title!;
const optionEqual = (a: SelectionType, b: SelectionType) => a.value === b.value;
const optionMatch = (option: SelectionType, text: string) =>
  optionLabel(option).toLowerCase().includes(text.toLowerCase());

export type SelectionProps<Multiple extends boolean> = FieldProps<
  string | number | null
> &
  Pick<
    SelectProps<SelectionType, Multiple>,
    | "multiple"
    | "autoComplete"
    | "renderOption"
    | "renderValue"
    | "inputStartAdornment"
    | "closeOnSelect"
  >;

export function Selection<Multiple extends boolean>(
  props: SelectionProps<Multiple>,
) {
  const {
    schema,
    readonly,
    invalid,
    multiple,
    autoComplete = true,
    closeOnSelect,
    inputStartAdornment,
    renderOption,
    renderValue,
    widgetAtom,
    valueAtom,
  } = props;

  const { placeholder } = schema;
  const [value, setValue] = useAtom(valueAtom);
  const {
    attrs: { required, focus },
  } = useAtomValue(widgetAtom);

  const selectionList = useSelectionList({ schema, widgetAtom });
  const { selectionDefault, selectionZero } = useSelectionDefault({
    schema,
    value,
  });

  const selectionValue = useMemo(() => {
    const selectionAll: SelectionType[] = schema.selectionList ?? [];
    if (multiple) {
      const values = getMultiValues(value);
      return values.map(
        (x) =>
          selectionAll.find((item) => String(item.value) === String(x)) ??
          selectionDefault,
      );
    }
    return (
      selectionAll.find((item) => String(item.value) === String(value)) ??
      selectionDefault
    );
  }, [multiple, schema.selectionList, selectionDefault, value]) as SelectValue<
    SelectionType,
    Multiple
  >;

  const handleChange = useCallback(
    (value: SelectValue<SelectionType, Multiple>) => {
      let next: string | null = null;
      if (value) {
        next = Array.isArray(value)
          ? joinMultiValues(value.map((x) => String(x.value)))
          : convert(value.value, { props: schema }) ?? null;
      }
      setValue(next, true);
    },
    [schema, setValue],
  );

  return (
    <FieldControl {...props}>
      <Select
        className={clsx({
          [styles.readonly]: readonly,
          [styles.inGridEditor]: schema.inGridEditor,
        })}
        autoFocus={focus}
        autoComplete={autoComplete}
        multiple={multiple}
        readOnly={readonly}
        required={required}
        invalid={invalid}
        options={selectionList}
        optionKey={optionKey}
        optionLabel={optionLabel}
        optionEqual={optionEqual}
        optionMatch={optionMatch}
        value={selectionValue}
        onChange={handleChange}
        inputStartAdornment={inputStartAdornment}
        renderOption={renderOption}
        renderValue={renderValue}
        placeholder={placeholder}
        closeOnSelect={closeOnSelect}
        {...(selectionZero &&
          String(value) === "0" && {
            clearIcon: false,
          })}
      />
    </FieldControl>
  );
}
