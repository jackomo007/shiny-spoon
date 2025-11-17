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
  let x = sanitizeInput(s);
  if (!x) return "";

  x = x.replace(/,/g, "");

  const firstDot = x.indexOf(".");
  if (firstDot !== -1) {
    const intPart = x.slice(0, firstDot);
    const decimalPart = x.slice(firstDot + 1).replace(/\./g, "");
    return decimalPart ? `${intPart}.${decimalPart}` : intPart;
  }

  return x;
}

export function limitDecimals(x: string, max = 8): string {
  const [i, d] = x.split(".");
  if (!d) return i;
  return `${i}.${d.slice(0, max)}`;
}

function stripLeadingZerosInt(i: string): string {
  const trimmed = i.replace(/^0+(?=\d)/, "");
  return trimmed === "" ? "0" : trimmed;
}

function addGroupingUS(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function toDisplayUS(raw: string, maxDecimals: number): string {
  if (!raw) return "";
  const normalized = limitDecimals(normalizeDecimalFlexible(raw), maxDecimals);
  if (!normalized) return "";
  const [i, d] = normalized.split(".");
  const intUS = addGroupingUS(stripLeadingZerosInt(i || "0"));
  return d != null && d !== "" ? `${intUS}.${d}` : intUS;
}

/**
 * Converte dígitos "puros" para um número com casas decimais.
 * Ex.: digitsToRaw("1675", 3) => "1.675"
 */
function digitsToRaw(digits: string, decimalPlaces: number): string {
  if (!digits) return "";

  if (decimalPlaces <= 0) {
    return stripLeadingZerosInt(digits || "0");
  }

  if (digits.length <= decimalPlaces) {
    const padded = digits.padStart(decimalPlaces, "0");
    return `0.${padded}`;
  }

  const intPart = digits.slice(0, digits.length - decimalPlaces);
  const decPart = digits.slice(-decimalPlaces);
  return `${intPart}.${decPart}`;
}

/**
 * Agora aceita quantidade variável de casas decimais.
 */
function toDisplayMoneyUS(raw: string, decimalPlaces = 2): string {
  if (!raw) return "";
  const normalized = limitDecimals(
    normalizeDecimalFlexible(raw),
    decimalPlaces
  );
  if (!normalized) return "";
  const [i, d = ""] = normalized.split(".");
  const intUS = addGroupingUS(stripLeadingZerosInt(i || "0"));
  const dec = (d + "0".repeat(decimalPlaces)).slice(0, decimalPlaces);
  return `${intUS}.${dec}`;
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
        const displayValue = toDisplayUS(String(field.value ?? ""), maxDecimals);

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

/**
 * MoneyField agora aceita `decimalPlaces` (default = 2).
 * Ex.: decimalPlaces={3} → 1675 => 1.675
 */
export function MoneyField<T extends AnyForm>({
  name,
  control,
  placeholder,
  className,
  rules,
  disabled,
  decimalPlaces = 2,
}: BaseProps<T> & { decimalPlaces?: number }) {
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
        const displayValue = toDisplayMoneyUS(
          String(field.value ?? ""),
          decimalPlaces
        );

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
              const raw = digitsToRaw(digits, decimalPlaces);
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

/**
 * Standalone, também usando casas decimais configuráveis via `maxDecimals`.
 */
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
      value={toDisplayMoneyUS(valueRaw, maxDecimals)}
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
        const raw = digitsToRaw(digits, maxDecimals);
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
