import * as React from "react";
import {
  Controller,
  Control,
  Path,
  RegisterOptions,
  PathValue,
} from "react-hook-form";

type AnyForm = Record<string, unknown>;

type SafeRegisterOptions<
  TFieldValues extends AnyForm,
  TName extends Path<TFieldValues>
> = Omit<
  RegisterOptions<TFieldValues, TName>,
  "valueAsNumber" | "valueAsDate" | "setValueAs" | "shouldUnregister"
>;

type BaseProps<T extends AnyForm> = {
  name: Path<T>;
  control: Control<T>;
  placeholder?: string;
  className?: string;
  rules?: SafeRegisterOptions<T, Path<T>>;
  disabled?: boolean;
};

function sanitizeInput(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/[^0-9.,]/g, "");
}

function normalizeDecimalFlexible(s: string): string {
  const x0 = sanitizeInput(s);
  if (!x0) return "";
  const lastDot = x0.lastIndexOf(".");
  const lastComma = x0.lastIndexOf(",");
  const decPos = Math.max(lastDot, lastComma);
  if (decPos === -1) return x0.replace(/[.,]/g, "");
  const intPart = x0.slice(0, decPos).replace(/[.,]/g, "");
  const decPart = x0.slice(decPos + 1).replace(/[.,]/g, "");
  return decPart ? `${intPart}.${decPart}` : intPart;
}

function limitDecimals(x: string, max = 2): string {
  const [i, d] = x.split(".");
  if (!d) return i;
  return `${i}.${d.slice(0, max)}`;
}

function stripLeadingZerosInt(i: string): string {
  const trimmed = i.replace(/^0+(?=\d)/, "");
  return trimmed === "" ? "0" : trimmed;
}

function addGroupingBR(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function toDisplayBR(raw: string, maxDecimals: number): string {
  if (!raw) return "";
  const normalized = limitDecimals(normalizeDecimalFlexible(raw), maxDecimals);
  if (!normalized) return "";
  const [i, d] = normalized.split(".");
  const intBR = addGroupingBR(stripLeadingZerosInt(i || "0"));
  return d != null && d !== "" ? `${intBR},${d}` : intBR;
}

function toDisplayMoneyBR(raw: string): string {
  if (!raw) return "";
  const normalized = limitDecimals(normalizeDecimalFlexible(raw), 2);
  if (!normalized) return "";
  const [i, d = ""] = normalized.split(".");
  const intBR = addGroupingBR(stripLeadingZerosInt(i || "0"));
  const dec = (d + "00").slice(0, 2);
  return `${intBR},${dec}`;
}

function toRawNeutral(display: string, maxDecimals: number): string {
  if (!display) return "";
  return limitDecimals(normalizeDecimalFlexible(display), maxDecimals);
}

function isValidNeutral(v: string): boolean {
  if (v === "") return true;
  const x = normalizeDecimalFlexible(v);
  return /^(\d+(\.\d+)?)$/.test(x);
}

function baseValidate<T extends AnyForm>(
  v: PathValue<T, Path<T>>
): true | string {
  return isValidNeutral(String(v ?? "")) || "Invalid number";
}

function mergeValidate<T extends AnyForm>(
  userValidate: SafeRegisterOptions<T, Path<T>>["validate"]
): RegisterOptions<T, Path<T>>["validate"] {
  if (!userValidate) {
    return (value: PathValue<T, Path<T>>) => baseValidate<T>(value);
  }
  if (typeof userValidate === "function") {
    return {
      __base: (value: PathValue<T, Path<T>>) => baseValidate<T>(value),
      user: (value: PathValue<T, Path<T>>, formValues: T) => {
        const r = userValidate(value, formValues);
        return (r === undefined ? true : r) as
          | string
          | boolean
          | Promise<string | boolean>;
      },
    };
  }
  const mapped: Record<
    string,
    (value: PathValue<T, Path<T>>, formValues: T) => string | boolean | Promise<string | boolean>
  > = {
    __base: (value) => baseValidate<T>(value),
  };
  for (const [key, fn] of Object.entries(userValidate)) {
    mapped[key] = (value, formValues) => {
      const r = fn(value, formValues);
      return (r === undefined ? true : r) as
        | string
        | boolean
        | Promise<string | boolean>;
    };
  }
  return mapped;
}

function BaseMaskedField<T extends AnyForm>({
  name,
  control,
  placeholder,
  className,
  rules,
  disabled,
  maxDecimals,
}: BaseProps<T> & { maxDecimals: number }) {
  const validate = mergeValidate<T>(rules?.validate);

  return (
    <Controller<T, Path<T>>
      name={name}
      control={control}
      rules={{
        ...(rules as RegisterOptions<T, Path<T>>),
        validate,
      }}
      render={({ field, fieldState }) => {
        const displayValue = toDisplayBR(String(field.value ?? ""), maxDecimals);

        return (
          <input
            value={displayValue}
            placeholder={placeholder}
            className={
              className ??
              `w-full rounded-xl border px-3 py-2 ${
                fieldState.error ? "border-red-500" : "border-gray-200"
              }`
            }
            disabled={disabled}
            inputMode="decimal"
            pattern="[0-9.,]*"
            onBeforeInput={(
              e: React.FormEvent<HTMLInputElement> & { nativeEvent: InputEvent }
            ) => {
              const ch = e.nativeEvent.data ?? "";
              if (ch && !/^[0-9.,\s]+$/.test(ch)) e.preventDefault();
            }}
            onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => {
              const text = e.clipboardData.getData("text");
              if (!/^[0-9.,\s]+$/.test(text)) e.preventDefault();
            }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const nextRaw = toRawNeutral(e.target.value, maxDecimals);
              field.onChange(nextRaw);
            }}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        );
      }}
    />
  );
}

export function DecimalField<T extends AnyForm>(
  props: BaseProps<T> & { maxDecimals?: number }
) {
  const { maxDecimals = 8, ...rest } = props;
  return <BaseMaskedField {...rest} maxDecimals={maxDecimals} />;
}

export function IntegerField<T extends AnyForm>(props: BaseProps<T>) {
  return <BaseMaskedField {...props} maxDecimals={0} />;
}

export function MoneyField<T extends AnyForm>({
  name,
  control,
  placeholder,
  className,
  rules,
  disabled,
}: BaseProps<T>) {
  const validate = mergeValidate<T>(rules?.validate);

  return (
    <Controller<T, Path<T>>
      name={name}
      control={control}
      rules={{
        ...(rules as RegisterOptions<T, Path<T>>),
        validate,
      }}
      render={({ field, fieldState }) => {
        const displayValue = toDisplayMoneyBR(String(field.value ?? ""));

        return (
          <input
            value={displayValue}
            placeholder={placeholder}
            className={
              className ??
              `w-full rounded-xl border px-3 py-2 ${
                fieldState.error ? "border-red-500" : "border-gray-200"
              }`
            }
            disabled={disabled}
            inputMode="numeric"
            pattern="[0-9.,]*"
            onBeforeInput={(
              e: React.FormEvent<HTMLInputElement> & { nativeEvent: InputEvent }
            ) => {
              const ch = e.nativeEvent.data ?? "";
              if (ch && !/^[0-9.,\s]+$/.test(ch)) e.preventDefault();
            }}
            onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => {
              const text = e.clipboardData.getData("text");
              if (!/^[0-9.,\s]+$/.test(text)) e.preventDefault();
            }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const txt = e.target.value;
              const digits = txt.replace(/\D/g, "");
              let raw = "";
              if (digits.length === 0) {
                raw = "";
              } else if (digits.length === 1) {
                raw = `0.0${digits}`;
              } else if (digits.length === 2) {
                raw = `0.${digits}`;
              } else {
                raw = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
              }
              field.onChange(raw);
            }}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        );
      }}
    />
  );
}

/** Standalone money input (sem react-hook-form), recebe/entrega RAW "1234.56" */
export function MoneyInputStandalone({
  valueRaw,
  onChangeRaw,
  placeholder,
  className,
  disabled,
  maxDecimals = 2,
}: {
  valueRaw: string;
  onChangeRaw: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxDecimals?: number;
}) {
  return (
    <input
      value={toDisplayMoneyBR(valueRaw)}
      placeholder={placeholder}
      className={
        className ?? "w-full rounded-xl border border-gray-200 px-3 py-2"
      }
      disabled={disabled}
      inputMode="numeric"
      pattern="[0-9.,]*"
      onBeforeInput={(
        e: React.FormEvent<HTMLInputElement> & { nativeEvent: InputEvent }
      ) => {
        const ch = e.nativeEvent.data ?? "";
        if (ch && !/^[0-9.,\s]+$/.test(ch)) e.preventDefault();
      }}
      onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData("text");
        if (!/^[0-9.,\s]+$/.test(text)) e.preventDefault();
      }}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const txt = e.target.value;
        const digits = txt.replace(/\D/g, "");
        let raw = "";
        if (digits.length === 0) raw = "";
        else if (digits.length === 1) raw = `0.0${digits}`;
        else if (digits.length === 2) raw = `0.${digits}`;
        else raw = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
        onChangeRaw(limitDecimals(raw, maxDecimals));
      }}
      onBlur={() => {
        if (!valueRaw) return;
        const [i, d = ""] = valueRaw.split(".");
        const dec = (d + "0".repeat(maxDecimals)).slice(0, maxDecimals);
        onChangeRaw(dec ? `${i}.${dec}` : i);
      }}
    />
  );
}

export default BaseMaskedField;
